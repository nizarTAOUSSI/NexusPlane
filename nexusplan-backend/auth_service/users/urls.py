from django.urls import path

from .views import (
    AdminAIRequestLogsView,
    AdminProjectsWithMembersView,
    AdminUsersView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    LookupByEmailView,
    LookupByIdView,
    LookupByIdsView,
    RegisterView,
    UpdateProfileView,
    GoogleLoginView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("google-login/", GoogleLoginView.as_view(), name="auth-google-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("profile/", UpdateProfileView.as_view(), name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("lookup/", LookupByEmailView.as_view(), name="auth-lookup-by-email"),
    path("lookup-by-id/", LookupByIdView.as_view(), name="auth-lookup-by-id"),
    path("lookup-by-ids/", LookupByIdsView.as_view(), name="auth-lookup-by-ids"),
    path("admin/users/", AdminUsersView.as_view(), name="auth-admin-users"),
    path("admin/ai-request-logs/", AdminAIRequestLogsView.as_view(), name="auth-admin-ai-request-logs"),
    path("admin/projects-with-members/", AdminProjectsWithMembersView.as_view(), name="auth-admin-projects-with-members"),
]

