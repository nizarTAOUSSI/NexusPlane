from django.contrib import admin

from .models import Membership, Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "status", "ownerId", "createdAt")
    list_filter = ("status",)
    search_fields = ("name", "ownerId")
    readonly_fields = ("id", "createdAt", "updatedAt")
    ordering = ("-createdAt",)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "projectId", "userId", "role", "joinedAt")
    list_filter = ("role",)
    search_fields = ("userId",)
    readonly_fields = ("id", "joinedAt")
