from rest_framework import serializers
from .models import (
    Certification,
    CVProfile,
    Education,
    Experience,
    Project,
    Skill,
)


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = [
            "id",
            "institute",
            "degree",
            "start_year",
            "end_year",
            "description",
        ]


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = [
            "id",
            "company",
            "role",
            "start_date",
            "end_date",
            "is_current",
            "description",
        ]


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name", "level"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "title", "description", "link", "image"]


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ["id", "title", "issuer", "year"]


class CVProfileSerializer(serializers.ModelSerializer):
    education = EducationSerializer(many=True, read_only=True)
    experience = ExperienceSerializer(many=True, read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    projects = ProjectSerializer(many=True, read_only=True)
    certifications = CertificationSerializer(many=True, read_only=True)

    class Meta:
        model = CVProfile
        fields = [
            "id",
            "full_name",
            "headline",
            "photo",
            "phone",
            "address",
            "date_of_birth",
            "summary",
            "linkedin_url",
            "github_url",
            "portfolio_url",
            "education",
            "experience",
            "skills",
            "projects",
            "certifications",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]