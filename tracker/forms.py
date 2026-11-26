from django import forms
from django.utils import timezone

from . import services
from .models import Application, Company, Contact, Interaction, Resume


def _date_widget():
    # type="date" gives a native date picker; the format must be ISO for it to show a saved value.
    return forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"})


class ApplicationForm(forms.ModelForm):
    # The user types a company name. We find or create the Company, so adding an
    # application never requires leaving the page to create a company first.
    company_name = forms.CharField(max_length=200, label="Company")

    class Meta:
        model = Application
        fields = [
            "role_title", "location", "job_url", "term", "coop_months",
            "status", "date_applied", "deadline", "job_description",
        ]
        widgets = {
            "date_applied": _date_widget(),
            "deadline": _date_widget(),
            "job_description": forms.Textarea(attrs={"rows": 8}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["company_name"].initial = self.instance.company.name
        self.order_fields(["company_name"])  # show company first

    def save(self, commit=True):
        name = self.cleaned_data["company_name"].strip()
        self.instance.company, _ = Company.objects.get_or_create(name=name)
        # Score against the active resume whenever the description is saved or edited.
        self.instance.match_score = services.score_for(self.instance.job_description, services.active_resume())
        return super().save(commit)


class ResumeForm(forms.ModelForm):
    class Meta:
        model = Resume
        fields = ["name", "text"]
        widgets = {"text": forms.Textarea(attrs={"rows": 18})}


class ContactForm(forms.ModelForm):
    # Optional here (a contact might not be tied to a company yet), unlike on applications.
    company_name = forms.CharField(max_length=200, label="Company", required=False)

    class Meta:
        model = Contact
        fields = ["name", "role", "email", "linkedin_url", "applications", "notes"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 4})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.company:
            self.fields["company_name"].initial = self.instance.company.name
        self.order_fields(["name", "company_name"])
        self.fields["applications"].queryset = Application.objects.select_related("company")

    def save(self, commit=True):
        name = self.cleaned_data["company_name"].strip()
        self.instance.company = Company.objects.get_or_create(name=name)[0] if name else None
        return super().save(commit)  # with commit=True this also saves the many-to-many field


class InteractionForm(forms.ModelForm):
    class Meta:
        model = Interaction
        fields = ["date", "kind", "notes", "follow_up_date"]
        widgets = {
            "date": _date_widget(),
            "follow_up_date": _date_widget(),
            "notes": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["date"].initial = timezone.localdate()
