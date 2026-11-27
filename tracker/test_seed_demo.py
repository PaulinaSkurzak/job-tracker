from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from . import dashboard, services
from .management.commands.seed_demo import APPLICATIONS, CONTACTS, DEMO_RESUME_NAME
from .models import Application, Company, Contact, Interaction, Resume, StatusChange


def seed(*args):
    call_command("seed_demo", *args, stdout=StringIO())


@override_settings(DEBUG=True)
class SeedDemoTests(TestCase):
    def test_loads_applications_contacts_and_an_active_resume(self):
        seed()
        self.assertEqual(Application.objects.count(), len(APPLICATIONS))
        self.assertEqual(Contact.objects.count(), len(CONTACTS))
        self.assertTrue(Resume.objects.get(name=DEMO_RESUME_NAME).is_active)
        self.assertFalse(Application.objects.filter(match_score__isnull=True).exists())  # all scored

    def test_history_is_backdated_so_the_dashboard_has_something_to_show(self):
        seed()
        data = dashboard.dashboard()
        self.assertGreater(data["stats"]["applied_total"], 0)
        self.assertGreater(sum(week["count"] for week in data["weekly"]), 0)
        self.assertTrue(data["gone_quiet"])
        self.assertTrue(any(f["days_until"] < 0 for f in data["follow_ups"]))  # some overdue
        self.assertTrue(data["deadlines"])
        # The full path is recorded, not just the final status: Kestrel AI went through Screen before Rejected.
        kestrel = StatusChange.objects.filter(application__company__name="Kestrel AI")
        self.assertEqual(list(kestrel.values_list("to_status", flat=True)), ["saved", "applied", "screen", "rejected"])

    def test_refuses_to_load_twice(self):
        seed()
        with self.assertRaisesMessage(CommandError, "already loaded"):
            seed()

    def test_does_not_replace_your_active_resume(self):
        services.activate(Resume.objects.create(name="Mine", text="Python"))
        seed()
        self.assertEqual(services.active_resume().name, "Mine")

    def test_refuses_to_reuse_a_company_you_created(self):
        Company.objects.create(name="Northwind Bio")
        with self.assertRaisesMessage(CommandError, "already exists"):
            seed()
        self.assertEqual(Application.objects.count(), 0)  # all or nothing

    def test_clear_removes_only_demo_data(self):
        mine = Application.objects.create(company=Company.objects.create(name="My Company"), role_title="Mine")
        seed()
        seed("--clear")
        self.assertEqual(list(Application.objects.all()), [mine])
        self.assertFalse(Contact.objects.exists())
        self.assertFalse(Interaction.objects.exists())
        self.assertFalse(Resume.objects.exists())
        self.assertEqual(list(Company.objects.values_list("name", flat=True)), ["My Company"])

    def test_clear_keeps_your_application_at_a_demo_company(self):
        seed()
        northwind = Company.objects.get(name="Northwind Bio")
        mine = Application.objects.create(company=northwind, role_title="My real application")
        seed("--clear")
        self.assertEqual(list(Application.objects.all()), [mine])
        northwind.refresh_from_db()
        self.assertEqual(northwind.notes, "")  # now an ordinary company, so it counts as yours
        with self.assertRaisesMessage(CommandError, "already exists"):
            seed()  # reloading would mix demo data into it, so it is refused

    @override_settings(DEBUG=False)
    def test_refuses_without_debug_unless_forced(self):
        with self.assertRaisesMessage(CommandError, "DEBUG is off"):
            seed()
        seed("--force")
        self.assertEqual(Application.objects.count(), len(APPLICATIONS))
