"""Root URLs. The Next.js frontend owns every other path; nginx sends only these to Django."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tracker.api.urls')),  # JSON API for the Next.js frontend
]
