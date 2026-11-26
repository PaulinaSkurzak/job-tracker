from django.contrib import admin

from .models import Application, Company, Contact, Interaction, Resume, StatusChange


class StatusChangeInline(admin.TabularInline):
    model = StatusChange
    extra = 0
    # History is written by Application.save(); it should never be edited by hand.
    readonly_fields = ["from_status", "to_status", "changed_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["role_title", "company", "status", "term", "date_applied", "deadline", "match_score"]
    list_filter = ["status", "term", "coop_months"]
    search_fields = ["role_title", "company__name", "location"]
    inlines = [StatusChangeInline]


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "role", "email"]
    search_fields = ["name", "company__name"]
    filter_horizontal = ["applications"]


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ["contact", "kind", "date", "follow_up_date"]
    list_filter = ["kind"]


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
