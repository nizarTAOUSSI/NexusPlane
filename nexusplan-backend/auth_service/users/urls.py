from django.urls import path

from .views import (
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
]

