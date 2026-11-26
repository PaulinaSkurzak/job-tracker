from django.db import models, transaction
from django.db.models import Q


class Company(models.Model):
    name = models.CharField(max_length=200, unique=True)
    website = models.URLField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Application(models.Model):
    class Status(models.TextChoices):
        # The first value is what is stored in the database; the second is the label shown in the UI.
        SAVED = "saved", "Saved"
        APPLIED = "applied", "Applied"
        SCREEN = "screen", "Screen / OA"
        INTERVIEW = "interview", "Interview"
        OFFER = "offer", "Offer"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class CoopLength(models.IntegerChoices):
        FOUR = 4, "4 months"
        SIX = 6, "6 months"
        EIGHT = 8, "8 months"

    # PROTECT: deleting a company must not silently delete all its applications.
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="applications")
    role_title = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    job_url = models.URLField(blank=True)
    job_description = models.TextField(blank=True)  # pasted in; used for the resume keyword match

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SAVED, db_index=True)
    # Order of the card inside its kanban column (lower = higher up). Used by drag and drop later.
    position = models.PositiveIntegerField(default=0)

    term = models.CharField(max_length=50, blank=True, help_text="e.g. Summer 2027")
    coop_months = models.PositiveSmallIntegerField(choices=CoopLength.choices, null=True, blank=True)
    date_applied = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    match_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="0-100, from resume match")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "position", "-updated_at"]

    def __str__(self):
        return f"{self.role_title} at {self.company}"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remember the status as loaded, so save() can tell whether it changed.
        self._loaded_status = self.status

    def save(self, *args, **kwargs):
        """Save, and record a StatusChange whenever the status is new or different.

        This lives in save() (not in each view) so a status change is logged no matter
        where it comes from: the admin, the kanban board, or a script.
        """
        is_new = self._state.adding
        changed = is_new or self.status != self._loaded_status
        previous = "" if is_new else self._loaded_status
        with transaction.atomic():  # the application and its history row succeed or fail together
            super().save(*args, **kwargs)
            if changed:
                StatusChange.objects.create(application=self, from_status=previous, to_status=self.status)
        self._loaded_status = self.status


class StatusChange(models.Model):
    """Append-only history. Powers funnel stats, e.g. what share of applications reach interview."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="status_changes")
    from_status = models.CharField(max_length=20, blank=True)  # blank for the very first status
    to_status = models.CharField(max_length=20, choices=Application.Status.choices)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]

    def __str__(self):
        return f"{self.application}: {self.from_status or 'new'} -> {self.to_status}"


class Contact(models.Model):
    name = models.CharField(max_length=200)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="contacts")
    role = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    linkedin_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    # A contact can help with several applications, and an application can involve several contacts.
    applications = models.ManyToManyField(Application, blank=True, related_name="contacts")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Interaction(models.Model):
    class Kind(models.TextChoices):
        COFFEE_CHAT = "coffee_chat", "Coffee chat"
        EMAIL = "email", "Email"
        REFERRAL = "referral", "Referral"
        OTHER = "other", "Other"

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="interactions")
    date = models.DateField()
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    notes = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)  # drives dashboard reminders

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.get_kind_display()} with {self.contact} on {self.date}"


class Resume(models.Model):
    name = models.CharField(max_length=200)
    text = models.TextField(help_text="Plain text of the resume, used for keyword matching")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # The database itself guarantees at most one active resume.
            models.UniqueConstraint(fields=["is_active"], condition=Q(is_active=True), name="one_active_resume"),
        ]

    def __str__(self):
        return self.name
