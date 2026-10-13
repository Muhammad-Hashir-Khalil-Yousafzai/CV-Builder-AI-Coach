"""Dashboard + saved-CV-versions logic (kept separate from the HTTP views)."""
import hashlib
import json
import logging
from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from . import ats
from .models import ATSCheck, Certification, CVProfile, CVVersion, Education, Experience, Project, Skill
from .serializers import CVProfileSerializer

BASIC_FIELDS = ["full_name", "headline", "phone", "address", "summary", "linkedin_url", "github_url", "portfolio_url", "date_of_birth"]
RELATED = [("education", Education), ("experience", Experience), ("skills", Skill), ("projects", Project), ("certifications", Certification)]
LEVELS = {"student", "junior", "mid", "senior"}
MAX_MANUAL_VERSIONS = 40
MAX_AUTO_VERSIONS = 10
MAX_ATS_HISTORY = 30
log = logging.getLogger(__name__)


# ------------------------------------------------------------------ versions
def has_content(profile):
    return bool(profile.full_name or profile.summary or any(getattr(profile, r).exists() for r, _ in RELATED))


def snapshot(profile):
    data = dict(CVProfileSerializer(profile).data)
    for k in ("id", "photo", "updated_at"):
        data.pop(k, None)
    for p in data.get("projects", []):
        p.pop("image", None)
    return json.loads(json.dumps(data, default=str))


def counts(data):
    return {r: len(data.get(r) or []) for r, _ in RELATED}


def save_version(profile, name, kind="manual"):
    name = (name or "").strip()[:120] or f"CV · {date.today():%b %d, %Y}"
    v = CVVersion.objects.create(profile=profile, name=name, kind=kind, data=snapshot(profile))
    if kind == "auto":  # keep only the newest few auto-saves
        old = list(profile.versions.filter(kind="auto").values_list("id", flat=True)[MAX_AUTO_VERSIONS:])
        if old:
            CVVersion.objects.filter(id__in=old).delete()
    return v


def brief(v):
    return {"id": v.id, "name": v.name, "kind": v.kind, "kind_label": v.get_kind_display(), "created_at": v.created_at.isoformat(),
            "headline": v.data.get("headline", ""), "counts": counts(v.data)}


def brief_light(v):
    return {"id": v.id, "name": v.name, "kind": v.kind, "kind_label": v.get_kind_display(), "created_at": v.created_at.isoformat()}


@transaction.atomic
def restore_version(profile, version):
    if has_content(profile):
        save_version(profile, f"Before restoring “{version.name}”"[:120], "auto")
    d = version.data
    for f in BASIC_FIELDS:
        field = CVProfile._meta.get_field(f)
        v = d.get(f)
        try:
            setattr(profile, f, field.to_python(v) if f == "date_of_birth" and v else (None if f == "date_of_birth" else str(v or "")))
        except ValidationError:
            setattr(profile, f, None if f == "date_of_birth" else "")
    profile.save()
    for rel, Model in RELATED:
        getattr(profile, rel).all().delete()
        for item in d.get(rel) or []:
            kwargs = {}
            for field in Model._meta.concrete_fields:
                if field.name in ("id", "profile", "image") or item.get(field.name) is None:
                    continue
                try:
                    kwargs[field.name] = field.to_python(item[field.name])
                except ValidationError:
                    pass
            try:
                Model.objects.create(profile=profile, **kwargs)
            except Exception:  # noqa: BLE001 - skip a bad row rather than fail the whole restore
                log.exception("Skipped a row while restoring version %s", version.id)


# ------------------------------------------------------------------ ATS history
def record_ats_check(profile, jd, result):
    h = hashlib.sha1(jd.strip().encode("utf-8")).hexdigest()
    ATSCheck.objects.update_or_create(
        profile=profile, jd_hash=h,
        defaults={"job_title": (result.get("job_title") or "")[:150], "score": result["score"], "grade": (result.get("grade") or "")[:30]},
    )
    old = list(profile.ats_checks.values_list("id", flat=True)[MAX_ATS_HISTORY:])
    if old:
        ATSCheck.objects.filter(id__in=old).delete()


def score_and_record(profile, email, jd):
    result = ats.score_job_match(profile, email, jd)
    try:
        record_ats_check(profile, jd, result)
    except Exception:  # noqa: BLE001 - history is a nice-to-have; never break scoring
        log.exception("Couldn't record ATS check")
    return result


# ------------------------------------------------------------------ dashboard
def section_counts(profile):
    """All five section counts in ONE query (scalar subqueries, so no row multiplication)."""
    def sub(model):
        return Coalesce(Subquery(model.objects.filter(profile=OuterRef("pk")).order_by().values("profile").annotate(c=Count("pk")).values("c")), 0)
    row = CVProfile.objects.filter(pk=profile.pk).annotate(
        n_experience=sub(Experience), n_education=sub(Education), n_skills=sub(Skill), n_projects=sub(Project), n_certifications=sub(Certification),
    ).values("n_experience", "n_education", "n_skills", "n_projects", "n_certifications").first()
    return {k[2:]: v for k, v in row.items()}


def completeness(profile, n):
    basics = [("Full name", bool(profile.full_name)), ("Headline", bool(profile.headline)), ("Phone", bool(profile.phone)),
              ("Location", bool(profile.address)), ("Summary", len((profile.summary or "").split()) >= 20)]
    nb = sum(ok for _, ok in basics)
    n_exp, n_edu, n_sk, n_pr, n_ce = n["experience"], n["education"], n["skills"], n["projects"], n["certifications"]
    missing = [label.lower() for label, ok in basics if not ok]
    sections = [
        {"key": "basics", "label": "Basic info", "weight": 25, "fraction": nb / 5,
         "detail": "All set" if nb == 5 else "Missing: " + ", ".join(missing)},
        {"key": "experience", "label": "Work experience", "weight": 25, "fraction": 1.0 if n_exp else 0.0,
         "detail": f"{n_exp} added" if n_exp else "Add a job, internship or freelance work"},
        {"key": "education", "label": "Education", "weight": 15, "fraction": 1.0 if n_edu else 0.0,
         "detail": f"{n_edu} added" if n_edu else "Add your degree or course"},
        {"key": "skills", "label": "Skills", "weight": 15, "fraction": min(1.0, n_sk / 8),
         "detail": f"{n_sk} listed" + ("" if n_sk >= 8 else " (aim for 8+)")},
        {"key": "projects", "label": "Projects", "weight": 10, "fraction": 1.0 if n_pr else 0.0,
         "detail": f"{n_pr} added" if n_pr else "Show something you built"},
        {"key": "certifications", "label": "Certifications", "weight": 10, "fraction": 1.0 if n_ce else 0.0,
         "detail": f"{n_ce} added" if n_ce else "Optional but helps"},
    ]
    for s in sections:
        s["done"] = s["fraction"] >= 1
    return {"percent": round(sum(s["weight"] * s["fraction"] for s in sections)), "sections": sections}


def next_step(n_skills, comp, latest, manual_versions):
    by = {s["key"]: s for s in comp["sections"]}
    if not by["basics"]["done"]:
        return {"title": "Complete your basic info", "text": "Name, headline, phone, location and a short summary are the first things recruiters see.", "cta": "Edit my CV", "to": "/profile"}
    if not by["experience"]["done"]:
        return {"title": "Add your work experience", "text": "Internships and freelance work count too. Use bullets that start with an action verb.", "cta": "Add experience", "to": "/profile"}
    if not by["education"]["done"]:
        return {"title": "Add your education", "text": "Your degree or course is one of the first things a recruiter and an ATS look for.", "cta": "Add education", "to": "/profile"}
    if not by["skills"]["done"]:
        return {"title": "List more skills", "text": f"You have {n_skills}. Aim for at least 8 relevant ones.", "cta": "Add skills", "to": "/profile"}
    if latest is None:
        return {"title": "See how your CV matches a real job", "text": "Paste a job description and get a match score with one-click fixes.", "cta": "Check ATS score", "to": "/ats"}
    if latest.score < 70:
        t = latest.job_title or "your last job"
        return {"title": f"Raise your match for “{t}”", "text": f"Your last score was {latest.score}/100 ({latest.grade}). Add the missing skills and strengthen weak bullets.", "cta": "Improve my CV", "to": "/ats"}
    if manual_versions == 0:
        return {"title": "Save a version of your CV", "text": "Keep a copy of this CV so you can tailor new ones without losing it.", "cta": "Save a version", "to": "/versions"}
    return {"title": "Find jobs that match your CV", "text": "Your CV is in good shape. See which openings fit you best.", "cta": "View job matches", "to": "/job-matches"}


def career_goal_dict(profile):
    g = getattr(profile, "career_goal", None)  # reverse one-to-one: None-safe via getattr default
    return {"fields": g.fields, "work_mode": g.work_mode, "job_type": g.job_type, "goals": g.goals, "timeline": g.timeline} if g else None


def build_dashboard(profile, user):
    n = section_counts(profile)                                   # 1 query
    comp = completeness(profile, n)
    checks = list(profile.ats_checks.all()[:MAX_ATS_HISTORY])      # 1 query
    latest = checks[0] if checks else None
    agg = profile.versions.aggregate(total=Count("id"), manual=Count("id", filter=Q(kind="manual")))  # 1 query
    manual = agg["manual"]
    last_version = profile.versions.defer("data").first() if agg["total"] else None  # 1 query, skips the big JSON column
    best = max((c.score for c in checks), default=0)
    return {
        "name": profile.full_name or user.email.split("@")[0],
        "onboarding": {"needed": not profile.onboarded, "target_role": profile.target_role, "experience_level": profile.experience_level, "career_goal": career_goal_dict(profile)},
        "completeness": comp,
        "ats": {
            "latest": {"score": latest.score, "grade": latest.grade, "job_title": latest.job_title, "date": latest.updated_at.isoformat()} if latest else None,
            "history": [{"job_title": c.job_title, "score": c.score, "date": c.updated_at.isoformat()} for c in reversed(checks[:6])],
            "count": len(checks), "best": best,
        },
        "versions": {"count": agg["total"], "manual": manual, "latest": brief_light(last_version) if last_version else None},
        "next_step": next_step(n["skills"], comp, latest, manual),
        "checklist": [
            {"label": "Tell us your target role", "done": bool(profile.target_role), "to": "/dashboard"},
            {"label": "Complete your profile (80%+)", "done": comp["percent"] >= 80, "to": "/profile"},
            {"label": "Check your CV against a job", "done": len(checks) > 0, "to": "/ats"},
            {"label": "Reach a match score of 70+", "done": best >= 70, "to": "/ats"},
            {"label": "Save a version of your CV", "done": manual > 0, "to": "/versions"},
        ],
    }
