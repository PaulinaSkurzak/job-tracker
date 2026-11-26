"""Glue between the pure matcher (matching.py) and the database."""

from django.db import transaction

from . import matching
from .models import Application, Resume


def active_resume():
    return Resume.objects.filter(is_active=True).first()


def score_for(job_description, resume):
    """Match score for one job description, or None if there is nothing to compare."""
    if resume is None or not (job_description or "").strip():
        return None
    return matching.match(job_description, resume.text).score


def rescore_all():
    """Recompute every application's stored score against the active resume.

    Needed whenever the active resume changes, otherwise stored scores would go stale.
    """
    resume = active_resume()
    applications = list(Application.objects.all())
    for application in applications:
        application.match_score = score_for(application.job_description, resume)
    # bulk_update skips Application.save(), which is right: no status changed, so no history row.
    Application.objects.bulk_update(applications, ["match_score"])


@transaction.atomic
def activate(resume):
    """Make this the one active resume, then refresh all scores."""
    # Deactivate the others first: the database allows only one active resume at a time.
    Resume.objects.exclude(pk=resume.pk).filter(is_active=True).update(is_active=False)
    resume.is_active = True
    resume.save()
    rescore_all()
