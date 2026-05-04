"""
admin.py — Register AIRequestLog in Django Admin for cost monitoring.
"""

from django.contrib import admin

from .models import AIRequestLog


@admin.register(AIRequestLog)
class AIRequestLogAdmin(admin.ModelAdmin):
    list_display  = ("id", "userId", "projectId", "promptType", "tokensUsed", "createdAt")
    list_filter   = ("promptType",)
    search_fields = ("userId", "projectId")
    readonly_fields = (
        "id", "userId", "projectId", "promptType", "tokensUsed", "createdAt"
    )
    ordering = ("-createdAt",)

    def has_add_permission(self, request):
        """Logs are created programmatically — disallow manual insertion."""
        return False

    def has_change_permission(self, request, obj=None):
        """Logs are immutable audit records."""
        return False
