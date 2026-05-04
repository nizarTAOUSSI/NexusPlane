"""
WebSocket URL routing for the notifications app.

The API Gateway (Nginx) strips the leading /ws and forwards to this service,
so patterns here match paths that start AFTER the /ws prefix.

Full external URL:
    wss://nexusplane.duckdns.org/ws/projects/<project_id>/?token=<jwt>

Nginx proxy_pass:
    location /ws/ {
        proxy_pass http://realtime_service:8000;
    }

Path received by Daphne (this service):
    /ws/projects/<project_id>/
"""

from django.urls import re_path

from .consumers import BoardConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/projects/(?P<project_id>[0-9a-f-]+)/$",
        BoardConsumer.as_asgi(),
        name="board-ws",
    ),
]
