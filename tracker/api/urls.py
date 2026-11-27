from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from . import auth, views

# The router generates the standard REST routes for each viewset, e.g. for applications:
#   applications/        GET list, POST create            name: api-application-list
#   applications/{id}/   GET, PUT, PATCH, DELETE          name: api-application-detail
#   applications/{id}/move/  POST (the @action)           name: api-application-move
router = SimpleRouter()
router.register("companies", views.CompanyViewSet, basename="api-company")
router.register("applications", views.ApplicationViewSet, basename="api-application")
router.register("contacts", views.ContactViewSet, basename="api-contact")
router.register("interactions", views.InteractionViewSet, basename="api-interaction")
router.register("resumes", views.ResumeViewSet, basename="api-resume")

urlpatterns = [
    path("auth/csrf/", auth.CsrfView.as_view(), name="api_csrf"),
    path("auth/login/", auth.LoginView.as_view(), name="api_login"),
    path("auth/logout/", auth.LogoutView.as_view(), name="api_logout"),
    path("auth/me/", auth.MeView.as_view(), name="api_me"),
    path("match/", views.MatchView.as_view(), name="api_match"),
    path("dashboard/", views.DashboardView.as_view(), name="api_dashboard"),
    # OpenAPI schema (the frontend's TypeScript types are generated from it) and a browsable docs page.
    path("schema/", SpectacularAPIView.as_view(), name="api_schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="api_schema"), name="api_docs"),
] + router.urls
