"""
Embeddings via the Gemini API (free tier): no torch / sentence-transformers, so the backend fits small free hosts.
Vectors are requested at 384 dimensions, the same size as the Job.embedding column, so no migration is needed.
NOTE: vectors from different models are not comparable. After switching, run: python manage.py reembed_jobs
"""

import hashlib
import math
import os
import time

import requests
from django.core.cache import cache
from pgvector.django import CosineDistance

from .models import Job

EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
DIM = 384
_session = requests.Session()


def _unit(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0  # truncated dimensions must be re-normalised
    return [x / n for x in v]


def get_embeddings(texts, task="RETRIEVAL_DOCUMENT"):
    """Batch-embed many texts -> list of 384-dim vectors. Free tier is ~100 texts/minute, so we pace and retry."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    out = []
    step = 25
    for i in range(0, len(texts), step):
        if i:
            time.sleep(18)  # stay under the free-tier per-minute limit
        body = {"requests": [
            {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": (t or " ")[:6000]}]},
             "taskType": task, "outputDimensionality": DIM}
            for t in texts[i:i + step]]}
        for attempt in range(7):
            r = _session.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents",
                headers={"x-goog-api-key": key, "content-type": "application/json"}, json=body, timeout=60)
            if r.status_code in (429, 503):  # rate limit: wait for the minute window to reset, then retry
                wait = int(r.headers.get("Retry-After", 0) or 0) or min(20 + 15 * attempt, 65)
                print(f"  rate-limited, waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            break
        else:
            raise RuntimeError("Gemini embedding is still rate-limited (daily quota?). Try again later.")
        out += [_unit(e["values"]) for e in r.json()["embeddings"]]
    return out


def get_embedding(text: str, task="RETRIEVAL_DOCUMENT") -> list[float]:
    return get_embeddings([text], task)[0]


def get_cv_embedding(text: str) -> list[float]:
    """Cached query embedding. Key is a hash of the CV text, so editing the CV changes the key automatically."""
    key = "cvemb2:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
    vector = cache.get(key)
    if vector is None:
        vector = get_embedding(text, "RETRIEVAL_QUERY")
        cache.set(key, vector, 60 * 60 * 24 * 7)
    return vector


def build_cv_text(cv_profile) -> str:
    """
    Build a single text blob from a user's CVProfile for embedding.
    Mirrors your actual profiles app field names (skills.name,
    experience.role/company, education.degree, projects.title).
    """
    skills = ", ".join(s.name for s in cv_profile.skills.all())
    experience = " ".join(
        f"{e.role} at {e.company}: {e.description}".strip()
        for e in cv_profile.experience.all()
    )
    education = " ".join(
        f"{e.degree} at {e.institute}" for e in cv_profile.education.all()
    )
    projects = " ".join(
        f"{p.title}: {p.description}".strip() for p in cv_profile.projects.all()
    )

    return (
        f"Headline: {cv_profile.headline}. "
        f"Summary: {cv_profile.summary}. "
        f"Skills: {skills}. "
        f"Experience: {experience}. "
        f"Education: {education}. "
        f"Projects: {projects}."
    )


def match_jobs_for_cv(cv_profile, location: str | None = None, is_remote: bool | None = None, limit: int = 10):
    """
    Return the top-matching Job rows for a given CVProfile, ranked by
    cosine similarity between the CV's embedding and each job's embedding.
    """
    cv_text = build_cv_text(cv_profile)
    cv_vector = get_cv_embedding(cv_text)

    query = Job.objects.all()
    if location:
        query = query.filter(location__icontains=location)
    if is_remote is not None:
        query = query.filter(is_remote=is_remote)

    return (
        query.annotate(distance=CosineDistance("embedding", cv_vector))
        .filter(distance__lt=float(os.environ.get("MATCH_MAX_DISTANCE", "0.7")))  # tune via env once you see real results
        .order_by("distance")[:limit]
    )
