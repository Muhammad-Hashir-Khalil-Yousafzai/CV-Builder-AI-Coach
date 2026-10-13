"""Tiny Gemini text helper (free tier). Returns None when no key / all models fail.

Speed: reuses one HTTP session, tries fast models first, turns "thinking" off, remembers the
last model that worked and skips models that were just rate-limited (no more waiting on dead ones).
"""
import os
import time

import requests

# fast first; the old slow-to-think "latest" aliases are kept only as fallbacks
FAST_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"]

_session = requests.Session()
_cooldown = {}   # model -> time until which we skip it (after 404/429/503)
_good = None     # last model that answered


def _models():
    first = os.environ.get("GEMINI_MODEL")
    order = ([first] if first else []) + ([_good] if _good else []) + FAST_MODELS
    seen = []
    for m in order:
        if m and m not in seen:
            seen.append(m)
    now = time.time()
    ready = [m for m in seen if _cooldown.get(m, 0) <= now]
    return ready or seen  # if everything is cooling down, still try them all


def _post(model, key, body):
    return _session.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "content-type": "application/json"},
        json=body, timeout=(5, 25),
    )


def gemini_text(prompt, max_tokens=1024, json_mode=False):
    global _good
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    cfg = {"temperature": 0.4, "maxOutputTokens": max_tokens}
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    for model in _models():
        body = {"contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {**cfg, "thinkingConfig": {"thinkingBudget": 0}}}  # no hidden reasoning delay
        r = _post(model, key, body)
        if r.status_code == 400:  # this model doesn't accept thinkingConfig: retry plain
            body["generationConfig"] = cfg
            r = _post(model, key, body)
        if r.status_code in (404, 429, 503):
            _cooldown[model] = time.time() + 60
            continue
        r.raise_for_status()
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError):
            continue
        text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
        if text:
            _good = model
            return text
    return None
