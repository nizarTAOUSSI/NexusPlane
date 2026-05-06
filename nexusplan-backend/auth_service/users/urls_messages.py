from django.urls import path
from . import views_messages

urlpatterns = [
    path("users/<uuid:user_id>/status/", views_messages.user_status, name="user-status"),
    path("direct/store/", views_messages.store_dm, name="store-dm"),
    path("group/store/", views_messages.store_group_msg, name="store-group-msg"),
    path("notifications/store/", views_messages.store_notification, name="store-notification"),
]
