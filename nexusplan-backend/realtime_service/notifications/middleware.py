"""
JWT Authentication Middleware for Django Channels WebSocket connections.

Extracts the Bearer token from the ?token= query parameter
(WS clients cannot send Authorization headers), decodes it,
and injects user_id into the ASGI scope.

The consumer decides whether to enforce authentication;
this middleware never closes the connection by itself.
"""

import jwt
from urllib.parse import parse_qs

from django.conf import settings


class JWTAuthMiddleware:
    """
    Wraps a Channels ASGI application.

    Usage::

        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))

    Scope keys injected:
    - ``scope["user_id"]``  : str | None  — decoded user UUID
    - ``scope["is_authenticated"]`` : bool
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params       = parse_qs(query_string)
        token        = params.get("token", [None])[0]

        user_id        = None
        is_authenticated = False

        if token:
            try:
                payload = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=["HS256"],
                )
                user_id = str(
                    payload.get("user_id")
                    or payload.get("sub")
                    or ""
                ) or None
                if user_id:
                    is_authenticated = True
            except jwt.ExpiredSignatureError:
                pass   
            except jwt.InvalidTokenError:
                pass   

        scope["user_id"]         = user_id
        scope["is_authenticated"] = is_authenticated

        return await self.inner(scope, receive, send)
