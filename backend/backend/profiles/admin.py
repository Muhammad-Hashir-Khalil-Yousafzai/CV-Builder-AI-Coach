from django.contrib import admin
from .models import CVProfile, Education, Experience, Skill, Project, Certification, CareerGoal

admin.site.register(CVProfile)
admin.site.register(Education)
admin.site.register(Experience)
admin.site.register(Skill)
admin.site.register(Project)
admin.site.register(Certification)
admin.site.register(CareerGoal)
