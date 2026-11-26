from django.urls import path

from . import views

urlpatterns = [
    path("", views.board, name="board"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("applications/new/", views.ApplicationCreate.as_view(), name="application_create"),
    path("applications/<int:pk>/edit/", views.ApplicationUpdate.as_view(), name="application_update"),
    path("applications/<int:pk>/delete/", views.ApplicationDelete.as_view(), name="application_delete"),
    path("applications/<int:pk>/move/", views.move, name="application_move"),
    path("contacts/", views.ContactList.as_view(), name="contact_list"),
    path("contacts/new/", views.ContactCreate.as_view(), name="contact_create"),
    path("contacts/<int:pk>/", views.ContactDetail.as_view(), name="contact_detail"),
    path("contacts/<int:pk>/edit/", views.ContactUpdate.as_view(), name="contact_update"),
    path("contacts/<int:pk>/delete/", views.ContactDelete.as_view(), name="contact_delete"),
    path("contacts/<int:contact_pk>/interactions/new/", views.InteractionCreate.as_view(), name="interaction_create"),
    path("interactions/<int:pk>/done/", views.interaction_done, name="interaction_done"),
    path("resumes/", views.ResumeList.as_view(), name="resume_list"),
    path("resumes/new/", views.ResumeCreate.as_view(), name="resume_create"),
    path("resumes/<int:pk>/edit/", views.ResumeUpdate.as_view(), name="resume_update"),
    path("resumes/<int:pk>/activate/", views.resume_activate, name="resume_activate"),
]
