import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0003_dashboard_versions'),
    ]

    operations = [
        migrations.CreateModel(
            name='CareerGoal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fields', models.JSONField(blank=True, default=list)),
                ('work_mode', models.CharField(blank=True, max_length=20)),
                ('job_type', models.CharField(blank=True, max_length=20)),
                ('goals', models.JSONField(blank=True, default=list)),
                ('timeline', models.CharField(blank=True, max_length=30)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('profile', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='career_goal', to='profiles.cvprofile')),
            ],
        ),
    ]
