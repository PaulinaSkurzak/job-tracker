from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import auth

urlpatterns = [
    path("auth/csrf/", auth.CsrfView.as_view(), name="api_csrf"),
    path("auth/login/", auth.LoginView.as_view(), name="api_login"),
    path("auth/logout/", auth.LogoutView.as_view(), name="api_logout"),
    path("auth/me/", auth.MeView.as_view(), name="api_me"),
    # OpenAPI schema (the frontend's TypeScript types are generated from it) and a browsable docs page.
    path("schema/", SpectacularAPIView.as_view(), name="api_schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="api_schema"), name="api_docs"),
]
