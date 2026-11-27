"""Numbers and lists for the dashboard, computed from the database in one place.

`today` and `now` are parameters (defaulting to the real date) so tests can pin the date.
"""

from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count, Max, Min, Q
from django.utils import timezone

from . import services
from .models import Application, Interaction

REMINDER_WINDOW_DAYS = 14  # follow-ups and deadlines this many days ahead are shown
QUIET_AFTER_DAYS = 14  # an application with no status change for this long has "gone quiet"
WEEKS_SHOWN = 8

ACTIVE = ["applied", "screen", "interview", "offer"]  # applied and not yet closed
APPLIED_OR_LATER = ACTIVE  # reaching any of these means "applied", same as the funnel's first stage
WAITING = ["applied", "screen"]  # statuses where silence from the company means it may need a nudge


def week_start(day):
    return day - timedelta(days=day.weekday())  # Monday


def applied_dates():
    """The date each application was applied, for the weekly chart and "applied this week".

    Uses date_applied when the user filled it in. Otherwise falls back to the first time the card was
    moved to Applied or later, so dragging a card on the board counts even without typing a date.
    """
    rows = Application.objects.annotate(
        first_applied_at=Min("status_changes__changed_at", filter=Q(status_changes__to_status__in=APPLIED_OR_LATER))
    ).values_list("date_applied", "first_applied_at")
    dates = []
    for typed, first_change in rows:
        if typed:
            dates.append(typed)
        elif first_change:
            dates.append(timezone.localdate(first_change))
    return dates


def weekly_counts(dates, today):
    """Applications per week (Monday to Sunday) for the last WEEKS_SHOWN weeks, oldest first."""
    this_week = week_start(today)
    starts = [this_week - timedelta(weeks=n) for n in reversed(range(WEEKS_SHOWN))]
    counts = dict.fromkeys(starts, 0)
    for day in dates:
        start = week_start(day)
        if start in counts:
            counts[start] += 1
    return [{"week_start": start, "count": counts[start]} for start in starts]


def stats(dates, funnel, today):
    scores = Application.objects.filter(match_score__isnull=False).aggregate(average=Avg("match_score"), n=Count("id"))
    applied, interview = funnel[0], funnel[2]
    return {
        "active_applications": Application.objects.filter(status__in=ACTIVE).count(),
        "applied_this_week": sum(1 for day in dates if week_start(day) == week_start(today)),
        "weekly_goal": settings.WEEKLY_APPLICATION_GOAL,
        "applied_total": applied["count"],
        "reached_interview": interview["count"],
        "reached_interview_percent": interview["percent"],
        "average_match": round(scores["average"]) if scores["average"] is not None else None,
        "scored_applications": scores["n"],
    }


def follow_ups(today):
    """Open follow-ups that are overdue or due within the window, soonest first."""
    soon = today + timedelta(days=REMINDER_WINDOW_DAYS)
    pending = (
        Interaction.objects.filter(follow_up_done=False, follow_up_date__isnull=False, follow_up_date__lte=soon)
        .select_related("contact__company")
        .order_by("follow_up_date", "id")
    )
    return [
        {
            "id": interaction.id,
            "contact_id": interaction.contact_id,
            "contact_name": interaction.contact.name,
            "company_name": interaction.contact.company.name if interaction.contact.company else "",
            "kind": interaction.kind,
            "notes": interaction.notes,
            "follow_up_date": interaction.follow_up_date,
            "days_until": (interaction.follow_up_date - today).days,  # negative means overdue
        }
        for interaction in pending
    ]


def deadlines(today):
    """Saved roles (not applied to yet) whose deadline is within the window."""
    soon = today + timedelta(days=REMINDER_WINDOW_DAYS)
    applications = (
        Application.objects.filter(status="saved", deadline__gte=today, deadline__lte=soon)
        .select_related("company")
        .order_by("deadline")
    )
    return [
        {
            "id": a.id,
            "role_title": a.role_title,
            "company_name": a.company.name,
            "deadline": a.deadline,
            "days_until": (a.deadline - today).days,
            "match_score": a.match_score,
        }
        for a in applications
    ]


def gone_quiet(now):
    """Applications waiting on the company with no status change for QUIET_AFTER_DAYS or more."""
    today = timezone.localdate(now)
    applications = (
        Application.objects.filter(status__in=WAITING)
        .annotate(last_change=Max("status_changes__changed_at"))
        .filter(last_change__lte=now - timedelta(days=QUIET_AFTER_DAYS))
        .select_related("company")
        .order_by("last_change")
    )
    return [
        {
            "id": a.id,
            "role_title": a.role_title,
            "company_name": a.company.name,
            "status": a.status,
            "date_applied": a.date_applied,
            "days_quiet": (today - timezone.localdate(a.last_change)).days,
        }
        for a in applications
    ]


def dashboard(now=None):
    now = now or timezone.now()
    today = timezone.localdate(now)
    dates = applied_dates()
    funnel = services.funnel()
    return {
        "today": today,
        "stats": stats(dates, funnel, today),
        "funnel": funnel,
        "weekly": weekly_counts(dates, today),
        "follow_ups": follow_ups(today),
        "deadlines": deadlines(today),
        "gone_quiet": gone_quiet(now),
    }
