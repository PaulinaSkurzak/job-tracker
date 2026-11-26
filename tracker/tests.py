from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Application, Company, Resume


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
