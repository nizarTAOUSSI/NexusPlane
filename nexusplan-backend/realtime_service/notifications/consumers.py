"""
BoardConsumer — Django Channels WebSocket consumer for NexusPlan.

Handles real-time Kanban board synchronisation for a single project room.

Connection URL (as routed by the API Gateway):
    ws[s]://nexusplane.duckdns.org/ws/projects/<project_id>/?token=<jwt>

Group name convention:
    "project_<uuid_with_underscores>"
    Example: "project_0ff2b26a_c4a5_4bf6_a301_f2cc09ea2101"
    (hyphens replaced because Redis group names must be alphanumeric + underscores)

Supported inbound event types (sent by the frontend):
    task_created   — a new task was created
    task_updated   — a task was edited (title, description, priority…)
    task_moved     — a task was dragged to a new status column
    task_deleted   — a task was removed
    member_joined  — a user joined the project (informational)
    member_left    — a user left the project (informational)
    ping           — keepalive; responded with pong (not broadcast)

Every inbound message must be a JSON object with at least:
    { "type": "<event_type>", ... }

The consumer broadcasts every event to the entire project group,
enriching it with the authenticated userId and a server-side timestamp.
"""

import json
import logging
from datetime import datetime, timezone

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

_presence: dict[str, set[str]] = {}


ALLOWED_ACTIONS = {
    "task_created",
    "task_updated",
    "task_moved",
    "task_deleted",
    "member_joined",
    "member_left",
    "cursor_move",
}


def _group_name(project_id: str) -> str:
    """Build a Redis-safe group name from a UUID string."""
    return f"project_{project_id.replace('-', '_')}"


class BoardConsumer(AsyncWebsocketConsumer):
    """
    One instance per WebSocket connection.

    Lifecycle:
        connect()      → validate project_id, add channel to group, accept
        receive()      → validate + broadcast inbound message to the group
        board_message()→ push a group message to this specific WebSocket
        disconnect()   → remove channel from group
    """

    async def connect(self):
        """
        Accept the WebSocket connection and subscribe to the project group.

        Closes (403) if:
        - project_id is missing from the URL
        - the client is not authenticated (no valid JWT provided)
        """
        self.project_id  = self.scope["url_route"]["kwargs"].get("project_id", "")
        self.user_id     = self.scope.get("user_id")
        self.group_name  = _group_name(str(self.project_id))

        if not self.scope.get("is_authenticated"):
            logger.warning(
                "WS rejected: unauthenticated connection attempt "
                "(project=%s)", self.project_id
            )
            await self.close(code=4001)
            return

        if not self.project_id:
            await self.close(code=4002)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        existing = set(_presence.get(self.group_name, set()))
        _presence.setdefault(self.group_name, set()).add(str(self.user_id))

        if existing:
            await self.send(text_data=json.dumps({
                "type":      "presence_list",
                "userIds":   list(existing),
                "timestamp": _now(),
            }))

        logger.info(
            "WS connected: user=%s  project=%s  channel=%s",
            self.user_id, self.project_id, self.channel_name,
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type":       "board_message",
                "event":      "user_connected",
                "userId":     self.user_id,
                "projectId":  str(self.project_id),
                "timestamp":  _now(),
            },
        )

  

    async def disconnect(self, close_code: int):
        """Remove this channel from the project group on disconnect."""
        if hasattr(self, "group_name"):
            group_presence = _presence.get(self.group_name)
            if group_presence:
                group_presence.discard(str(self.user_id))
                if not group_presence:
                    _presence.pop(self.group_name, None)

            await self.channel_layer.group_discard(self.group_name, self.channel_name)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type":      "board_message",
                    "event":     "user_disconnected",
                    "userId":    self.user_id,
                    "projectId": str(self.project_id),
                    "timestamp": _now(),
                },
            )

        logger.info(
            "WS disconnected: user=%s  project=%s  code=%s",
            getattr(self, "user_id", "?"),
            getattr(self, "project_id", "?"),
            close_code,
        )

    

    async def receive(self, text_data: str):
        """
        Handle a message sent by the frontend.

        Expected JSON shape::

            {
                "type":     "task_moved",    // required
                "taskId":   "<uuid>",
                "status":   "IN_PROGRESS",
                "payload":  { ... }          // optional extra data
            }

        The consumer:
        1. Validates the message.
        2. Enriches it with userId + projectId + timestamp.
        3. Broadcasts to the whole group (including this channel).
        """
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON")
            return

        event_type = data.get("type") or data.get("action")

        if not event_type:
            await self._send_error("Missing 'type' field")
            return

        if event_type == "ping":
            await self.send(text_data=json.dumps({
                "type":      "pong",
                "timestamp": _now(),
            }))
            return

        if event_type not in ALLOWED_ACTIONS:
            await self._send_error(f"Unknown event type: '{event_type}'")
            return

        message = {
            "type":       "board_message",   
            "event":      event_type,
            "projectId":  str(self.project_id),
            "userId":     self.user_id,
            "timestamp":  _now(),
            "taskId":     data.get("taskId"),
            "status":     data.get("status"),
            "priority":   data.get("priority"),
            "assigneeIds":data.get("assigneeIds"),
            "payload":    data.get("payload", {}),
        }

        await self.channel_layer.group_send(self.group_name, message)

        logger.debug(
            "WS broadcast: event=%s  project=%s  user=%s",
            event_type, self.project_id, self.user_id,
        )

    async def board_message(self, event: dict):
        """
        Relay a group message down to this specific WebSocket connection.

        The ``type`` key consumed by the channel layer is stripped before
        sending to the browser.
        """
        browser_payload = {k: v for k, v in event.items() if k != "type"}
        browser_payload["type"] = event.get("event", "board_message")

        await self.send(text_data=json.dumps(browser_payload))

    async def _send_error(self, message: str):
        """Send an error frame to this client only (not broadcast)."""
        await self.send(text_data=json.dumps({
            "type":    "error",
            "message": message,
        }))



def _now() -> str:
    """ISO-8601 UTC timestamp."""
    return datetime.now(tz=timezone.utc).isoformat()
