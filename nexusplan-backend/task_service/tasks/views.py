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

from .models import Task, TaskPriority, TaskStatus
from .serializers import (
    TaskAssignSerializer,
    TaskCreateSerializer,
    TaskSerializer,
    TaskStatusUpdateSerializer,
    TaskUpdateSerializer,
)

_TASK_TAG = ["Tasks"]


def _get_requester_id(request: Request) -> str | None:
    """Extract the trusted user UUID injected by the API Gateway."""
    return request.headers.get("X-User-Id")



@extend_schema_view(
    list=extend_schema(
        summary="List tasks",
        description=(
            "Returns all tasks. Use ``projectId`` to filter by project, "
            "``assigneeId`` to filter by assignee, and ``status`` / ``priority`` "
            "to narrow results further. All filters can be combined."
        ),
        parameters=[
            OpenApiParameter(
                name="projectId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter tasks belonging to this project.",
            ),
            OpenApiParameter(
                name="assigneeId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter tasks assigned to this user.",
            ),
            OpenApiParameter(
                name="creatorId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter tasks created by this user.",
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=TaskStatus.values,
                description="Filter by task status.",
            ),
            OpenApiParameter(
                name="priority",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=TaskPriority.values,
                description="Filter by task priority.",
            ),
        ],
        responses={200: TaskSerializer(many=True)},
        tags=_TASK_TAG,
    ),
    retrieve=extend_schema(
        summary="Get a task",
        responses={200: TaskSerializer},
        tags=_TASK_TAG,
    ),
    create=extend_schema(
        summary="Create a task",
        description=(
            "Creates a new task. ``creatorId`` is resolved automatically from "
            "the ``X-User-Id`` header injected by the API Gateway."
        ),
        request=TaskCreateSerializer,
        responses={
            201: TaskSerializer,
            400: OpenApiResponse(description="Validation error."),
        },
        tags=_TASK_TAG,
    ),
    update=extend_schema(
        summary="Update a task (full)",
        request=TaskUpdateSerializer,
        responses={200: TaskSerializer},
        tags=_TASK_TAG,
    ),
    partial_update=extend_schema(
        summary="Update a task (partial)",
        request=TaskUpdateSerializer,
        responses={200: TaskSerializer},
        tags=_TASK_TAG,
    ),
    destroy=extend_schema(
        summary="Delete a task",
        responses={204: OpenApiResponse(description="Task deleted.")},
        tags=_TASK_TAG,
    ),
)
class TaskViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):

    queryset = Task.objects.all()
    permission_classes = [AllowAny] 

    def get_serializer_class(self):
        if self.action == "create":
            return TaskCreateSerializer
        if self.action in ("update", "partial_update"):
            return TaskUpdateSerializer
        if self.action == "update_status":
            return TaskStatusUpdateSerializer
        if self.action == "assign":
            return TaskAssignSerializer
        return TaskSerializer


    def get_queryset(self):
        qs = Task.objects.all()

        project_id  = self.request.query_params.get("projectId")
        assignee_id = self.request.query_params.get("assigneeId")
        creator_id  = self.request.query_params.get("creatorId")
        task_status = self.request.query_params.get("status")
        priority    = self.request.query_params.get("priority")

        if project_id:
            qs = qs.filter(projectId=project_id)
        if assignee_id:
            qs = qs.filter(assigneeId=assignee_id)
        if creator_id:
            qs = qs.filter(creatorId=creator_id)
        if task_status:
            qs = qs.filter(status=task_status)
        if priority:
            qs = qs.filter(priority=priority)

        return qs

    def perform_create(self, serializer):
        creator_id = _get_requester_id(self.request)
        if not creator_id:
            raise ValidationError({
                    "creatorId": (
                        "Missing X-User-Id header. "
                        "This endpoint must be called through the API Gateway."
                    )
                }
            )
        serializer.save(creatorId=creator_id)

    def update(self, request: Request, *args, **kwargs) -> Response:
        """PUT / PATCH — returns full TaskSerializer response."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        write_serializer = TaskUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        write_serializer.is_valid(raise_exception=True)
        task = write_serializer.save()
        return Response(TaskSerializer(task).data)

    @extend_schema(
        summary="Update task status",
        description=(
            "Transitions the task to a new status. "
            "Accepted values: ``TODO``, ``IN_PROGRESS``, ``REVIEW``, ``DONE``."
        ),
        request=TaskStatusUpdateSerializer,
        responses={
            200: TaskSerializer,
            400: OpenApiResponse(description="Invalid or missing status value."),
        },
        tags=_TASK_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request: Request, pk=None) -> Response: 
        """Transition the task to a new status (UML: updateStatus())."""
        task = self.get_object()
        serializer = TaskStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.status = serializer.validated_data["status"]
        task.save(update_fields=["status", "updatedAt"])
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Assign a task",
        description=(
            "Assigns the task to a project member identified by ``assigneeId``. "
            "Send ``assigneeId: null`` to unassign the task."
        ),
        request=TaskAssignSerializer,
        responses={
            200: TaskSerializer,
            400: OpenApiResponse(description="Invalid assigneeId."),
        },
        tags=_TASK_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="assign")
    def assign(self, request: Request, pk=None) -> Response:
        """Assign (or unassign) the task (UML: assign())."""
        task = self.get_object()
        serializer = TaskAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.assigneeId = serializer.validated_data.get("assigneeId")
        task.save(update_fields=["assigneeId", "updatedAt"])
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)
