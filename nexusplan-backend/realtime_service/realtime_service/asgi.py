"""
ASGI configuration for realtime_service — NexusPlan.

Handles both:
- HTTP  → standard Django ASGI application (health-check, schema endpoints)
- WS    → Django Channels with JWT auth middleware + URL router
"""

import os

import django
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "realtime_service.settings")

django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter   
from notifications.middleware import JWTAuthMiddleware       
from notifications.routing import websocket_urlpatterns      

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        ),
    }
)
