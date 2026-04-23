from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MembershipViewSet, ProjectViewSet

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"memberships", MembershipViewSet, basename="membership")

urlpatterns = [
    path("", include(router.urls)),
]
