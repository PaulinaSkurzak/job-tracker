from django import forms

from .models import Application, Company


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
            # type="date" gives a native date picker; the format must be ISO for it to show the saved value.
            "date_applied": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "deadline": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
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
        return super().save(commit)
