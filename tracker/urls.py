from django.urls import path

from . import views

urlpatterns = [
    path("", views.board, name="board"),
    path("applications/new/", views.ApplicationCreate.as_view(), name="application_create"),
    path("applications/<int:pk>/edit/", views.ApplicationUpdate.as_view(), name="application_update"),
    path("applications/<int:pk>/delete/", views.ApplicationDelete.as_view(), name="application_delete"),
    path("applications/<int:pk>/move/", views.move, name="application_move"),
]
