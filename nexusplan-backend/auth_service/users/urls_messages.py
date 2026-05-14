from django.urls import path
from . import views_messages

urlpatterns = [
    path("users/<uuid:user_id>/status/", views_messages.user_status, name="user-status"),
    path("direct/store/", views_messages.store_dm, name="store-dm"),
    path("group/store/", views_messages.store_group_msg, name="store-group-msg"),
    path("notifications/store/", views_messages.store_notification, name="store-notification"),
    path("notifications/read-all/", views_messages.notifications_mark_all_read, name="notifications-mark-all-read"),
    path("notifications/<uuid:notif_id>/read/", views_messages.notification_mark_read, name="notification-mark-read"),
    path("notifications/", views_messages.notifications_list, name="notifications-list"),
    path("direct/<uuid:other_user_id>/history/", views_messages.dm_history, name="dm-history"),
    path("group/<str:room_id>/history/", views_messages.group_history, name="group-history"),
    path("conversations/recent/", views_messages.recent_conversations, name="recent-conversations"),
    path("direct/mark-read/", views_messages.mark_dm_read, name="mark-dm-read"),
]
