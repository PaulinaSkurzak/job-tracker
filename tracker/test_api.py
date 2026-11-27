from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from . import services
from .models import Application, Company, Contact, Interaction, Resume, StatusChange


def app(role="Data Co-op", company="Acme Health", **kwargs):
    return Application.objects.create(company=Company.objects.get_or_create(name=company)[0], role_title=role, **kwargs)


class ApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(get_user_model().objects.create_user("paulina"))

    def url(self, name, *args):
        return reverse(name, args=args)


class ApplicationApiTests(ApiTestCase):
    def test_create_finds_or_creates_the_company_by_name(self):
        Company.objects.create(name="Acme Health")
        response = self.client.post(
            self.url("api-application-list"), {"company_name": " Acme Health ", "role_title": "DS Co-op"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Company.objects.count(), 1)  # reused, after trimming spaces
        self.assertEqual(response.json()["company"]["name"], "Acme Health")

    def test_create_requires_a_company_name(self):
        response = self.client.post(self.url("api-application-list"), {"role_title": "DS Co-op"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("company_name", response.json())

    def test_create_logs_the_first_status(self):
        response = self.client.post(
            self.url("api-application-list"), {"company_name": "Acme", "role_title": "DS", "status": "applied"},
            format="json",
        )
        history = response.json()["status_history"]
        self.assertEqual([(h["from_status"], h["to_status"]) for h in history], [("", "applied")])

    def test_patching_status_writes_history(self):
        a = app()
        self.client.patch(self.url("api-application-detail", a.pk), {"status": "interview"}, format="json")
        self.assertEqual(list(a.status_changes.values_list("to_status", flat=True)), ["saved", "interview"])

    def test_list_leaves_out_the_job_description_but_detail_has_it(self):
        a = app(job_description="Long text")
        listed = self.client.get(self.url("api-application-list")).json()[0]
        self.assertNotIn("job_description", listed)
        detail = self.client.get(self.url("api-application-detail", a.pk)).json()
        self.assertEqual(detail["job_description"], "Long text")
        self.assertEqual(detail["status_display"], "Saved")

    def test_list_filters(self):
        app("ML Co-op", "Corvid", status="interview", term="Summer 2027")
        app("Data Co-op", "Northwind", term="Fall 2027")

        def get(**params):
            return [a["role_title"] for a in self.client.get(self.url("api-application-list"), params).json()]

        self.assertEqual(get(status="interview"), ["ML Co-op"])
        self.assertEqual(get(term="Fall 2027"), ["Data Co-op"])
        self.assertEqual(get(q="northw"), ["Data Co-op"])  # company name, case-insensitive
        self.assertEqual(get(q="ml co"), ["ML Co-op"])  # role title

    def test_detail_lists_linked_contacts(self):
        a = app()
        Contact.objects.create(name="Priya").applications.add(a)
        contacts = self.client.get(self.url("api-application-detail", a.pk)).json()["contacts"]
        self.assertEqual([c["name"] for c in contacts], ["Priya"])

    def test_client_cannot_set_score_or_position(self):
        a = app()
        self.client.patch(self.url("api-application-detail", a.pk), {"match_score": 99, "position": 7}, format="json")
        a.refresh_from_db()
        self.assertIsNone(a.match_score)
        self.assertEqual(a.position, 0)

    def test_delete(self):
        a = app()
        self.assertEqual(self.client.delete(self.url("api-application-detail", a.pk)).status_code, 204)
        self.assertFalse(Application.objects.exists())


class MoveApiTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.a = app("A", status="applied")
        self.b = app("B", status="interview")
        self.c = app("C", status="interview")

    def move(self, application, **body):
        return self.client.post(self.url("api-application-move", application.pk), body, format="json")

    def test_move_changes_status_and_logs_history(self):
        response = self.move(self.a, status="interview", ids=[self.b.pk, self.a.pk, self.c.pk])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "interview")
        history = list(self.a.status_changes.values_list("from_status", "to_status"))
        self.assertEqual(history, [("", "applied"), ("applied", "interview")])

    def test_move_saves_the_order_within_the_column(self):
        self.move(self.a, status="interview", ids=[self.c.pk, self.a.pk, self.b.pk])
        positions = dict(Application.objects.values_list("role_title", "position"))
        self.assertEqual(positions, {"C": 0, "A": 1, "B": 2})

    def test_reordering_within_a_column_writes_no_history(self):
        before = StatusChange.objects.count()
        self.move(self.c, status="interview", ids=[self.c.pk, self.b.pk])
        self.assertEqual(StatusChange.objects.count(), before)

    def test_ids_from_another_column_are_not_reordered(self):
        self.move(self.b, status="interview", ids=[self.b.pk, self.a.pk])  # a is in "applied"
        self.a.refresh_from_db()
        self.assertEqual((self.a.status, self.a.position), ("applied", 0))

    def test_rejects_bad_input(self):
        cases = {
            "unknown status": {"status": "hired", "ids": [self.a.pk]},
            "non-numeric ids": {"status": "applied", "ids": ["x"]},
            "empty ids": {"status": "applied", "ids": []},
            "moved card missing from ids": {"status": "applied", "ids": [self.b.pk]},
            "repeated ids": {"status": "applied", "ids": [self.a.pk, self.a.pk]},
        }
        for label, body in cases.items():
            with self.subTest(label):
                self.assertEqual(self.move(self.a, **body).status_code, 400)
        self.a.refresh_from_db()
        self.assertEqual(self.a.status, "applied")  # nothing changed

    def test_move_is_post_only(self):
        self.assertEqual(self.client.get(self.url("api-application-move", self.a.pk)).status_code, 405)

    def test_move_needs_a_csrf_token_for_a_real_session(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(get_user_model().objects.get())  # a real session cookie, as a browser would have
        response = client.post(
            self.url("api-application-move", self.a.pk), {"status": "offer", "ids": [self.a.pk]}, format="json"
        )
        self.assertEqual(response.status_code, 403)


class ContactApiTests(ApiTestCase):
    def test_create_with_company_and_applications(self):
        a = app()
        response = self.client.post(
            self.url("api-contact-list"),
            {"name": "Priya", "company_name": "Bluefin", "applications": [a.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual((body["company"]["name"], body["applications"]), ("Bluefin", [a.pk]))
        self.assertEqual(body["interaction_count"], 0)

    def test_company_is_optional_and_blank_clears_it(self):
        response = self.client.post(self.url("api-contact-list"), {"name": "Dana"}, format="json")
        self.assertIsNone(response.json()["company"])
        contact = Contact.objects.get()
        contact.company = Company.objects.create(name="Meridian")
        contact.save()
        response = self.client.patch(self.url("api-contact-detail", contact.pk), {"company_name": ""}, format="json")
        self.assertIsNone(response.json()["company"])

    def test_list_summarises_interactions(self):
        contact = Contact.objects.create(name="Priya")
        today = date(2026, 11, 26)
        days = lambda n: today + timedelta(days=n)  # noqa: E731
        Interaction.objects.create(contact=contact, date=days(-9), follow_up_date=days(-5), follow_up_done=True)
        Interaction.objects.create(contact=contact, date=days(-2), follow_up_date=days(3))
        row = self.client.get(self.url("api-contact-list")).json()[0]
        self.assertEqual(row["interaction_count"], 2)
        self.assertEqual(row["last_contacted"], str(days(-2)))
        self.assertEqual(row["next_follow_up"], str(days(3)))  # the done one is ignored

    def test_update_response_includes_the_summary(self):
        contact = Contact.objects.create(name="Priya")
        Interaction.objects.create(contact=contact, date=date(2026, 11, 20))
        url = self.url("api-contact-detail", contact.pk)
        response = self.client.patch(url, {"role": "Data Scientist"}, format="json")
        self.assertEqual(response.json()["interaction_count"], 1)

    def test_search(self):
        Contact.objects.create(name="Priya", company=Company.objects.create(name="Bluefin"))
        Contact.objects.create(name="Dana")
        names = [c["name"] for c in self.client.get(self.url("api-contact-list"), {"q": "bluef"}).json()]
        self.assertEqual(names, ["Priya"])

    def test_log_interaction_uses_the_contact_in_the_url(self):
        priya, dana = Contact.objects.create(name="Priya"), Contact.objects.create(name="Dana")
        response = self.client.post(
            self.url("api-contact-interactions", priya.pk),
            {"date": "2026-11-20", "kind": "coffee_chat", "notes": "Chat", "contact": dana.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["kind_display"], "Coffee chat")
        self.assertEqual(Interaction.objects.get().contact, priya)

    def test_detail_lists_interactions_newest_first(self):
        contact = Contact.objects.create(name="Priya")
        Interaction.objects.create(contact=contact, date=date(2026, 11, 12), notes="first")
        Interaction.objects.create(contact=contact, date=date(2026, 11, 20), notes="second")
        notes = [i["notes"] for i in self.client.get(self.url("api-contact-detail", contact.pk)).json()["interactions"]]
        self.assertEqual(notes, ["second", "first"])

    def test_deleting_a_contact_deletes_its_interactions(self):
        contact = Contact.objects.create(name="Priya")
        Interaction.objects.create(contact=contact, date=date(2026, 11, 20))
        self.client.delete(self.url("api-contact-detail", contact.pk))
        self.assertFalse(Interaction.objects.exists())


class InteractionApiTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.interaction = Interaction.objects.create(
            contact=Contact.objects.create(name="Priya"), date=date(2026, 11, 20), follow_up_date=date(2026, 11, 23)
        )

    def test_mark_follow_up_done(self):
        url = self.url("api-interaction-detail", self.interaction.pk)
        self.client.patch(url, {"follow_up_done": True}, format="json")
        self.interaction.refresh_from_db()
        self.assertTrue(self.interaction.follow_up_done)

    def test_snooze_moves_the_follow_up_date(self):
        url = self.url("api-interaction-detail", self.interaction.pk)
        self.client.patch(url, {"follow_up_date": "2026-11-28"}, format="json")
        self.interaction.refresh_from_db()
        self.assertEqual(self.interaction.follow_up_date, date(2026, 11, 28))

    def test_contact_cannot_be_changed(self):
        other = Contact.objects.create(name="Dana")
        self.client.patch(self.url("api-interaction-detail", self.interaction.pk), {"contact": other.pk}, format="json")
        self.interaction.refresh_from_db()
        self.assertEqual(self.interaction.contact.name, "Priya")


class ResumeApiTests(ApiTestCase):
    def create(self, name, text):
        return self.client.post(self.url("api-resume-list"), {"name": name, "text": text}, format="json")

    def test_first_resume_becomes_active_and_second_does_not(self):
        self.assertTrue(self.create("One", "Python").json()["is_active"])
        self.assertFalse(self.create("Two", "SQL").json()["is_active"])

    def test_is_active_cannot_be_set_directly(self):
        self.create("One", "Python")
        second = Resume.objects.create(name="Two", text="SQL")
        self.client.patch(self.url("api-resume-detail", second.pk), {"is_active": True}, format="json")
        self.assertEqual(Resume.objects.filter(is_active=True).count(), 1)
        self.assertFalse(Resume.objects.get(pk=second.pk).is_active)

    def test_activate_switches_and_rescores(self):
        a = app(job_description="Python and SQL")
        self.create("Python only", "Python")
        a.refresh_from_db()
        self.assertEqual(a.match_score, 50)
        both = Resume.objects.create(name="Both", text="Python SQL")
        response = self.client.post(self.url("api-resume-activate", both.pk))
        self.assertTrue(response.json()["is_active"])
        a.refresh_from_db()
        self.assertEqual(a.match_score, 100)

    def test_editing_the_active_resume_rescores(self):
        a = app(job_description="Python and SQL")
        resume_id = self.create("Mine", "Python").json()["id"]
        self.client.patch(self.url("api-resume-detail", resume_id), {"text": "Python SQL"}, format="json")
        a.refresh_from_db()
        self.assertEqual(a.match_score, 100)

    def test_deleting_the_active_resume_clears_scores(self):
        a = app(job_description="Python and SQL")
        resume_id = self.create("Mine", "Python").json()["id"]
        self.client.delete(self.url("api-resume-detail", resume_id))
        a.refresh_from_db()
        self.assertIsNone(a.match_score)

    def test_saving_an_application_scores_it_against_the_active_resume(self):
        self.create("Mine", "Python")
        response = self.client.post(
            self.url("api-application-list"),
            {"company_name": "Acme", "role_title": "DS", "job_description": "Python and Spark"},
            format="json",
        )
        self.assertEqual(response.json()["match_score"], 50)
        a_id = response.json()["id"]
        # A partial update that leaves out the description still keeps the score.
        response = self.client.patch(self.url("api-application-detail", a_id), {"term": "Fall 2027"}, format="json")
        self.assertEqual(response.json()["match_score"], 50)


class MatchApiTests(ApiTestCase):
    JD = "We use Python, SQL and Spark daily."

    def match(self, **body):
        return self.client.post(self.url("api_match"), body, format="json")

    def test_scores_against_every_resume_active_first(self):
        Resume.objects.create(name="Old", text="Python")
        services.activate(Resume.objects.create(name="Current", text="Python and SQL"))
        results = self.match(job_description=self.JD).json()["results"]
        self.assertEqual([r["resume_name"] for r in results], ["Current", "Old"])
        self.assertEqual(results[0], {
            "resume_id": results[0]["resume_id"], "resume_name": "Current", "is_active": True,
            "score": 67, "matched": ["Python", "SQL"], "missing": ["Spark"],
        })

    def test_resume_id_limits_to_one(self):
        old = Resume.objects.create(name="Old", text="Python")
        Resume.objects.create(name="Other", text="SQL")
        results = self.match(job_description=self.JD, resume_id=old.pk).json()["results"]
        self.assertEqual([r["resume_name"] for r in results], ["Old"])

    def test_unknown_resume_id_is_rejected(self):
        self.assertEqual(self.match(job_description=self.JD, resume_id=999).status_code, 400)

    def test_blank_description_is_rejected(self):
        self.assertEqual(self.match(job_description="  ").status_code, 400)

    def test_no_resumes_gives_no_results(self):
        self.assertEqual(self.match(job_description=self.JD).json()["results"], [])

    def test_returns_where_each_skill_appears(self):
        spans = self.match(job_description=self.JD).json()["spans"]
        self.assertEqual([(self.JD[s["start"]:s["end"]], s["skill"]) for s in spans],
                         [("Python", "Python"), ("SQL", "SQL"), ("Spark", "Spark")])

    def test_matching_saves_nothing(self):
        a = app(job_description=self.JD)
        Resume.objects.create(name="Mine", text="Python")
        self.match(job_description=self.JD)
        a.refresh_from_db()
        self.assertIsNone(a.match_score)


class CompanyApiTests(ApiTestCase):
    def test_list_and_create(self):
        self.client.post(self.url("api-company-list"), {"name": "Bluefin"}, format="json")
        self.assertEqual([c["name"] for c in self.client.get(self.url("api-company-list")).json()], ["Bluefin"])

    def test_duplicate_name_is_rejected(self):
        Company.objects.create(name="Bluefin")
        response = self.client.post(self.url("api-company-list"), {"name": "Bluefin"}, format="json")
        self.assertEqual(response.status_code, 400)
