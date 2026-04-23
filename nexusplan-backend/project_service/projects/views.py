from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Membership, Project, ProjectStatus
from .serializers import (
    MembershipCreateSerializer,
    MembershipSerializer,
    MembershipUpdateRoleSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
)

_PROJECT_TAG = ["Projects"]
_MEMBERSHIP_TAG = ["Memberships"]


# ---------------------------------------------------------------------------
# ProjectViewSet
# ---------------------------------------------------------------------------


@extend_schema_view(
    list=extend_schema(
        summary="List all projects",
        description=(
            "Returns all non-deleted projects. Supports optional filtering by "
            "`ownerId` and `status` via query parameters."
        ),
        tags=_PROJECT_TAG,
        parameters=[
            OpenApiParameter(
                name="ownerId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter projects by owner UUID (from auth_service).",
                required=False,
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["ACTIVE", "ARCHIVED"],
                description="Filter projects by status. DELETED projects are never returned.",
                required=False,
            ),
        ],
    ),
    create=extend_schema(
        summary="Create a new project",
        description=(
            "Creates a project owned by the authenticated user. "
            "The `ownerId` is resolved exclusively from the `X-User-Id` header "
            "injected by the API Gateway after JWT validation — it cannot be "
            "set directly by the client."
        ),
        request=ProjectSerializer,
        responses={
            201: ProjectSerializer,
            400: OpenApiResponse(description="Validation error."),
            422: OpenApiResponse(description="Missing X-User-Id header."),
        },
        parameters=[
            OpenApiParameter(
                name="X-User-Id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.HEADER,
                description=(
                    "UUID of the authenticated user, injected by the API Gateway "
                    "after validating the Bearer JWT token."
                ),
                required=True,
            ),
        ],
        tags=_PROJECT_TAG,
    ),
    retrieve=extend_schema(
        summary="Retrieve a project by UUID",
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    update=extend_schema(
        summary="Replace project name / description (full update)",
        request=ProjectUpdateSerializer,
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    partial_update=extend_schema(
        summary="Partially update project name / description",
        request=ProjectUpdateSerializer,
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    destroy=extend_schema(
        summary="Soft-delete a project",
        description=(
            "Sets the project status to DELETED. The record is retained in the "
            "database for audit purposes and is no longer returned by list / retrieve."
        ),
        responses={204: None},
        tags=_PROJECT_TAG,
    ),
)
class ProjectViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Project resources.

    Authentication is fully delegated to the API Gateway: every request
    reaching this service through the gateway already carries the caller's
    `X-User-Id` header. The service trusts this header and never validates
    JWTs directly.
    """

    permission_classes = [AllowAny]
    serializer_class = ProjectSerializer

    # ------------------------------------------------------------------
    # Queryset / serializer helpers
    # ------------------------------------------------------------------

    def get_queryset(self):
        """Return non-deleted projects, with optional query-param filters."""
        qs = Project.objects.exclude(status=ProjectStatus.DELETED)

        owner_id = self.request.query_params.get("ownerId")
        filter_status = self.request.query_params.get("status")

        if owner_id:
            qs = qs.filter(ownerId=owner_id)
        if filter_status:
            qs = qs.filter(status=filter_status)

        return qs

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return ProjectUpdateSerializer
        return ProjectSerializer

    # ------------------------------------------------------------------
    # Overridden standard actions
    # ------------------------------------------------------------------

    def perform_create(self, serializer):
        """
        Resolves ownerId from the trusted X-User-Id header.

        The API Gateway validates the Bearer JWT and injects the user's UUID
        as X-User-Id before forwarding the request to this service.
        """
        owner_id = self.request.headers.get("X-User-Id")
        if not owner_id:
            raise ValidationError(
                {
                    "ownerId": (
                        "Missing X-User-Id header. "
                        "This endpoint must be called through the API Gateway."
                    )
                }
            )
        serializer.save(ownerId=owner_id)

    def update(self, request: Request, *args, **kwargs) -> Response:
        """
        PUT / PATCH — accepts ProjectUpdateSerializer input,
        returns a full ProjectSerializer response.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        write_serializer = ProjectUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        write_serializer.is_valid(raise_exception=True)
        project = write_serializer.save()
        return Response(ProjectSerializer(project).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Soft-delete: transitions status to DELETED instead of removing the row."""
        project = self.get_object()
        project.status = ProjectStatus.DELETED
        project.save(update_fields=["status", "updatedAt"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Custom actions — UML methods
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Archive a project",
        description=(
            "Transitions project status from ACTIVE → ARCHIVED. "
            "Returns 409 if the project is already ARCHIVED or DELETED."
        ),
        request=None,
        responses={
            200: ProjectSerializer,
            409: OpenApiResponse(
                description="Project is not in ACTIVE status and cannot be archived."
            ),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="archive")
    def archive(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Change the project status to ARCHIVED (UML: archive())."""
        project = self.get_object()
        if project.status != ProjectStatus.ACTIVE:
            return Response(
                {
                    "detail": (
                        f"Cannot archive a project with status '{project.status}'. "
                        "Only ACTIVE projects can be archived."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        project.status = ProjectStatus.ARCHIVED
        project.save(update_fields=["status", "updatedAt"])
        return Response(ProjectSerializer(project).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List members of a project",
        description=(
            "Returns all Membership records associated with the project, "
            "including each member's userId, role, and joinedAt timestamp."
        ),
        responses={
            200: MembershipSerializer(many=True),
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["get"], url_path="members")
    def get_members(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Return all Membership records for this project (UML: getMembers())."""
        project = self.get_object()
        memberships = project.memberships.all()
        serializer = MembershipSerializer(memberships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# MembershipViewSet
# ---------------------------------------------------------------------------


@extend_schema_view(
    create=extend_schema(
        summary="Invite a user to a project",
        description=(
            "Creates a Membership record linking a userId (UUID from auth_service) "
            "to a project with a given role. Returns 400 if the user is already "
            "a member of that project."
        ),
        request=MembershipCreateSerializer,
        responses={
            201: MembershipSerializer,
            400: OpenApiResponse(
                description="Validation error, or user is already a member."
            ),
        },
        parameters=[
            OpenApiParameter(
                name="userId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description=(
                    "UUID of the user to invite (from auth_service). "
                    "Pass this value in the request body, not as a query param — "
                    "documented here for Swagger discoverability."
                ),
                required=False,
            ),
        ],
        tags=_MEMBERSHIP_TAG,
    ),
    destroy=extend_schema(
        summary="Remove a member from a project",
        description="Permanently deletes the Membership record identified by its UUID.",
        responses={204: None, 404: OpenApiResponse(description="Membership not found.")},
        tags=_MEMBERSHIP_TAG,
    ),
)
class MembershipViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for managing project memberships.

    Endpoints:
      POST   /api/memberships/                      → invite a member  (create)
      PATCH  /api/memberships/{id}/update-role/     → change their role (update_role)
      DELETE /api/memberships/{id}/                 → remove a member   (destroy)
    """

    permission_classes = [AllowAny]
    queryset = Membership.objects.select_related("projectId")

    def get_serializer_class(self):
        if self.action == "create":
            return MembershipCreateSerializer
        return MembershipSerializer

    def create(self, request: Request, *args, **kwargs) -> Response:
        """
        Invite a member — returns full MembershipSerializer on success.

        Uses MembershipCreateSerializer for input validation and
        MembershipSerializer for the 201 response payload.
        """
        write_serializer = MembershipCreateSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        membership = write_serializer.save()
        return Response(
            MembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # Custom action — UML: updateRole()
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Update a member's role",
        description=(
            "Changes the role of an existing membership. "
            "Accepted values: VIEWER | CONTRIBUTOR | MANAGER."
        ),
        request=MembershipUpdateRoleSerializer,
        responses={
            200: MembershipSerializer,
            400: OpenApiResponse(description="Invalid role value."),
            404: OpenApiResponse(description="Membership not found."),
        },
        tags=_MEMBERSHIP_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="update-role")
    def update_role(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Change the role of a project member (UML: updateRole())."""
        membership = self.get_object()
        serializer = MembershipUpdateRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.role = serializer.validated_data["role"]
        membership.save(update_fields=["role"])
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)
