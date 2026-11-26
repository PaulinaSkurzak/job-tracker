"""API endpoints. Thin on purpose: validation is in serializers.py, business rules in services.py."""

from django.db.models import Count, Max, Min, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import matching, services
from ..models import Application, Company, Contact, Interaction, Resume
from . import serializers as s


class CompanyViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """List (for autocomplete) and create. No delete: companies are protected while applications use them."""

    queryset = Company.objects.all()
    serializer_class = s.CompanySerializer


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter("status", str, enum=Application.Status.values, description="Only this status"),
            OpenApiParameter("term", str, description="Exact term, e.g. Summer 2027"),
            OpenApiParameter("q", str, description="Search company name or role title"),
        ]
    )
)
class ApplicationViewSet(viewsets.ModelViewSet):
    # No pagination: this is a single person's search (tens to low hundreds of rows), and the board
    # needs every card at once.

    def get_queryset(self):
        queryset = Application.objects.select_related("company").order_by("position", "-updated_at")
        if self.action != "list":
            queryset = queryset.prefetch_related("status_changes", "contacts")
        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("term"):
            queryset = queryset.filter(term=params["term"])
        if params.get("q"):
            queryset = queryset.filter(Q(company__name__icontains=params["q"]) | Q(role_title__icontains=params["q"]))
        return queryset

    def get_serializer_class(self):
        return s.ApplicationSerializer if self.action == "list" else s.ApplicationDetailSerializer

    @extend_schema(request=s.MoveSerializer, responses=s.ApplicationDetailSerializer)
    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Drag and drop: the card lands in `status`; `ids` is that column's new order."""
        application = self.get_object()
        data = s.MoveSerializer(data=request.data, context={"application": application})
        data.is_valid(raise_exception=True)
        services.move(application, data.validated_data["status"], data.validated_data["ids"])
        return Response(s.ApplicationDetailSerializer(self.get_queryset().get(pk=application.pk)).data)


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("q", str, description="Search name or company")])
)
class ContactViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # Annotations compute the list's summary columns in the same query as the contacts themselves.
        queryset = (
            Contact.objects.select_related("company")
            .prefetch_related("applications")
            .annotate(
                interaction_count=Count("interactions", distinct=True),
                last_contacted=Max("interactions__date"),
                next_follow_up=Min(
                    "interactions__follow_up_date", filter=Q(interactions__follow_up_done=False)
                ),
            )
            .order_by("name")
        )
        if self.action != "list":
            queryset = queryset.prefetch_related("interactions")
        if self.request.query_params.get("q"):
            q = self.request.query_params["q"]
            queryset = queryset.filter(Q(name__icontains=q) | Q(company__name__icontains=q))
        return queryset

    def get_serializer_class(self):
        return s.ContactSerializer if self.action == "list" else s.ContactDetailSerializer

    # After a write, read the contact back through get_queryset() so the annotated summary fields are
    # filled in the response (a freshly saved model object does not have them).
    def _refetched(self, contact):
        return self.get_serializer(self.get_queryset().get(pk=contact.pk)).data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(self._refetched(serializer.save()), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        return Response(self._refetched(serializer.save()))

    @extend_schema(request=s.InteractionSerializer, responses={201: s.InteractionSerializer})
    @action(detail=True, methods=["post"])
    def interactions(self, request, pk=None):
        """Log an interaction with this contact."""
        contact = self.get_object()
        serializer = s.InteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(contact=contact)  # the contact comes from the URL
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class InteractionViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Edit an interaction: mark its follow-up done, or snooze it by moving follow_up_date."""

    queryset = Interaction.objects.all()
    serializer_class = s.InteractionSerializer


class ResumeViewSet(viewsets.ModelViewSet):
    queryset = Resume.objects.order_by("-is_active", "-created_at")
    serializer_class = s.ResumeSerializer

    def perform_destroy(self, instance):
        was_active = instance.is_active
        instance.delete()
        if was_active:
            services.rescore_all()  # scores were against this resume; with none active they become null

    @extend_schema(request=None, responses=s.ResumeSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Make this the active resume and rescore every application against it."""
        resume = self.get_object()
        services.activate(resume)
        return Response(s.ResumeSerializer(resume).data)


class MatchView(APIView):
    """Score a job description without saving anything. Powers live scoring as you type."""

    @extend_schema(request=s.MatchRequestSerializer, responses=s.MatchResponseSerializer)
    def post(self, request):
        data = s.MatchRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        resumes = Resume.objects.order_by("-is_active", "-created_at")
        if "resume_id" in data.validated_data:
            resumes = resumes.filter(pk=data.validated_data["resume_id"])
        description = data.validated_data["job_description"]
        results = []
        for resume in resumes:
            result = matching.match(description, resume.text)
            results.append(
                {
                    "resume_id": resume.pk,
                    "resume_name": resume.name,
                    "is_active": resume.is_active,
                    "score": result.score,
                    "matched": result.matched,
                    "missing": result.missing,
                }
            )
        return Response({"results": results})
