from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.http import HttpResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DeleteView, UpdateView

from .forms import ApplicationForm
from .models import Application


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


class ApplicationDelete(LoginRequiredMixin, DeleteView):
    model = Application
    template_name = "tracker/application_confirm_delete.html"
    success_url = reverse_lazy("board")
