import time

from django.core.management.base import BaseCommand

from jobs.models import Job
from jobs.services import get_embeddings


class Command(BaseCommand):
    help = "Re-computes every job embedding with the current (Gemini) model. Safe to stop and resume with --skip N."

    def add_arguments(self, parser):
        parser.add_argument("--skip", type=int, default=0, help="jobs already done (the count printed last time)")

    def handle(self, *args, **opts):
        ids = list(Job.objects.order_by("pk").values_list("pk", flat=True))
        done = opts["skip"]
        total = len(ids)
        for i in range(done, total, 25):
            batch = ids[i:i + 25]
            jobs = list(Job.objects.filter(pk__in=batch).defer("embedding"))
            vecs = get_embeddings([f"{j.title} {j.company} {(j.description or '')[:300]}" for j in jobs])
            for j, v in zip(jobs, vecs):
                j.embedding = v
            Job.objects.bulk_update(jobs, ["embedding"])
            done = min(i + 25, total)
            self.stdout.write(f"  {done}/{total}  (resume with --skip {done} if it stops)")
            if done < total:
                time.sleep(18)  # free-tier pacing
        self.stdout.write(self.style.SUCCESS("Re-embedded all jobs."))
