from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from . import dashboard
from .models import Application, Company, Contact, Interaction, StatusChange

# Thursday, Nov 26, 2026, noon in Boston. The week starts Monday, Nov 23.
NOW = timezone.make_aware(datetime(2026, 11, 26, 12, 0))
TODAY = date(2026, 11, 26)


def app(role="Data Co-op", status="saved", changed_days_ago=None, company="Acme", **kwargs):
    """Create an application. changed_days_ago backdates its status history to that many days before NOW."""
    a = Application.objects.create(
        company=Company.objects.get_or_create(name=company)[0], role_title=role, status=status, **kwargs
    )
    if changed_days_ago is not None:
        a.status_changes.update(changed_at=NOW - timedelta(days=changed_days_ago))
    return a


def follow_up(days_from_today, done=False, company="Bluefin", notes="Say thanks"):
    company = Company.objects.get_or_create(name=company)[0] if company else None
    contact = Contact.objects.create(name="Priya", company=company)
    return Interaction.objects.create(
        contact=contact, date=TODAY - timedelta(days=7), notes=notes,
        follow_up_date=TODAY + timedelta(days=days_from_today), follow_up_done=done,
    )


class WeeklyTests(TestCase):
    def weekly(self):
        return dashboard.dashboard(NOW)["weekly"]

    def test_eight_weeks_oldest_first_starting_on_mondays(self):
        weeks = self.weekly()
        self.assertEqual(len(weeks), 8)
        self.assertEqual(weeks[0]["week_start"], date(2026, 10, 5))
        self.assertEqual(weeks[-1]["week_start"], date(2026, 11, 23))

    def test_counts_by_typed_date_applied(self):
        app(status="applied", date_applied=date(2026, 11, 24))  # this week
        app(status="applied", date_applied=date(2026, 11, 22))  # Sunday: last week
        app(status="applied", date_applied=date(2026, 9, 1))  # older than the chart
        counts = [w["count"] for w in self.weekly()]
        self.assertEqual(counts[-2:], [1, 1])
        self.assertEqual(sum(counts), 2)

    def test_falls_back_to_when_the_card_was_moved_to_applied(self):
        app(status="applied", changed_days_ago=1)  # no typed date; moved yesterday
        self.assertEqual(self.weekly()[-1]["count"], 1)

    def test_typed_date_wins_over_the_move_date(self):
        app(status="applied", changed_days_ago=1, date_applied=date(2026, 11, 16))
        counts = [w["count"] for w in self.weekly()]
        self.assertEqual(counts[-2:], [1, 0])

    def test_saved_applications_are_not_counted(self):
        app(status="saved", changed_days_ago=1)
        self.assertEqual(sum(w["count"] for w in self.weekly()), 0)


class StatsTests(TestCase):
    def stats(self):
        return dashboard.dashboard(NOW)["stats"]

    def test_active_excludes_saved_rejected_and_withdrawn(self):
        for status in ["saved", "applied", "screen", "interview", "offer", "rejected", "withdrawn"]:
            app(role=status, status=status)
        self.assertEqual(self.stats()["active_applications"], 4)

    def test_applied_this_week(self):
        app(status="applied", date_applied=date(2026, 11, 23))
        app(status="interview", date_applied=date(2026, 11, 25))
        app(status="applied", date_applied=date(2026, 11, 20))
        self.assertEqual(self.stats()["applied_this_week"], 2)

    def test_average_match_is_rounded_and_ignores_unscored(self):
        app(match_score=70)
        app(match_score=65)
        app()  # no score
        stats = self.stats()
        self.assertEqual((stats["average_match"], stats["scored_applications"]), (68, 2))  # 67.5 rounds to 68

    def test_average_match_is_null_with_no_scores(self):
        self.assertIsNone(self.stats()["average_match"])

    def test_interview_share_matches_the_funnel(self):
        app(role="a", status="applied")
        app(role="b", status="applied")
        a = app(role="c", status="applied")
        a.status = "interview"
        a.save()
        a.status = "rejected"
        a.save()  # rejected after interview still counts as having reached it
        stats = self.stats()
        self.assertEqual((stats["reached_interview"], stats["applied_total"]), (1, 3))
        self.assertEqual(stats["reached_interview_percent"], 33)

    @override_settings(WEEKLY_APPLICATION_GOAL=8)
    def test_weekly_goal_comes_from_settings(self):
        self.assertEqual(self.stats()["weekly_goal"], 8)


class FollowUpTests(TestCase):
    def follow_ups(self):
        return dashboard.dashboard(NOW)["follow_ups"]

    def test_overdue_and_upcoming_soonest_first_with_days_until(self):
        follow_up(3, notes="later")
        follow_up(-2, notes="late")
        follow_up(0, notes="today")
        rows = self.follow_ups()
        self.assertEqual([(r["notes"], r["days_until"]) for r in rows], [("late", -2), ("today", 0), ("later", 3)])

    def test_beyond_the_window_and_done_ones_are_hidden(self):
        follow_up(15)
        follow_up(-1, done=True)
        follow_up(14, notes="last day in window")
        self.assertEqual([r["notes"] for r in self.follow_ups()], ["last day in window"])

    def test_contact_without_a_company(self):
        follow_up(1, company=None)
        self.assertEqual(self.follow_ups()[0]["company_name"], "")


class DeadlineTests(TestCase):
    def test_only_saved_roles_closing_within_the_window(self):
        app(role="soon", deadline=TODAY + timedelta(days=4))
        app(role="today", deadline=TODAY)
        app(role="too far", deadline=TODAY + timedelta(days=15))
        app(role="passed", deadline=TODAY - timedelta(days=1))
        app(role="already applied", status="applied", deadline=TODAY + timedelta(days=2))
        rows = dashboard.dashboard(NOW)["deadlines"]
        self.assertEqual([(r["role_title"], r["days_until"]) for r in rows], [("today", 0), ("soon", 4)])


class GoneQuietTests(TestCase):
    def quiet(self):
        return [(r["role_title"], r["days_quiet"]) for r in dashboard.dashboard(NOW)["gone_quiet"]]

    def test_waiting_with_no_change_for_14_days_or_more(self):
        app(role="quiet", status="applied", changed_days_ago=20)
        app(role="exactly 14", status="screen", changed_days_ago=14)
        app(role="recent", status="applied", changed_days_ago=13)
        self.assertEqual(self.quiet(), [("quiet", 20), ("exactly 14", 14)])  # quietest first

    def test_only_applied_and_screen_count(self):
        app(role="interview", status="interview", changed_days_ago=30)
        app(role="saved", status="saved", changed_days_ago=30)
        app(role="rejected", status="rejected", changed_days_ago=30)
        self.assertEqual(self.quiet(), [])

    def test_moving_the_card_resets_the_clock(self):
        a = app(role="moved", status="applied", changed_days_ago=30)
        a.status = "screen"
        a.save()  # a new history row, dated now
        StatusChange.objects.filter(application=a, to_status="screen").update(changed_at=NOW - timedelta(days=2))
        self.assertEqual(self.quiet(), [])


class DashboardEndpointTests(TestCase):
    def test_returns_every_section(self):
        client = APIClient()
        client.force_authenticate(get_user_model().objects.create_user("paulina"))
        app(status="applied", date_applied=timezone.localdate())
        body = client.get(reverse("api_dashboard")).json()
        self.assertEqual(
            set(body), {"today", "stats", "funnel", "weekly", "follow_ups", "deadlines", "gone_quiet"}
        )
        self.assertEqual(body["stats"]["applied_this_week"], 1)
        self.assertEqual([stage["label"] for stage in body["funnel"]], ["Applied", "Screen / OA", "Interview", "Offer"])
