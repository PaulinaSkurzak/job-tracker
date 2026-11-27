"""Serializers: convert models to and from JSON, and validate what the frontend sends.

Business rules (scoring, history, company lookup) live in services.py and models.py, so the
old Django pages and this API behave the same way.
"""

from rest_framework import serializers

from .. import services
from ..models import Application, Company, Contact, Interaction, Resume, StatusChange


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "website", "notes"]


class CompanyBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name"]


class StatusChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusChange
        fields = ["from_status", "to_status", "changed_at"]


class ContactBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ["id", "name"]


class ApplicationSerializer(serializers.ModelSerializer):
    """Used for the board list. Leaves out the job description, which can be long, to keep it small."""

    company = CompanyBriefSerializer(read_only=True)
    # The frontend sends a plain company name; we find or create the Company (same as the old form).
    company_name = serializers.CharField(write_only=True, max_length=200, required=False)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "company", "company_name", "role_title", "location", "job_url",
            "status", "status_display", "position", "term", "coop_months",
            "date_applied", "deadline", "match_score", "created_at", "updated_at",
        ]
        # The score is computed from the resume, and position is set by the move endpoint, so the
        # client cannot write them directly.
        read_only_fields = ["position", "match_score", "created_at", "updated_at"]

    def validate(self, attrs):
        if self.instance is None and not attrs.get("company_name", "").strip():
            raise serializers.ValidationError({"company_name": "This field is required."})
        return attrs

    def save(self, **kwargs):
        name = self.validated_data.pop("company_name", "").strip()
        if name:
            kwargs["company"] = services.company_named(name)
        # Re-score whenever the application is saved, as the old form did. On a partial update the
        # description may not be in the request, so fall back to the saved one.
        description = self.validated_data.get(
            "job_description", self.instance.job_description if self.instance else ""
        )
        kwargs["match_score"] = services.score_for(description, services.active_resume())
        return super().save(**kwargs)


class ApplicationDetailSerializer(ApplicationSerializer):
    status_history = StatusChangeSerializer(source="status_changes", many=True, read_only=True)
    contacts = ContactBriefSerializer(many=True, read_only=True)

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ["job_description", "status_history", "contacts"]


class MoveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Application.Status.choices)
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        help_text="Ids of the cards in the target column, top to bottom, after the drop.",
    )

    def validate_ids(self, ids):
        application = self.context["application"]
        if application.pk not in ids:
            raise serializers.ValidationError("Must include the id of the card being moved.")
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Ids must not repeat.")
        return ids


class InteractionSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Interaction
        fields = ["id", "contact", "date", "kind", "kind_display", "notes", "follow_up_date", "follow_up_done"]
        # The contact comes from the URL (/contacts/{id}/interactions/), never from the request body.
        read_only_fields = ["contact"]


class ContactSerializer(serializers.ModelSerializer):
    company = CompanyBriefSerializer(read_only=True)
    company_name = serializers.CharField(write_only=True, max_length=200, required=False, allow_blank=True)
    applications = serializers.PrimaryKeyRelatedField(many=True, queryset=Application.objects.all(), required=False)
    # Filled in by annotations on the queryset (one query for the whole list, see ContactViewSet).
    interaction_count = serializers.IntegerField(read_only=True, default=0)
    last_contacted = serializers.DateField(read_only=True, default=None)
    next_follow_up = serializers.DateField(read_only=True, default=None)

    class Meta:
        model = Contact
        fields = [
            "id", "name", "company", "company_name", "role", "email", "linkedin_url", "notes",
            "applications", "interaction_count", "last_contacted", "next_follow_up",
        ]

    def save(self, **kwargs):
        if "company_name" in self.validated_data:
            name = self.validated_data.pop("company_name").strip()
            kwargs["company"] = services.company_named(name) if name else None  # a contact's company is optional
        return super().save(**kwargs)


class ContactDetailSerializer(ContactSerializer):
    interactions = InteractionSerializer(many=True, read_only=True)

    class Meta(ContactSerializer.Meta):
        fields = ContactSerializer.Meta.fields + ["interactions"]


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ["id", "name", "text", "is_active", "created_at"]
        # Activation has its own endpoint, because it must deactivate the others and rescore everything.
        read_only_fields = ["is_active", "created_at"]

    def save(self, **kwargs):
        resume = super().save(**kwargs)
        services.after_resume_saved(resume)
        resume.refresh_from_db()  # is_active may have just changed
        return resume


class MatchRequestSerializer(serializers.Serializer):
    job_description = serializers.CharField()
    resume_id = serializers.IntegerField(
        required=False, help_text="Score against this resume only. Leave out to score against every resume."
    )

    def validate_resume_id(self, value):
        if not Resume.objects.filter(pk=value).exists():
            raise serializers.ValidationError("No resume with this id.")
        return value


class MatchResultSerializer(serializers.Serializer):
    resume_id = serializers.IntegerField()
    resume_name = serializers.CharField()
    is_active = serializers.BooleanField()
    score = serializers.IntegerField(allow_null=True, help_text="0-100, or null if the posting names no known skills")
    matched = serializers.ListField(child=serializers.CharField())
    missing = serializers.ListField(child=serializers.CharField())


class MatchResponseSerializer(serializers.Serializer):
    results = MatchResultSerializer(many=True)


# ---- Dashboard (read-only; these describe the response so the frontend gets exact types) ----


class DashboardStatsSerializer(serializers.Serializer):
    active_applications = serializers.IntegerField(help_text="Applied, Screen / OA, Interview or Offer")
    applied_this_week = serializers.IntegerField()
    weekly_goal = serializers.IntegerField()
    applied_total = serializers.IntegerField()
    reached_interview = serializers.IntegerField()
    reached_interview_percent = serializers.IntegerField()
    average_match = serializers.IntegerField(allow_null=True)
    scored_applications = serializers.IntegerField()


class FunnelStageSerializer(serializers.Serializer):
    label = serializers.CharField()
    count = serializers.IntegerField()
    percent = serializers.IntegerField()


class WeekSerializer(serializers.Serializer):
    week_start = serializers.DateField(help_text="Monday")
    count = serializers.IntegerField()


class FollowUpSerializer(serializers.Serializer):
    id = serializers.IntegerField(help_text="Interaction id; PATCH /api/interactions/{id}/ to mark done or snooze")
    contact_id = serializers.IntegerField()
    contact_name = serializers.CharField()
    company_name = serializers.CharField()
    kind = serializers.ChoiceField(choices=Interaction.Kind.choices)
    notes = serializers.CharField()
    follow_up_date = serializers.DateField()
    days_until = serializers.IntegerField(help_text="Negative when overdue")


class DeadlineSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    role_title = serializers.CharField()
    company_name = serializers.CharField()
    deadline = serializers.DateField()
    days_until = serializers.IntegerField()
    match_score = serializers.IntegerField(allow_null=True)


class QuietApplicationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    role_title = serializers.CharField()
    company_name = serializers.CharField()
    status = serializers.ChoiceField(choices=Application.Status.choices)
    date_applied = serializers.DateField(allow_null=True)
    days_quiet = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    today = serializers.DateField()
    stats = DashboardStatsSerializer()
    funnel = FunnelStageSerializer(many=True)
    weekly = WeekSerializer(many=True)
    follow_ups = FollowUpSerializer(many=True)
    deadlines = DeadlineSerializer(many=True)
    gone_quiet = QuietApplicationSerializer(many=True)
