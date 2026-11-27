"""Load (or remove) made-up demo data, for trying the app and taking screenshots.

    python manage.py seed_demo           # load
    python manage.py seed_demo --clear   # remove only the demo data

Every company it creates carries DEMO_NOTE in its notes, which is how --clear finds the demo data
without touching anything you entered yourself. Dates are relative to today, and status histories
are backdated, so the dashboard (funnel, weekly chart, "gone quiet") looks realistic whenever it runs.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from tracker import services
from tracker.models import Application, Company, Contact, Interaction, Resume, StatusChange

DEMO_NOTE = "[demo data: created by manage.py seed_demo]"
DEMO_RESUME_NAME = "Sample resume (demo data)"
DEMO_URL = "https://example.com/demo-jobs/"  # example.com is reserved for examples, so it never collides

RESUME_TEXT = """Alex Rivera (sample resume, not a real person)
MS Electrical and Computer Engineering, focus on machine learning and computer vision.
Skills: Python, SQL, pandas, NumPy, scikit-learn, PyTorch, OpenCV, PostgreSQL, Docker, Git, Linux,
statistics, machine learning, deep learning, data analysis, data visualization, Matplotlib, Tableau,
Excel, C++, Django, FastAPI, REST API. Coursework in healthcare analytics and NLP.
Projects: built a data pipeline for wearable sensor data; trained an image classification model
(computer vision) evaluated across skin tones; deployed a Django app with Docker and nginx."""

# (role, company, final status, transitions as [(status, days ago)], extra fields, job description)
# The first transition is the day the card was saved; date_applied is set from the "applied" step.
APPLICATIONS = [
    ("Data Science Co-op", "Northwind Bio", [("saved", 9)], {"deadline": 4},
     "Data Science co-op on our genomics team. Python, SQL, pandas and scikit-learn; experience with Spark "
     "and Airflow on AWS is a plus. Strong statistics required."),
    ("Computer Vision Co-op", "Lumen Imaging", [("saved", 5)], {"deadline": 14},
     "Medical imaging co-op: computer vision with PyTorch and OpenCV, DICOM data, Docker, Git."),
    ("Data Engineering Co-op", "Atlas Freight", [("saved", 3)], {"deadline": 10},
     "Build ETL and data pipeline jobs with Python, SQL, Airflow, dbt and Snowflake. Kubernetes a plus."),
    ("Analytics Engineering Co-op", "Meridian Analytics", [("saved", 6), ("applied", 2)], {},
     "Analytics engineering with SQL, dbt, Looker and Python. Data modeling and data quality."),
    ("Health Data Analyst Co-op", "Quanta Health", [("saved", 9), ("applied", 5)], {},
     "Analyze claims data and EHR data with SQL, Python and Tableau. HIPAA training provided."),
    ("ML Research Co-op", "Pinecrest Labs", [("saved", 12), ("applied", 7)], {},
     "Machine learning research: PyTorch, transformer models, NLP, Hugging Face, statistics."),
    ("Data Science Co-op", "Harbor Insurance", [("saved", 20), ("applied", 16)], {},
     "Predictive modeling with Python, scikit-learn, XGBoost and SQL. A/B testing and Excel reporting."),
    ("Data Science Co-op", "Bluefin Genomics", [("saved", 28), ("applied", 22), ("screen", 12)], {},
     "Genomics data science: Python, pandas, statistics, machine learning, Spark, AWS, bioinformatics."),
    ("Data Engineering Co-op", "Vireo Bio", [("saved", 30), ("applied", 26), ("screen", 18)], {},
     "Data engineering for life sciences: Python, SQL, PostgreSQL, Airflow, Docker, data pipeline."),
    ("ML Engineering Co-op", "Corvid Robotics",
     [("saved", 35), ("applied", 30), ("screen", 20), ("interview", 6)], {},
     "ML engineering for robot perception: Python, PyTorch, computer vision, OpenCV, Docker, Kubernetes, C++."),
    ("Health Data Analyst Co-op", "Halcyon Health",
     [("saved", 45), ("applied", 40), ("screen", 32), ("interview", 20), ("offer", 4)], {},
     "Clinical data analysis with SQL, Python, pandas, statistics and data visualization. Healthcare focus."),
    ("Retail Analytics Co-op", "Orbit Retail", [("saved", 38), ("applied", 35), ("rejected", 15)], {},
     "Retail analytics: SQL, Excel, Tableau, Power BI, forecasting."),
    ("NLP Co-op", "Kestrel AI", [("saved", 50), ("applied", 45), ("screen", 35), ("rejected", 25)], {},
     "NLP with Python, PyTorch, LLM fine-tuning, Hugging Face, AWS."),
    ("Quant Research Co-op", "Ridgeline Capital", [("saved", 55), ("applied", 50), ("withdrawn", 30)], {},
     "Quantitative research: Python, statistics, time series, optimization, C++."),
]

# (name, company, role, linked application company, interactions as (kind, days ago, follow-up in days, done, notes))
CONTACTS = [
    ("Priya Natarajan", "Bluefin Genomics", "Senior Data Scientist", "Bluefin Genomics", [
        ("email", 14, None, False, "Intro through the alumni network."),
        ("coffee_chat", 6, -3, False, "Talked about the genomics data platform team. Send a thank-you note."),
    ]),
    ("Marcus Lee", "Halcyon Health", "Recruiter", "Halcyon Health", [
        ("other", 5, -1, False, "Call about the offer. Ask about the timeline."),
    ]),
    ("Dana Kim", "Meridian Analytics", "Analytics Manager", "Meridian Analytics", [
        ("email", 4, 1, False, "Send an updated resume."),
    ]),
    ("Sam Ortiz", "Corvid Robotics", "ML Engineer", "Corvid Robotics", [
        ("referral", 24, None, False, "Referred me for the ML engineering co-op."),
        ("email", 3, 4, False, "Prepare questions for the onsite."),
    ]),
    ("Jordan Reyes", "Northwind Bio", "University Recruiter", None, [
        ("other", 20, None, False, "Met at the career fair."),
    ]),
    ("Tess Wong", "Vireo Bio", "Data Engineer", None, [
        ("email", 11, -4, True, "Asked about the team's stack."),
    ]),
]


class Command(BaseCommand):
    help = "Load made-up demo data (or remove it with --clear)."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Remove the demo data and nothing else.")
        parser.add_argument("--force", action="store_true", help="Run even when DEBUG is off.")

    def handle(self, *args, clear=False, force=False, **options):
        if not settings.DEBUG and not force:
            raise CommandError("DEBUG is off, so this may be a real deployment. Use --force if you are sure.")
        if clear:
            self.clear()
        else:
            self.load()

    @transaction.atomic
    def clear(self):
        companies = Company.objects.filter(notes=DEMO_NOTE)
        # Match demo records individually, not "everything at a demo company": if you later added your own
        # application for, say, Northwind Bio, it reuses that company and must survive --clear.
        demo_apps = Application.objects.filter(company__in=companies, job_url__startswith=DEMO_URL)
        demo_contacts = Contact.objects.filter(company__in=companies, name__in=[c[0] for c in CONTACTS])
        # Order matters: applications protect their company from deletion, so they go first.
        n_apps = demo_apps.delete()[1].get("tracker.Application", 0)
        n_contacts = demo_contacts.delete()[1].get("tracker.Contact", 0)
        unused = companies.filter(applications__isnull=True, contacts__isnull=True)
        n_companies = unused.delete()[0]
        kept = companies.update(notes="")  # still used by your own records: keep them as ordinary companies
        resume = Resume.objects.filter(name=DEMO_RESUME_NAME).first()
        if resume:
            resume.delete()
            services.rescore_all()  # scores were against the demo resume if it was active
        self.stdout.write(self.style.SUCCESS(
            f"Removed {n_apps} applications, {n_contacts} contacts, {n_companies} companies"
            f"{' and the sample resume' if resume else ''}."
            + (f" Kept {kept} demo companies that your own records use." if kept else "")
        ))

    @transaction.atomic
    def load(self):
        if Company.objects.filter(notes=DEMO_NOTE).exists():
            raise CommandError("Demo data is already loaded. Run with --clear first to reload it.")
        now = timezone.now()
        today = timezone.localdate()
        days_ago = lambda n: now - timedelta(days=n)  # noqa: E731

        companies = {}

        def company(name):
            # Not dict.setdefault(name, create(...)): that would call create() even when name is already there.
            if name not in companies:
                if Company.objects.filter(name=name).exists():
                    raise CommandError(f"A company named {name!r} already exists; refusing to mix demo and real data.")
                companies[name] = Company.objects.create(name=name, notes=DEMO_NOTE)
            return companies[name]

        positions = {}
        for role, company_name, transitions, extra, description in APPLICATIONS:
            final_status = transitions[-1][0]
            applied = next((days for status, days in transitions if status == "applied"), None)
            application = Application.objects.create(
                company=company(company_name), role_title=role, job_description=description,
                term="Summer 2027", coop_months=6, location="Boston, MA",
                job_url=f"{DEMO_URL}{company_name.lower().replace(' ', '-')}",
                date_applied=today - timedelta(days=applied) if applied is not None else None,
                deadline=today + timedelta(days=extra["deadline"]) if "deadline" in extra else None,
                position=positions.get(final_status, 0),
            )
            positions[final_status] = positions.get(final_status, 0) + 1
            # Replay the status steps through save(), so the history rows are real, then backdate each one.
            for index, (status, days) in enumerate(transitions):
                if index > 0:
                    application.status = status
                    application.save()
                StatusChange.objects.filter(application=application, to_status=status).update(changed_at=days_ago(days))
            Application.objects.filter(pk=application.pk).update(created_at=days_ago(transitions[0][1]))

        for name, company_name, role, linked, interactions in CONTACTS:
            contact = Contact.objects.create(name=name, company=company(company_name), role=role)
            if linked:
                contact.applications.set(Application.objects.filter(company=companies[linked]))
            for kind, days, follow_up, done, notes in interactions:
                Interaction.objects.create(
                    contact=contact, kind=kind, notes=notes, date=today - timedelta(days=days),
                    follow_up_date=today + timedelta(days=follow_up) if follow_up is not None else None,
                    follow_up_done=done,
                )

        resume = Resume.objects.create(name=DEMO_RESUME_NAME, text=RESUME_TEXT)
        if services.active_resume() is None:
            services.activate(resume)  # also scores every application
            note = "The sample resume is now active."
        else:
            services.rescore_all()
            note = "Your active resume was kept; the sample resume is inactive."

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {len(APPLICATIONS)} applications, {len(CONTACTS)} contacts and a sample resume. {note}\n"
            "Remove it any time with: python manage.py seed_demo --clear"
        ))
