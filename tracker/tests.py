"""Model and service tests: rules that hold no matter which UI (or script) changes the data.

The API's own tests are in test_api.py, the dashboard's in test_dashboard.py, the matcher's in test_matching.py.
"""

from django.db import IntegrityError, transaction
from django.test import TestCase

from . import services
from .models import Application, Company, Resume, StatusChange


def make_application(**kwargs):
    company, _ = Company.objects.get_or_create(name="Acme Health")
    return Application.objects.create(company=company, role_title="Data Co-op", **kwargs)


class StatusHistoryTests(TestCase):
    def test_creating_an_application_logs_the_first_status(self):
        app = make_application()
        changes = list(app.status_changes.values_list("from_status", "to_status"))
        self.assertEqual(changes, [("", "saved")])

    def test_changing_status_logs_a_new_row(self):
        app = make_application()
        app.status = Application.Status.APPLIED
        app.save()
        changes = list(app.status_changes.values_list("from_status", "to_status"))
        self.assertEqual(changes, [("", "saved"), ("saved", "applied")])

    def test_saving_without_changing_status_logs_nothing(self):
        app = make_application()
        app.role_title = "Data Engineering Co-op"
        app.save()
        self.assertEqual(app.status_changes.count(), 1)

    def test_status_change_is_logged_when_loaded_fresh_from_database(self):
        make_application()
        app = Application.objects.get()  # simulates a view loading it, then editing it
        app.status = Application.Status.INTERVIEW
        app.save()
        self.assertEqual(app.status_changes.last().from_status, "saved")


class ResumeTests(TestCase):
    def test_only_one_resume_can_be_active(self):
        Resume.objects.create(name="v1", text="python", is_active=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Resume.objects.create(name="v2", text="sql", is_active=True)

    def test_many_inactive_resumes_are_allowed(self):
        Resume.objects.create(name="v1", text="python")
        Resume.objects.create(name="v2", text="sql")
        self.assertEqual(Resume.objects.count(), 2)


class FunnelTests(TestCase):
    def counts(self):
        from . import services
        return [(row["label"], row["count"]) for row in services.funnel()]

    def move(self, app, *statuses):
        for status in statuses:
            app.status = status
            app.save()

    def test_empty_funnel_is_all_zero(self):
        from . import services
        self.assertEqual(self.counts(), [("Applied", 0), ("Screen / OA", 0), ("Interview", 0), ("Offer", 0)])
        self.assertTrue(all(row["percent"] == 0 for row in services.funnel()))

    def test_saved_applications_do_not_count_as_applied(self):
        make_application()
        self.assertEqual(self.counts()[0], ("Applied", 0))

    def test_each_stage_counts_applications_that_reached_it(self):
        self.move(make_application(), "applied")
        self.move(make_application(), "applied", "screen")
        self.move(make_application(), "applied", "screen", "interview")
        self.assertEqual(self.counts(), [("Applied", 3), ("Screen / OA", 2), ("Interview", 1), ("Offer", 0)])

    def test_rejected_after_interview_still_counts_as_reaching_interview(self):
        self.move(make_application(), "applied", "screen", "interview", "rejected")
        self.assertEqual(self.counts()[2], ("Interview", 1))

    def test_skipping_stages_counts_for_every_earlier_stage(self):
        self.move(make_application(), "interview")  # dragged straight from Saved to Interview
        self.assertEqual(self.counts(), [("Applied", 1), ("Screen / OA", 1), ("Interview", 1), ("Offer", 0)])

    def test_moving_back_and_forth_counts_an_application_once(self):
        self.move(make_application(), "applied", "saved", "applied")
        self.assertEqual(self.counts()[0], ("Applied", 1))

    def test_rejected_without_applying_is_not_counted(self):
        self.move(make_application(), "rejected")
        self.assertEqual(self.counts()[0], ("Applied", 0))

    def test_percentages_are_relative_to_applied(self):
        from . import services
        self.move(make_application(), "applied", "screen")
        self.move(make_application(), "applied")
        percents = [row["percent"] for row in services.funnel()]
        self.assertEqual(percents, [100, 50, 0, 0])


class ScoringServiceTests(TestCase):
    def test_no_score_without_an_active_resume(self):
        self.assertIsNone(services.score_for("Python and SQL", None))

    def test_no_score_without_a_job_description(self):
        resume = Resume.objects.create(name="Mine", text="Python")
        self.assertIsNone(services.score_for("   ", resume))
        self.assertIsNone(services.score_for("", resume))

    def test_rescoring_does_not_write_status_history(self):
        make_application(job_description="Python and SQL")
        before = StatusChange.objects.count()
        services.activate(Resume.objects.create(name="Mine", text="Python"))  # rescores everything
        self.assertEqual(StatusChange.objects.count(), before)
        self.assertEqual(Application.objects.get().match_score, 50)
