from datetime import date
import re
import logging
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, viewsets, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import ats, cv_import, dashboard, llm

# If IsAdmin is inside profiles/permissions.py, change this import:
# from .permissions import IsAdmin
from rest_framework.permissions import IsAdminUser as IsAdmin

from .models import (
    Certification,
    CVProfile,
    Education,
    Experience,
    Project,
    Skill,
)
from .serializers import (
    CertificationSerializer,
    CVProfileSerializer,
    EducationSerializer,
    ExperienceSerializer,
    ProjectSerializer,
    SkillSerializer,
)

User = get_user_model()


class MyCVProfileView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/profile/me/
    The full CV a user sees & edits right after logging in.
    get_or_create so a brand-new signup doesn't 404 before filling anything in.

    On first creation only, full_name is seeded from the User's first/last name
    (set at signup) so the CV page isn't blank on a brand-new account. After that
    first save, this never runs again for that user — PATCHes from the edit form
    are always the source of truth going forward.
    """

    serializer_class = CVProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = CVProfile.objects.get_or_create(user=self.request.user)
        if created and not profile.full_name:
            full_name = f"{self.request.user.first_name} {self.request.user.last_name}".strip()
            if full_name:
                profile.full_name = full_name
                profile.save(update_fields=["full_name"])
        return profile


class AdminCVProfileDetailView(generics.RetrieveAPIView):
    """GET /api/admin/users/<id>/profile/ — admin viewing one user's CV."""

    serializer_class = CVProfileSerializer
    permission_classes = [IsAdmin]
    lookup_url_kwarg = "user_id"

    def get_object(self):
        user = get_object_or_404(User, pk=self.kwargs["user_id"])
        profile, _ = CVProfile.objects.get_or_create(user=user)
        return profile


class _OwnedChildViewSet(viewsets.ModelViewSet):
    """Base for CV child resources: always scoped to request.user's own profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get_profile(self):
        profile, _ = CVProfile.objects.get_or_create(user=self.request.user)
        return profile

    def get_queryset(self):
        return self.queryset.model.objects.filter(profile=self.get_profile())

    def perform_create(self, serializer):
        serializer.save(profile=self.get_profile())


class EducationViewSet(_OwnedChildViewSet):
    queryset = Education.objects.all()
    serializer_class = EducationSerializer


class ExperienceViewSet(_OwnedChildViewSet):
    queryset = Experience.objects.all()
    serializer_class = ExperienceSerializer


class SkillViewSet(_OwnedChildViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer


class ProjectViewSet(_OwnedChildViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class CertificationViewSet(_OwnedChildViewSet):
    queryset = Certification.objects.all()
    serializer_class = CertificationSerializer


class ImportCVView(APIView):
    """POST /api/profile/import-cv/  (multipart, field "file": .pdf or .docx)
    Extracts the text, parses it (AI if GEMINI_API_KEY is set, regex otherwise)
    and fills the user's CV profile. Existing top-level values are not overwritten."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        if f.size > 5 * 1024 * 1024:
            return Response({"detail": "File too large (max 5 MB)."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            text = cv_import.extract_text(f)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "Couldn't read that file."}, status=status.HTTP_400_BAD_REQUEST)
        if len(text.strip()) < 30:
            return Response({"detail": "No text found (scanned PDF?)."}, status=status.HTTP_400_BAD_REQUEST)
        warning, data = None, None
        try:
            data = cv_import.parse_with_ai(text)
            if data is None:
                warning = "AI is off (GEMINI_API_KEY not set or server not restarted) - used the basic parser."
        except Exception as e:
            logging.getLogger(__name__).exception("Gemini CV parsing failed")
            warning = f"AI parsing failed ({type(e).__name__}: {str(e)[:120]}) - used the basic parser."
        if data is None:
            data = cv_import.parse_fallback(text)
        profile, _ = CVProfile.objects.get_or_create(user=request.user)
        if dashboard.has_content(profile):  # safety net: keep what was there before the import
            dashboard.save_version(profile, f"Before import · {date.today():%b %d, %Y}", "auto")
        stats = cv_import.apply_to_profile(profile, data)
        out = CVProfileSerializer(profile, context={"request": request}).data
        return Response({**out, "import_warning": warning, "import_stats": stats})


class ATSScoreView(APIView):
    """POST /api/profile/ats-score/  {"job_description": "..."}  (required, >= 100 chars)"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        jd = str(request.data.get("job_description", "")).strip()[:20000]
        if len(jd) < 100:
            return Response({"detail": "Paste the full job description (at least ~100 characters)."}, status=status.HTTP_400_BAD_REQUEST)
        profile, _ = CVProfile.objects.get_or_create(user=request.user)
        return Response(dashboard.score_and_record(profile, request.user.email, jd))


class ATSApplyView(APIView):
    """POST /api/profile/ats-apply/  {"skills": ["Databricks"], "headline": "Data Engineer"}
    Adds skills the user confirmed they have (skips duplicates) and/or sets the headline."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import Skill

        profile, _ = CVProfile.objects.get_or_create(user=request.user)
        have = {n.lower() for n in profile.skills.values_list("name", flat=True)}
        for name in request.data.get("skills") or []:
            name = str(name).strip()[:100]
            if name and name.lower() not in have:
                Skill.objects.create(profile=profile, name=ats.pretty(name))
                have.add(name.lower())
        headline = str(request.data.get("headline") or "").strip()[:150]
        if headline:
            profile.headline = headline
            profile.save()
        out = {"profile": CVProfileSerializer(profile, context={"request": request}).data, "ats": None}
        jd = str(request.data.get("job_description") or "").strip()[:20000]
        if len(jd) >= 100:
            out["ats"] = dashboard.score_and_record(profile, request.user.email, jd)
        return Response(out)


class SkillBulletDraftView(APIView):
    """POST /api/profile/skill-bullet/ {skill, did, result?, where?} -> {"bullet": "..."}
    Drafts ONE resume bullet from facts the user typed. Never invents numbers or tools."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        skill = str(request.data.get("skill", "")).strip()[:100]
        did = str(request.data.get("did", "")).strip()[:400]
        result = str(request.data.get("result", "")).strip()[:200]
        where = str(request.data.get("where", "")).strip()[:200]
        if not skill or len(did) < 8:
            return Response({"detail": "Describe what you did with the skill (a short sentence)."}, status=status.HTTP_400_BAD_REQUEST)
        bullet, engine = None, "template"
        try:
            text = llm.gemini_text(
                "Write ONE resume bullet point (max 28 words) that starts with a strong past-tense action verb and naturally includes "
                f"the skill \"{skill}\". Use ONLY the facts below. Do not invent tools, numbers, percentages or results. "
                "Return just the bullet text, no bullet symbol, no quotes.\n"
                f"Role/project: {where or 'n/a'}\nWhat I did: {did}\nResult (optional): {result or 'none given'}"
            )
            if text:
                bullet, engine = text.splitlines()[0], "ai"
        except Exception:
            logging.getLogger(__name__).exception("Gemini bullet draft failed")
        if not bullet:
            bullet = did[0].upper() + did[1:]
            if result:
                bullet = bullet.rstrip(".") + ", " + result
        bullet = bullet.strip().lstrip("-*\u2022 ").strip("\"'").strip()[:300]
        if skill.lower() not in bullet.lower():
            bullet = bullet.rstrip(".") + f" using {skill}"
        return Response({"bullet": bullet, "engine": engine})


class AddBulletView(APIView):
    """POST /api/profile/add-bullet/ {target_type: experience|project, target_id, bullet, job_description?}"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import Experience, Project

        profile, _ = CVProfile.objects.get_or_create(user=request.user)
        bullet = str(request.data.get("bullet", "")).strip().lstrip("-*\u2022 ").strip()[:300]
        kind = request.data.get("target_type")
        model = {"experience": Experience, "project": Project}.get(kind)
        if not bullet or not model:
            return Response({"detail": "Missing bullet or target."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            obj = model.objects.get(pk=request.data.get("target_id"), profile=profile)
        except (model.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Entry not found. Save your profile first."}, status=status.HTTP_404_NOT_FOUND)
        old = (obj.description or "").rstrip()
        obj.description = (old + "\n" if old else "") + bullet
        obj.save()
        out = {"target": {"type": kind, "id": obj.pk, "description": obj.description}, "ats": None}
        jd = str(request.data.get("job_description") or "").strip()[:20000]
        if len(jd) >= 100:
            out["ats"] = dashboard.score_and_record(profile, request.user.email, jd)
        return Response(out)


_OPENERS = [(r"^(worked on|working on)\b", "Developed"), (r"^(responsible for|in charge of)\b", "Managed"),
            (r"^(helped|assisted)( with| in)?\b", "Supported"), (r"^(was involved in|were involved in|involved in|participated in)\b", "Contributed to"),
            (r"^(made|did)\b", "Built"), (r"^handled\b", "Managed"), (r"^(used|using)\b", "Applied")]
_NUM = re.compile(r"\d+(?:[.,]\d+)?")


class RewriteBulletView(APIView):
    """POST /api/profile/rewrite-bullet/ {text, result?, where?} -> {"bullet", "engine"}
    Rewrites ONE bullet. Rejects any AI output that adds numbers not present in the input."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        text = str(request.data.get("text", "")).strip()[:400]
        result = str(request.data.get("result", "")).strip()[:200]
        where = str(request.data.get("where", "")).strip()[:200]
        if len(text) < 8:
            return Response({"detail": "Nothing to rewrite."}, status=status.HTTP_400_BAD_REQUEST)
        bullet, engine = None, "template"
        try:
            out = llm.gemini_text(
                "Rewrite this resume bullet so it starts with a strong past-tense action verb and is concise (max 28 words). "
                "Keep every fact. Do NOT add any number, percentage, tool, technology or result that is not in the ORIGINAL or RESULT. "
                "Return just the rewritten bullet, no bullet symbol, no quotes.\n"
                f"Context: {where or 'n/a'}\nORIGINAL: {text}\nRESULT (optional): {result or 'none'}"
            )
            if out:
                cand = out.splitlines()[0].strip().lstrip("-*\u2022 ").strip("\"'").strip()
                if set(_NUM.findall(cand)) <= set(_NUM.findall(text + " " + result)):  # no invented numbers
                    bullet, engine = cand, "ai"
        except Exception:
            logging.getLogger(__name__).exception("Gemini bullet rewrite failed")
        if not bullet:  # basic rule-based rewrite
            bullet = text
            for pat, rep in _OPENERS:
                if re.match(pat, bullet, re.I):
                    bullet = re.sub(pat, rep, bullet, count=1, flags=re.I)
                    break
            bullet = bullet[0].upper() + bullet[1:]
            if result:
                bullet = bullet.rstrip(".") + ", " + result
        return Response({"bullet": bullet[:300], "engine": engine})


class ReplaceBulletView(APIView):
    """POST /api/profile/replace-bullet/ {target_type, target_id, old, new, job_description?}"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import Experience, Project

        profile, _ = CVProfile.objects.get_or_create(user=request.user)
        model = {"experience": Experience, "project": Project}.get(request.data.get("target_type"))
        new = str(request.data.get("new", "")).strip().lstrip("-*\u2022 ").strip()[:300]
        old = str(request.data.get("old", "")).strip()
        if not model or not new or not old:
            return Response({"detail": "Missing data."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            obj = model.objects.get(pk=request.data.get("target_id"), profile=profile)
        except (model.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Entry not found. Save your profile first."}, status=status.HTTP_404_NOT_FOUND)
        norm = lambda l: re.sub(r"^[^\w]+", "", l).strip()
        lines, hit = (obj.description or "").splitlines(), False
        for i, l in enumerate(lines):
            if not hit and norm(l) == norm(old):
                lines[i], hit = new, True
        if not hit:
            return Response({"detail": "That bullet changed. Re-run the check."}, status=status.HTTP_404_NOT_FOUND)
        obj.description = "\n".join(lines)
        obj.save()
        out = {"target": {"type": request.data.get("target_type"), "id": obj.pk, "description": obj.description}, "ats": None}
        jd = str(request.data.get("job_description") or "").strip()[:20000]
        if len(jd) >= 100:
            out["ats"] = dashboard.score_and_record(profile, request.user.email, jd)
        return Response(out)
