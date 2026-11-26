from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Count, Max
from django.http import HttpResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from . import matching, services
from .forms import ApplicationForm, ContactForm, InteractionForm, ResumeForm
from .models import Application, Contact, Interaction, Resume

REMINDER_WINDOW_DAYS = 14


@login_required
def board(request):
    # One query for every application, then grouped in Python (cheaper than one query per column).
    applications = Application.objects.select_related("company").order_by("position", "-updated_at")
    by_status = {value: [] for value in Application.Status.values}
    for application in applications:
        by_status[application.status].append(application)
    columns = [
        {"value": value, "label": label, "applications": by_status[value]}
        for value, label in Application.Status.choices
    ]
    return render(request, "tracker/board.html", {"columns": columns})


@login_required
@require_POST
def move(request, pk):
    """Called by the board after a card is dropped.

    Receives the column the card landed in and the ids of that column in their new
    top-to-bottom order.
    """
    application = get_object_or_404(Application, pk=pk)
    status = request.POST.get("status")
    if status not in Application.Status.values:
        return HttpResponseBadRequest("invalid status")
    try:
        ids = [int(value) for value in request.POST.get("ids", "").split(",") if value]
    except ValueError:
        return HttpResponseBadRequest("invalid ids")

    with transaction.atomic():
        if application.status != status:
            application.status = status
            application.save()  # goes through save() so the StatusChange row is written
        for index, application_id in enumerate(ids):
            # .update() skips save(), which is right here: only position changes, not status.
            Application.objects.filter(pk=application_id, status=status).update(position=index)
    return HttpResponse(status=204)


class ApplicationCreate(LoginRequiredMixin, CreateView):
    model = Application
    form_class = ApplicationForm
    template_name = "tracker/application_form.html"
    success_url = reverse_lazy("board")


class ApplicationUpdate(LoginRequiredMixin, UpdateView):
    model = Application
    form_class = ApplicationForm
    template_name = "tracker/application_form.html"
    success_url = reverse_lazy("board")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        resume = services.active_resume()
        context["has_active_resume"] = resume is not None
        # Computed live from the saved description so the keyword lists are always current.
        if resume and self.object.job_description.strip():
            context["match"] = matching.match(self.object.job_description, resume.text)
        return context


class ApplicationDelete(LoginRequiredMixin, DeleteView):
    model = Application
    template_name = "tracker/application_confirm_delete.html"
    success_url = reverse_lazy("board")


# ---- Contacts and interactions -------------------------------------------------------------


class ContactList(LoginRequiredMixin, ListView):
    template_name = "tracker/contact_list.html"
    context_object_name = "contacts"

    def get_queryset(self):
        # Annotate in the database so the list needs one query, not one per contact.
        return (
            Contact.objects.select_related("company")
            .annotate(interaction_count=Count("interactions"), last_contacted=Max("interactions__date"))
        )


class ContactDetail(LoginRequiredMixin, DetailView):
    model = Contact
    template_name = "tracker/contact_detail.html"

    def get_queryset(self):
        return Contact.objects.select_related("company").prefetch_related("interactions", "applications__company")


class ContactCreate(LoginRequiredMixin, CreateView):
    model = Contact
    form_class = ContactForm
    template_name = "tracker/contact_form.html"

    def get_success_url(self):
        return reverse("contact_detail", args=[self.object.pk])


class ContactUpdate(LoginRequiredMixin, UpdateView):
    model = Contact
    form_class = ContactForm
    template_name = "tracker/contact_form.html"

    def get_success_url(self):
        return reverse("contact_detail", args=[self.object.pk])


class ContactDelete(LoginRequiredMixin, DeleteView):
    model = Contact
    template_name = "tracker/contact_confirm_delete.html"
    success_url = reverse_lazy("contact_list")


class InteractionCreate(LoginRequiredMixin, CreateView):
    model = Interaction
    form_class = InteractionForm
    template_name = "tracker/interaction_form.html"

    def dispatch(self, request, *args, **kwargs):
        self.contact = get_object_or_404(Contact, pk=kwargs["contact_pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        return super().get_context_data(contact=self.contact, **kwargs)

    def form_valid(self, form):
        form.instance.contact = self.contact  # the contact comes from the URL, not from the form
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("contact_detail", args=[self.contact.pk])


@login_required
@require_POST
def interaction_done(request, pk):
    interaction = get_object_or_404(Interaction, pk=pk)
    interaction.follow_up_done = True
    interaction.save(update_fields=["follow_up_done"])
    next_url = request.POST.get("next", "")
    # Only follow "next" if it points back at this site (prevents open-redirect abuse).
    if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        return redirect(next_url)
    return redirect("dashboard")


# ---- Resumes -------------------------------------------------------------------------------


class ResumeList(LoginRequiredMixin, ListView):
    model = Resume
    template_name = "tracker/resume_list.html"
    context_object_name = "resumes"
    ordering = ["-is_active", "-created_at"]


class _ResumeSaveMixin:
    model = Resume
    form_class = ResumeForm
    template_name = "tracker/resume_form.html"
    success_url = reverse_lazy("resume_list")

    def form_valid(self, form):
        response = super().form_valid(form)
        if services.active_resume() is None:
            services.activate(self.object)  # the first resume becomes the active one automatically
        elif self.object.is_active:
            services.rescore_all()  # its text may have changed, so stored scores are stale
        return response


class ResumeCreate(LoginRequiredMixin, _ResumeSaveMixin, CreateView):
    pass


class ResumeUpdate(LoginRequiredMixin, _ResumeSaveMixin, UpdateView):
    pass


@login_required
@require_POST
def resume_activate(request, pk):
    services.activate(get_object_or_404(Resume, pk=pk))
    return redirect("resume_list")


# ---- Dashboard -----------------------------------------------------------------------------


@login_required
def dashboard(request):
    today = timezone.localdate()
    soon = today + timedelta(days=REMINDER_WINDOW_DAYS)

    pending = Interaction.objects.filter(follow_up_date__isnull=False, follow_up_done=False).select_related(
        "contact__company"
    )
    overdue = pending.filter(follow_up_date__lt=today).order_by("follow_up_date")
    upcoming = pending.filter(follow_up_date__gte=today, follow_up_date__lte=soon).order_by("follow_up_date")

    # Roles still in "Saved" are the ones a deadline can still be missed for.
    deadlines = (
        Application.objects.filter(status=Application.Status.SAVED, deadline__gte=today, deadline__lte=soon)
        .select_related("company")
        .order_by("deadline")
    )
    context = {
        "overdue": overdue,
        "upcoming": upcoming,
        "deadlines": deadlines,
        "window": REMINDER_WINDOW_DAYS,
        "today": today,
    }
    return render(request, "tracker/dashboard.html", context)
