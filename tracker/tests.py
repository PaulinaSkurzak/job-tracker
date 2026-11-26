from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from .models import Application, Company, Contact, Interaction, Resume


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


def make_contact(name="Alex Rivera", **kwargs):
    return Contact.objects.create(name=name, **kwargs)


def days_from_today(days):
    return timezone.localdate() + timedelta(days=days)


class ContactTests(LoggedInTestCase):
    def test_contact_pages_require_login(self):
        contact = make_contact()
        anonymous = Client()
        for name, args in [("contact_list", []), ("contact_detail", [contact.pk]), ("dashboard", [])]:
            self.assertEqual(anonymous.get(reverse(name, args=args)).status_code, 302, name)

    def test_create_contact_with_company_and_application(self):
        app = make_application()
        response = self.client.post(
            reverse("contact_create"),
            {"name": "Sam Lee", "company_name": "Deloitte", "applications": [app.pk]},
        )
        contact = Contact.objects.get()
        self.assertRedirects(response, reverse("contact_detail", args=[contact.pk]))
        self.assertEqual(contact.company.name, "Deloitte")
        self.assertEqual(list(contact.applications.all()), [app])

    def test_contact_company_is_optional(self):
        self.client.post(reverse("contact_create"), {"name": "Sam Lee", "company_name": ""})
        self.assertIsNone(Contact.objects.get().company)

    def test_list_shows_interaction_count_and_last_contact(self):
        contact = make_contact()
        Interaction.objects.create(contact=contact, date=days_from_today(-9))
        Interaction.objects.create(contact=contact, date=days_from_today(-2))
        row = self.client.get(reverse("contact_list")).context["contacts"][0]
        self.assertEqual((row.interaction_count, row.last_contacted), (2, days_from_today(-2)))

    def test_log_interaction_attaches_to_the_contact_in_the_url(self):
        contact = make_contact()
        response = self.client.post(
            reverse("interaction_create", args=[contact.pk]),
            {"date": days_from_today(0), "kind": "coffee_chat", "notes": "Great chat"},
        )
        self.assertRedirects(response, reverse("contact_detail", args=[contact.pk]))
        self.assertEqual(contact.interactions.get().kind, "coffee_chat")

    def test_deleting_a_contact_deletes_its_interactions(self):
        contact = make_contact()
        Interaction.objects.create(contact=contact, date=days_from_today(0))
        self.client.post(reverse("contact_delete", args=[contact.pk]))
        self.assertFalse(Interaction.objects.exists())


class DashboardTests(LoggedInTestCase):
    def setUp(self):
        super().setUp()
        self.contact = make_contact()

    def follow_up(self, days, done=False):
        return Interaction.objects.create(
            contact=self.contact, date=days_from_today(-3), follow_up_date=days_from_today(days), follow_up_done=done
        )

    def test_overdue_and_upcoming_are_separated(self):
        overdue, upcoming = self.follow_up(-1), self.follow_up(5)
        context = self.client.get(reverse("dashboard")).context
        self.assertEqual(list(context["overdue"]), [overdue])
        self.assertEqual(list(context["upcoming"]), [upcoming])

    def test_follow_up_due_today_is_upcoming_not_overdue(self):
        today = self.follow_up(0)
        context = self.client.get(reverse("dashboard")).context
        self.assertEqual((list(context["overdue"]), list(context["upcoming"])), ([], [today]))

    def test_follow_ups_beyond_the_window_are_hidden(self):
        self.follow_up(60)
        self.assertEqual(list(self.client.get(reverse("dashboard")).context["upcoming"]), [])

    def test_done_follow_ups_and_interactions_without_one_are_hidden(self):
        self.follow_up(-1, done=True)
        Interaction.objects.create(contact=self.contact, date=days_from_today(-1))  # no follow-up date
        context = self.client.get(reverse("dashboard")).context
        self.assertEqual((list(context["overdue"]), list(context["upcoming"])), ([], []))

    def test_mark_done_removes_the_reminder(self):
        item = self.follow_up(-1)
        response = self.client.post(reverse("interaction_done", args=[item.pk]))
        self.assertRedirects(response, reverse("dashboard"))
        self.assertEqual(list(self.client.get(reverse("dashboard")).context["overdue"]), [])

    def test_mark_done_ignores_a_next_url_on_another_site(self):
        item = self.follow_up(-1)
        response = self.client.post(
            reverse("interaction_done", args=[item.pk]), {"next": "https://evil.example/phish"}
        )
        self.assertRedirects(response, reverse("dashboard"))

    def test_mark_done_follows_a_next_url_on_this_site(self):
        item = self.follow_up(-1)
        target = reverse("contact_detail", args=[self.contact.pk])
        response = self.client.post(reverse("interaction_done", args=[item.pk]), {"next": target})
        self.assertRedirects(response, target)

    def test_mark_done_needs_post(self):
        item = self.follow_up(-1)
        self.assertEqual(self.client.get(reverse("interaction_done", args=[item.pk])).status_code, 405)

    def test_only_saved_applications_with_near_deadlines_are_listed(self):
        make_application(deadline=days_from_today(3))                                        # shown
        make_application(deadline=days_from_today(3), status=Application.Status.APPLIED)    # already applied
        make_application(deadline=days_from_today(-3))                                       # already passed
        make_application(deadline=days_from_today(90))                                       # too far away
        shown = self.client.get(reverse("dashboard")).context["deadlines"]
        self.assertEqual(len(shown), 1)


class ResumeMatchIntegrationTests(LoggedInTestCase):
    JOB = "We need Python, SQL, Docker and AWS."

    def make_resume(self, text="Python and SQL", **kwargs):
        return Resume.objects.create(name="Main", text=text, **kwargs)

    def post_application(self, description=None, **extra):
        data = {
            "company_name": "Acme Health", "role_title": "Data Co-op", "status": "saved",
            "job_description": self.JOB if description is None else description,
        }
        data.update(extra)
        return self.client.post(reverse("application_create"), data)

    def test_resume_pages_require_login(self):
        resume = self.make_resume()
        anonymous = Client()
        self.assertEqual(anonymous.get(reverse("resume_list")).status_code, 302)
        self.assertEqual(anonymous.post(reverse("resume_activate", args=[resume.pk])).status_code, 302)

    def test_first_resume_becomes_active_automatically(self):
        self.client.post(reverse("resume_create"), {"name": "Main", "text": "Python"})
        self.assertTrue(Resume.objects.get().is_active)

    def test_second_resume_does_not_take_over(self):
        self.make_resume(is_active=True)
        self.client.post(reverse("resume_create"), {"name": "Other", "text": "Java"})
        self.assertEqual(Resume.objects.get(is_active=True).name, "Main")

    def test_saving_an_application_stores_the_score(self):
        self.make_resume(is_active=True)
        self.post_application()
        self.assertEqual(Application.objects.get().match_score, 50)

    def test_no_score_without_an_active_resume(self):
        self.post_application()
        self.assertIsNone(Application.objects.get().match_score)

    def test_no_score_without_a_job_description(self):
        self.make_resume(is_active=True)
        self.post_application(description="")
        self.assertIsNone(Application.objects.get().match_score)

    def test_editing_the_description_updates_the_score(self):
        self.make_resume(is_active=True)
        self.post_application()
        app = Application.objects.get()
        self.client.post(
            reverse("application_update", args=[app.pk]),
            {"company_name": "Acme Health", "role_title": "Data Co-op", "status": "saved", "job_description": "Python"},
        )
        app.refresh_from_db()
        self.assertEqual(app.match_score, 100)

    def test_activating_another_resume_rescores_everything(self):
        first = self.make_resume(text="Python and SQL", is_active=True)
        second = Resume.objects.create(name="Cloud", text="Docker and AWS")
        self.post_application()
        self.client.post(reverse("resume_activate", args=[second.pk]))
        self.assertEqual(Application.objects.get().match_score, 50)  # Docker and AWS: still 2 of 4
        self.client.post(reverse("resume_activate", args=[first.pk]))
        self.assertEqual(Resume.objects.get(is_active=True), first)
        self.assertEqual(Resume.objects.filter(is_active=True).count(), 1)

    def test_editing_the_active_resume_rescores_applications(self):
        resume = self.make_resume(text="Python", is_active=True)
        self.post_application()
        self.assertEqual(Application.objects.get().match_score, 25)
        self.client.post(reverse("resume_update", args=[resume.pk]), {"name": "Main", "text": self.JOB})
        self.assertEqual(Application.objects.get().match_score, 100)

    def test_rescoring_does_not_write_status_history(self):
        self.make_resume(is_active=True)
        self.post_application()
        app = Application.objects.get()
        self.client.post(reverse("resume_activate", args=[Resume.objects.get().pk]))
        self.assertEqual(app.status_changes.count(), 1)

    def test_edit_page_lists_matched_and_missing_skills(self):
        self.make_resume(is_active=True)
        self.post_application()
        app = Application.objects.get()
        response = self.client.get(reverse("application_update", args=[app.pk]))
        self.assertEqual(response.context["match"].missing, ["AWS", "Docker"])
        self.assertContains(response, "2 of the 4 skills")

    def test_edit_page_explains_when_there_is_no_resume(self):
        self.post_application()
        app = Application.objects.get()
        response = self.client.get(reverse("application_update", args=[app.pk]))
        self.assertContains(response, "No active resume yet")

    def test_board_card_shows_the_score(self):
        self.make_resume(is_active=True)
        self.post_application()
        self.assertContains(self.client.get(reverse("board")), "Resume match 50%")
