import requests
from django.core.management.base import BaseCommand

from jobs.models import Job
from jobs.services import get_embeddings


class Command(BaseCommand):
    help = "Fetches live job listings from RemoteOK, Arbeitnow, Remotive, and Jobicy; embeds and upserts them."

    def handle(self, *args, **kwargs):
        total_created, total_updated = 0, 0

        for source_name, fetch_fn in [
            ("remoteok", self.fetch_remoteok),
            ("arbeitnow", self.fetch_arbeitnow),
            ("remotive", self.fetch_remotive),
            ("jobicy", self.fetch_jobicy),
        ]:
            self.stdout.write(f"Fetching from {source_name}...")
            try:
                listings = fetch_fn()
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  {source_name} failed: {e}"))
                continue

            created, updated = self.save_listings(listings, source_name)
            total_created += created
            total_updated += updated
            self.stdout.write(f"  {source_name}: {created} created, {updated} updated")

        self.stdout.write(
            self.style.SUCCESS(f"Sync complete. Total created: {total_created}, updated: {total_updated}")
        )

    def save_listings(self, listings, source_name):
        created, updated = 0, 0
        listings = [j for j in listings if j.get("title") and j.get("url")]
        # one batched API call per 50 jobs instead of one call per job
        vectors = get_embeddings([f"{j['title']} {j.get('company', '')} {j.get('tags', '')}" for j in listings])
        for job, vector in zip(listings, vectors):
            _, was_created = Job.objects.update_or_create(
                job_url=job["url"],
                defaults={
                    "title": job["title"],
                    "company": job.get("company", ""),
                    "location": job.get("location", ""),
                    "is_remote": job.get("is_remote", True),
                    "salary": job.get("salary", ""),
                    "description": job.get("description", "")[:5000],
                    "source": source_name,
                    "embedding": vector,
                },
            )
            created += was_created
            updated += not was_created
        return created, updated

    # ---- Source-specific fetchers, each normalized to the same shape ----

    def fetch_remoteok(self):
        r = requests.get(
            "https://remoteok.com/api",
            headers={"User-Agent": "DjangoJobMatcher"},
            timeout=15,
        )
        r.raise_for_status()
        raw = r.json()[1:]  # index 0 is metadata
        return [
            {
                "title": j.get("position"),
                "company": j.get("company", ""),
                "location": j.get("location", ""),
                "is_remote": True,
                "url": j.get("url"),
                "description": j.get("description", ""),
                "tags": " ".join(j.get("tags", [])),
            }
            for j in raw
        ]

    def fetch_arbeitnow(self):
        r = requests.get("https://www.arbeitnow.com/api/job-board-api", timeout=15)
        r.raise_for_status()
        raw = r.json().get("data", [])
        return [
            {
                "title": j.get("title"),
                "company": j.get("company_name", ""),
                "location": j.get("location", ""),
                "is_remote": j.get("remote", False),
                "url": j.get("url"),
                "description": j.get("description", ""),
                "tags": " ".join(j.get("tags", [])),
            }
            for j in raw
        ]

    def fetch_remotive(self):
        r = requests.get("https://remotive.com/api/remote-jobs", timeout=15)
        r.raise_for_status()
        raw = r.json().get("jobs", [])
        return [
            {
                "title": j.get("title"),
                "company": j.get("company_name", ""),
                "location": j.get("candidate_required_location", ""),
                "is_remote": True,
                "url": j.get("url"),
                "description": j.get("description", ""),
                "salary": j.get("salary", ""),
                "tags": " ".join(j.get("tags", [])),
            }
            for j in raw
        ]

    def fetch_jobicy(self):
        r = requests.get(
            "https://jobicy.com/api/v2/remote-jobs",
            params={"count": 50},
            timeout=15,
        )
        r.raise_for_status()
        raw = r.json().get("jobs", [])
        return [
            {
                "title": j.get("jobTitle"),
                "company": j.get("companyName", ""),
                "location": j.get("jobGeo", ""),
                "is_remote": True,
                "url": j.get("url"),
                "description": j.get("jobExcerpt", ""),
                "salary": j.get("annualSalaryMin") and f"${j.get('annualSalaryMin')}-{j.get('annualSalaryMax')}" or "",
                "tags": " ".join(j.get("jobIndustry", []) or []),
            }
            for j in raw
        ]