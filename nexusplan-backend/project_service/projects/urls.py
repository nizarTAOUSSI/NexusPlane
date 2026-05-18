from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MembershipViewSet, ProjectViewSet, TeamViewSet, AdminProjectListView

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"memberships", MembershipViewSet, basename="membership")
router.register(r"teams", TeamViewSet, basename="team")

urlpatterns = [
    path("admin/all/", AdminProjectListView.as_view(), name="admin-all-projects"),
    path("", include(router.urls)),
]
