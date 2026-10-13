"""Job-match ATS scoring (job description required).

No official ATS score exists - every real ATS uses private logic - so this is a transparent,
deterministic estimate of how well a profile matches ONE specific job posting.

Components (components the posting doesn't specify are dropped and the rest rescaled):
  Required skills 35 | Preferred skills 10 | Job title fit 10 | Years of experience 10 |
  Education 5 | Responsibility overlap 10 | CV quality 10
Skills use alias normalisation (Node = Node.js, K8s = Kubernetes ...) and count more when they are
*demonstrated in experience/project text*, not just listed. Optional Gemini call extracts the
requirements from the posting more accurately; otherwise rules are used (engine says which).
"""
import hashlib
import json
import math
import time
import os
import re
from collections import Counter
from datetime import date

import requests

SKILLS = """
javascript: js|ecmascript|es6
typescript: ts
python
java
c++: cpp
c#: csharp|c sharp
!go: golang
rust
php
ruby
kotlin
swift
dart
sql
nosql
html
css
sass
react: react.js|reactjs
react_native: react native
next.js: nextjs|next js
vue: vue.js|vuejs
angular: angularjs
svelte
node: node.js|nodejs|node js
!express: express.js|expressjs|express js
django
flask
fastapi
spring: spring boot|springboot
.net: dotnet|asp.net
laravel
tailwind: tailwind css|tailwindcss
bootstrap
redux
graphql
!rest: rest api|rest apis|restful|restful api|restful apis|rest & graphql
websockets: websocket|web sockets
postgresql: postgres|psql
mysql
mongodb: mongo
redis
sqlite
elasticsearch
firebase
docker
kubernetes: k8s
terraform
ansible
jenkins
github_actions: github actions
gitlab_ci: gitlab ci
cicd: ci/cd|ci-cd|ci cd|continuous integration|continuous delivery|continuous deployment
aws: amazon web services
azure
gcp: google cloud|google cloud platform
linux
git
agile: scrum|kanban
microservices: microservice
unit_testing: unit tests|unit testing|unit test|jest|pytest|junit
tdd
machine_learning: machine learning|ml
deep_learning: deep learning
nlp: natural language processing
ai: artificial intelligence
tensorflow
pytorch
pandas
numpy
data_analysis: data analysis|data analytics
power_bi: powerbi|power bi
tableau
excel
spark: apache spark|pyspark
kafka
airflow
flutter
android
ios
figma
ui_ux: ux|ui/ux|ui design|ux design
seo
stripe
oauth: oauth2|jwt
api: apis
leadership
mentoring: mentor|mentorship
project_management: project management
"""

_PATS, _ALIAS = {}, {}
for _line in SKILLS.strip().splitlines():
    _head, _, _rest = _line.partition(":")
    _canon = _head.strip()
    _use = not _canon.startswith("!")
    _canon = _canon.lstrip("!")
    _vars = [v.strip().lower() for v in _rest.split("|") if v.strip()]
    if _use:
        _vars.append(_canon.replace("_", " "))
    for _v in _vars:
        _ALIAS[_v] = _canon
    _vars.sort(key=len, reverse=True)
    _alt = "|".join(re.escape(v).replace("\\ ", r"\s+") for v in _vars)
    _PATS[_canon] = re.compile(r"(?<![A-Za-z0-9+#])(?:%s)(?![A-Za-z0-9+#]|\.[A-Za-z0-9])" % _alt, re.I)


PRETTY = {"node": "Node.js", "cicd": "CI/CD", "aws": "AWS", "gcp": "GCP", "ios": "iOS", "ui ux": "UI/UX", "javascript": "JavaScript",
          "typescript": "TypeScript", "postgresql": "PostgreSQL", "mongodb": "MongoDB", "graphql": "GraphQL", "tensorflow": "TensorFlow",
          "pytorch": "PyTorch", "fastapi": "FastAPI", "oauth": "OAuth", ".net": ".NET", "mysql": "MySQL", "nosql": "NoSQL",
          "github actions": "GitHub Actions", "gitlab ci": "GitLab CI", "power bi": "Power BI", "rest": "REST", "api": "API",
          "databricks": "Databricks", "llm": "LLM", "rag": "RAG", "nlp": "NLP", "ai": "AI", "tdd": "TDD", "seo": "SEO"}


def pretty(skill):
    k = skill.lower().strip().replace("_", " ")
    if k in PRETTY:
        return PRETTY[k]
    if len(k) <= 4 and k.isalpha():
        return k.upper()
    return " ".join(w if any(ch.isupper() for ch in w) else w[:1].upper() + w[1:] for w in skill.strip().replace("_", " ").split())


def disp(c):
    return c.replace("_", " ")


def find_skills(text):
    return {c for c, p in _PATS.items() if p.search(text or "")}


def present(skill, text):
    c = _ALIAS.get(skill.lower().strip())
    if c:
        return bool(_PATS[c].search(text))
    return bool(re.search(r"(?<![A-Za-z0-9])%s(?![A-Za-z0-9])" % re.escape(skill.lower().strip()), (text or "").lower()))


STOP = set("""a an the and or of to in on for with at by from as is are be this that will you your we our they their it its into
using use used work working experience years year strong ability skills skill required preferred plus including etc must should
can have has had more than other such also about across within who what when where which while not need needs looking role team
job candidate responsibilities requirements qualifications knowledge understanding good great able well new""".split())
VERBS = set("""built led developed designed created implemented managed reduced increased improved launched delivered automated optimized
mentored collaborated integrated migrated deployed analyzed wrote maintained architected established streamlined shipped owned drove
scaled tested coordinated resolved introduced raised cut saved published""".split())
IRREGULAR = {"built", "led", "wrote", "ran", "drove", "grew", "won", "set", "cut", "took", "held", "taught", "spun", "sold", "won", "chose"}
WEAK_OPENERS = {"worked", "working", "responsible", "helped", "assisted", "involved", "was", "were", "tasked", "duties", "did", "made", "handled", "used", "using", "participated"}


def has_action_verb(b):
    w = (b.split() or [""])[0].lower().rstrip(",:")
    if w in WEAK_OPENERS:
        return False
    return w in VERBS or w in IRREGULAR or (w.endswith("ed") and len(w) > 4)


NOISE = {"USA", "ASAP", "EOE", "CEO", "CTO", "PTO", "LLC", "INC", "USD", "EEO", "FAQ", "NYC", "UAE", "KSA", "PKR", "GPA", "MBA", "PHD", "BSC", "MSC", "THE", "AND", "FOR"}
PREF = re.compile(r"nice[ -]to[ -]have|preferred|bonus|a plus|\bplus\b|good to have|desirable|advantage", re.I)
REQ_H = re.compile(r"requirement|qualification|must|required|you have|what you|skills|looking for|experience|responsibilit", re.I)
SKIP_H = re.compile(r"benefit|perks|about us|about the company|we offer|salary|compensation|equal opportunity", re.I)
SENIOR = {"senior", "sr", "junior", "jr", "lead", "staff", "principal", "intern", "associate", "i", "ii", "iii"}


# ---------------------------------------------------------------- requirement extraction
def heuristic_requirements(jd):
    req, pref, mode = [], [], "req"
    for raw in jd.splitlines():
        line = raw.strip()
        if not line:
            continue
        if len(line) < 60 and (line.endswith(":") or line.isupper() or (not re.search(r"[.,;]", line) and len(line.split()) <= 5)):
            if SKIP_H.search(line):
                mode = "skip"
            elif PREF.search(line):
                mode = "pref"
            elif REQ_H.search(line):
                mode = "req"
            continue
        if mode == "skip":
            continue
        target = pref if (mode == "pref" or PREF.search(line)) else req
        found = {disp(c) for c in find_skills(line)}
        for t in re.findall(r"(?<![A-Za-z0-9])(?:[A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z]{3,8}\d?)(?![A-Za-z0-9])", line):
            if t.upper() not in NOISE and not find_skills(t) and t.lower() not in STOP:
                found.add(t.lower())
        # comma lists such as "Python, Databricks, Spark, SQL": capitalised short items are almost always tools/skills
        for seg in re.split(r"[.;]\s+|:\s*", line):
            items = [x.strip(" -*\u2022") for x in re.split(r",|\band\b|/", seg)]
            if len(items) >= 3 and all(0 < len(x.split()) <= 3 and len(x) <= 25 for x in items):
                for x in items:
                    if x[:1].isupper() and x.lower() not in STOP and x.upper() not in NOISE and not find_skills(x):
                        found.add(x.lower())
        target.extend(sorted(found))
    req = list(dict.fromkeys(req))
    pref = [s for s in dict.fromkeys(pref) if s not in req]
    if len(req) + len(pref) < 4:  # non-technical posting: fall back to the most frequent content words
        words = [w for w in re.findall(r"[a-z]{4,}", jd.lower()) if w not in STOP]
        req += [w for w, _ in Counter(words).most_common(12) if w not in req]
    years = None
    for m in re.finditer(r"(\d{1,2})\s*(?:\+|-\s*\d{1,2}|to\s*\d{1,2})?\s*\+?\s*(?:years?|yrs?)", jd, re.I):
        if 0 < int(m.group(1)) < 20:
            years = int(m.group(1))
            if "experience" in jd[m.start(): m.end() + 60].lower():
                break
    lv = [lvl for lvl, pat in ((3, r"ph\.?d|doctorate"), (2, r"master|m\.?sc|\bmba\b"), (1, r"bachelor|b\.?sc|b\.?s\b|b\.?tech|b\.?e\b|undergraduate")) if re.search(pat, jd, re.I)]
    title = ""
    m = re.search(r"(?:job title|position|role)\s*[:\-]\s*(.+)", jd, re.I)
    if m:
        title = m.group(1).strip()
    else:
        first = next((l.strip() for l in jd.splitlines() if l.strip()), "")
        if len(first.split()) <= 10 and not re.search(r"\b(we|are|is|looking|will)\b", first, re.I):
            title = first
    return {"title": title, "min_years": years, "education_level": min(lv) if lv else 0, "required": req, "preferred": pref}


def ai_requirements(jd):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None, "GEMINI_API_KEY not set - used rule-based requirement extraction."
    from .cv_import import GEMINI_MODELS
    prompt = ('Extract hiring requirements from this job posting. Return JSON only with keys: title (string), min_years (int or null), '
              'education_level ("none"|"bachelor"|"master"|"phd"), required_skills (list of short skill/tool/technology names), '
              'preferred_skills (list; nice-to-haves only). Do not invent anything not in the posting.\n\nPOSTING:\n' + jd[:15000])
    last = None
    for model in ([os.environ["GEMINI_MODEL"]] if os.environ.get("GEMINI_MODEL") else []) + GEMINI_MODELS:
        try:
            r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                              headers={"x-goog-api-key": key, "content-type": "application/json"},
                              json={"contents": [{"parts": [{"text": prompt}]}],
                                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}, timeout=45)
            if r.status_code in (404, 429, 503):
                last = f"{model}: HTTP {r.status_code}"
                continue
            r.raise_for_status()
            raw = re.sub(r"^```(?:json)?|```$", "", r.json()["candidates"][0]["content"]["parts"][0]["text"].strip(), flags=re.M).strip()
            d = json.loads(raw)
            lvl = {"bachelor": 1, "master": 2, "phd": 3}.get(str(d.get("education_level", "")).lower(), 0)
            req = [str(s).strip().lower() for s in d.get("required_skills") or [] if str(s).strip()]
            pref = [str(s).strip().lower() for s in d.get("preferred_skills") or [] if str(s).strip() and str(s).strip().lower() not in req]
            return {"title": str(d.get("title") or ""), "min_years": d.get("min_years") if isinstance(d.get("min_years"), int) else None,
                    "education_level": lvl, "required": req, "preferred": pref}, None
        except Exception as e:  # noqa: BLE001
            last = f"{type(e).__name__}: {str(e)[:100]}"
    return None, f"AI extraction failed ({last}) - used rule-based extraction."


_REQ_CACHE = {}  # sha1(jd) -> (timestamp, reqs, note, engine); re-scoring the same posting skips the slow AI call


def get_requirements(jd):
    key = hashlib.sha1(jd.encode("utf-8")).hexdigest()
    hit = _REQ_CACHE.get(key)
    if hit and time.time() - hit[0] < 900:
        return hit[1], hit[2], hit[3]
    reqs, note = ai_requirements(jd)
    engine = "ai-assisted" if reqs else "rules"
    if not reqs:
        reqs = heuristic_requirements(jd)
    if len(_REQ_CACHE) > 50:
        _REQ_CACHE.pop(next(iter(_REQ_CACHE)))
    _REQ_CACHE[key] = (time.time(), reqs, note, engine)
    return reqs, note, engine


# ---------------------------------------------------------------- candidate facts
def years_of_experience(exp):
    iv = sorted((e.start_date, e.end_date or date.today()) for e in exp if e.start_date)
    total, cs, ce = 0, None, None
    for s, e in iv:
        if ce is None or s > ce:
            if ce:
                total += (ce - cs).days
            cs, ce = s, e
        else:
            ce = max(ce, e)
    if ce:
        total += (ce - cs).days
    return total / 365.25


def edu_level(edu):
    t = " ".join(e.degree for e in edu).lower()
    return 3 if re.search(r"ph\.?d|doctor", t) else 2 if re.search(r"master|m\.?sc|\bmba\b|\bm\.?s\b", t) else 1 if re.search(r"bachelor|b\.?sc|\bb\.?s\b|b\.?tech|\bb\.?e\b|undergraduate", t) else 0


def _title_tokens(t):
    t = re.sub(r"full[\s-]?stack", "fullstack", t.lower())
    toks = {re.sub(r"developer|programmer", "engineer", w) for w in re.findall(r"[a-z]+", t)}
    return {w for w in toks if w not in STOP and w not in SENIOR and len(w) > 1}


def _stem(w):
    for suf in ("ing", "ed", "es", "s", "ly"):
        if len(w) > 5 and w.endswith(suf):
            return w[: -len(suf)]
    return w


# ---------------------------------------------------------------- scoring
def score_job_match(profile, email, jd):
    exp = list(profile.experience.all())
    edu = list(profile.education.all())
    skills = [s.name for s in profile.skills.all()]
    projects = list(profile.projects.all())
    certs = list(profile.certifications.all())

    reqs, engine_note, engine = get_requirements(jd)

    evidence = " ".join([profile.summary] + [f"{e.role} {e.description}" for e in exp] + [f"{p.title} {p.description}" for p in projects])
    listed = " ".join(skills + [c.title for c in certs] + [profile.headline])
    comps, tips = [], []

    def skill_block(name, items, maxpts):
        if not items:
            return None, [], [], []
        credit, hit, miss, listed_only = 0.0, [], [], []
        for s in items:
            if present(s, evidence):
                credit += 1; hit.append(s)
            elif present(s, listed):
                credit += 0.7; hit.append(s); listed_only.append(s)
            else:
                miss.append(s)
        comps.append({"name": name, "earned": round(maxpts * credit / len(items), 1), "max": maxpts,
                      "detail": f"{len(hit)}/{len(items)} found" + (f" ({len(listed_only)} only listed, not shown in experience)" if listed_only else "")})
        return credit, hit, miss, listed_only

    _, r_hit, r_miss, r_lo = skill_block("Required skills", reqs["required"], 35)
    _, p_hit, p_miss, p_lo = skill_block("Preferred skills", reqs["preferred"], 10)

    # title fit
    title_low = False
    jt = _title_tokens(reqs["title"])
    if jt:
        pool = [profile.headline] + [e.role for e in exp]
        best = max(pool, key=lambda s: len(jt & _title_tokens(s or "")) , default="")
        ratio = len(jt & _title_tokens(best or "")) / len(jt)
        comps.append({"name": "Job title fit", "earned": round(10 * min(1, ratio / 0.75), 1), "max": 10,
                      "detail": f"Posting: \"{reqs['title']}\" - closest on CV: \"{best or 'none'}\""})
        if ratio < 0.5:
            title_low = True
            tips.append("Your headline/roles don't resemble the job title. If it's accurate, set your headline to the target role.")

    # years
    if reqs["min_years"]:
        have = years_of_experience(exp)
        comps.append({"name": "Years of experience", "earned": round(10 * min(1, have / reqs["min_years"]), 1), "max": 10,
                      "detail": f"Posting asks {reqs['min_years']}+ yrs - your CV shows {have:.1f}"})
        if have < reqs["min_years"]:
            tips.append(f"The posting asks for {reqs['min_years']}+ years; your CV shows about {have:.1f}. Count internships/freelance work if they are real.")

    # education
    if reqs["education_level"]:
        lv = edu_level(edu)
        ok = lv >= reqs["education_level"]
        pts = 5 if ok else 2.5 if re.search(r"equivalent", jd, re.I) else 0
        comps.append({"name": "Education", "earned": pts, "max": 5, "detail": "Requirement met" if ok else "Posting asks for a higher degree level than your CV shows"})

    # responsibility overlap (weighted term recall, stems; skills excluded to avoid double counting)
    skill_words = {w for s in reqs["required"] + reqs["preferred"] for w in re.findall(r"[a-z]+", s.lower())}
    jd_terms = Counter(_stem(w) for w in re.findall(r"[a-z]{4,}", jd.lower()) if w not in STOP and w not in skill_words)
    top = jd_terms.most_common(40)
    cv_terms = {_stem(w) for w in re.findall(r"[a-z]{4,}", (evidence + " " + listed).lower())}
    if top:
        wsum = sum(1 + math.log(c) for _, c in top)
        recall = sum(1 + math.log(c) for w, c in top if w in cv_terms) / wsum
        comps.append({"name": "Responsibility overlap", "earned": round(10 * min(1, recall / 0.6), 1), "max": 10,
                      "detail": f"{round(recall * 100)}% of the posting's key terms appear in your CV (60% = full marks)"})

    # CV quality (20)
    bl = [re.sub(r"^[^\w]+", "", l).strip() for e in exp for l in e.description.splitlines() if l.strip()] or \
         [re.sub(r"^[^\w]+", "", l).strip() for p in projects for l in p.description.splitlines() if l.strip()]
    nb = len(bl)
    verb = sum(1 for b in bl if has_action_verb(b)) / nb if nb else 0
    num = sum(1 for b in bl if re.search(r"\d", b)) / nb if nb else 0
    sw = len((profile.summary or "").split())
    q = [(1, bool(profile.full_name), "Add your full name."), (1, bool(email), "Add an email address."), (1, bool(profile.phone), "Add a phone number."),
         (1, bool(profile.address), "Add your location."), (2, bool(profile.linkedin_url or profile.github_url), "Add a LinkedIn or GitHub link."),
         (1, bool(profile.headline), "Add a headline with your target title."), (1, 30 <= sw <= 120, f"Write a 30-120 word summary (now {sw})."),
         (2, bool(exp), "Add work experience."), (1, bool(edu), "Add education."), (1, bool(projects or certs), "Add projects or certifications."),
         (2, bool(exp) and all(e.description.strip() for e in exp), "Give every job 2-5 bullet points."),
         (3, verb >= 0.6, "Start more bullets with action verbs (Built, Led, Reduced)."), (3, num >= 0.3, "Add measurable results (%, users, time saved).")]
    comps.append({"name": "CV quality", "earned": sum(p for p, ok, _ in q if ok) / 2, "max": 10,
                  "detail": "Contact info, sections, bullet strength"})
    tips += [t for p, ok, t in q if not ok]

    weak = []  # individual bullets worth rewriting (needs a saved entry id)
    for kind, items in (("experience", exp), ("project", projects)):
        for it in items:
            iid = getattr(it, "id", None)
            if iid is None:
                continue
            where = f"{it.role} @ {it.company}" if kind == "experience" else f"Project: {it.title}"
            for line in (it.description or "").splitlines():
                t = re.sub(r"^[^\w]+", "", line).strip()
                if len(t.split()) < 5 or t.lower().startswith("tech:"):
                    continue
                issues = []
                if not has_action_verb(t):
                    issues.append("Doesn't start with a strong action verb")
                if not re.search(r"\d", t):
                    issues.append("No measurable result")
                if issues:
                    weak.append({"type": kind, "id": iid, "where": where, "text": t, "issues": issues})
    weak.sort(key=lambda w: -len(w["issues"]))

    lex = [s for s in skills if _ALIAS.get(s.lower().strip())]
    if len(lex) >= 6 and sum(1 for s in lex if present(s, evidence)) / len(lex) < 0.4:
        tips.append("Many listed skills never appear in your experience or project text. Show them in bullets - ATS and recruiters trust demonstrated skills more.")

    earned, mx = sum(c["earned"] for c in comps), sum(c["max"] for c in comps)
    score = round(100 * earned / mx) if mx else 0
    capped = False
    req_n = len(reqs["required"])
    if req_n and len(r_hit) / req_n < 0.2 and score > 35:  # almost none of the must-haves -> cannot be a good match
        score, capped = 35, True
        tips.insert(0, "Fewer than 20% of the required skills were found, so the score is capped at 35 regardless of other points.")
    return {
        "score": score,
        "grade": "Strong match" if score >= 80 else "Good match" if score >= 65 else "Partial match" if score >= 50 else "Weak match",
        "components": comps,
        "skills": {"required_found": [pretty(x) for x in r_hit], "required_missing": [pretty(x) for x in r_miss],
                   "preferred_found": [pretty(x) for x in p_hit], "preferred_missing": [pretty(x) for x in p_miss],
                   "listed_only": [pretty(x) for x in r_lo + p_lo]},
        "weak_bullets": weak[:5],
        "job_title": reqs["title"].strip()[:150],
        "title_mismatch": title_low,
        "tips": tips[:10],
        "capped": capped,
        "engine": engine,
        "engine_note": engine_note,
        "note": "Estimate for this one job posting from a fixed, visible rubric. Real ATS systems use private logic and mostly search/filter rather than score.",
    }
