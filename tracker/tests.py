from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.urls import reverse

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


class LoginTests(TestCase):
    def test_board_requires_login(self):
        response = self.client.get(reverse("board"))
        self.assertRedirects(response, "/accounts/login/?next=/")

    def test_move_requires_login(self):
        app = make_application()
        response = self.client.post(reverse("application_move", args=[app.pk]), {"status": "applied"})
        self.assertEqual(response.status_code, 302)
        app.refresh_from_db()
        self.assertEqual(app.status, "saved")


class LoggedInTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("tester", password="not-a-real-password")
        self.client.force_login(self.user)


class BoardTests(LoggedInTestCase):
    def test_board_shows_applications_in_their_columns(self):
        make_application(status=Application.Status.APPLIED)
        response = self.client.get(reverse("board"))
        self.assertContains(response, "Data Co-op")
        applied = [c for c in response.context["columns"] if c["value"] == "applied"][0]
        self.assertEqual(len(applied["applications"]), 1)


class MoveTests(LoggedInTestCase):
    def test_move_changes_status_and_logs_history(self):
        app = make_application()
        response = self.client.post(
            reverse("application_move", args=[app.pk]), {"status": "interview", "ids": str(app.pk)}
        )
        self.assertEqual(response.status_code, 204)
        app.refresh_from_db()
        self.assertEqual(app.status, "interview")
        self.assertEqual(app.status_changes.last().to_status, "interview")

    def test_move_saves_order_within_the_column(self):
        first = make_application(status=Application.Status.APPLIED)
        second = make_application(status=Application.Status.APPLIED)
        self.client.post(
            reverse("application_move", args=[second.pk]),
            {"status": "applied", "ids": f"{second.pk},{first.pk}"},
        )
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual((second.position, first.position), (0, 1))

    def test_move_rejects_an_unknown_status(self):
        app = make_application()
        response = self.client.post(reverse("application_move", args=[app.pk]), {"status": "bogus"})
        self.assertEqual(response.status_code, 400)

    def test_move_rejects_non_numeric_ids(self):
        app = make_application()
        response = self.client.post(reverse("application_move", args=[app.pk]), {"status": "applied", "ids": "1,x"})
        self.assertEqual(response.status_code, 400)

    def test_move_rejects_get_requests(self):
        app = make_application()
        self.assertEqual(self.client.get(reverse("application_move", args=[app.pk])).status_code, 405)

    def test_move_needs_a_csrf_token(self):
        strict = Client(enforce_csrf_checks=True)
        strict.force_login(self.user)
        app = make_application()
        response = strict.post(reverse("application_move", args=[app.pk]), {"status": "applied"})
        self.assertEqual(response.status_code, 403)


class ApplicationFormTests(LoggedInTestCase):
    def test_create_application_creates_the_company_too(self):
        response = self.client.post(
            reverse("application_create"),
            {"company_name": "New Co", "role_title": "ML Co-op", "status": "saved"},
        )
        self.assertRedirects(response, reverse("board"))
        self.assertEqual(Application.objects.get().company.name, "New Co")

    def test_create_application_reuses_an_existing_company(self):
        Company.objects.create(name="New Co")
        self.client.post(
            reverse("application_create"),
            {"company_name": "New Co", "role_title": "ML Co-op", "status": "saved"},
        )
        self.assertEqual(Company.objects.filter(name="New Co").count(), 1)

    def test_edit_form_prefills_the_company_name(self):
        app = make_application()
        response = self.client.get(reverse("application_update", args=[app.pk]))
        self.assertContains(response, 'value="Acme Health"')

    def test_delete_removes_the_application(self):
        app = make_application()
        self.client.post(reverse("application_delete", args=[app.pk]))
        self.assertFalse(Application.objects.exists())
