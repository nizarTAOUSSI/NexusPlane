import os
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import User, DirectMessage, GroupMessage, Notification

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")

def verify_internal_key(request):
    key = request.headers.get("X-Internal-Key")
    return key and key == INTERNAL_API_KEY

@api_view(["PUT"])
@permission_classes([AllowAny])
def user_status(request, user_id):
    if not verify_internal_key(request):
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    
    is_online = request.data.get("is_online", False)
    user = get_object_or_404(User, id=user_id)
    user.is_online = is_online
    user.save()
    return Response({"status": "ok"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def store_dm(request):
    sender_id = request.data.get("sender_id")
    receiver_id = request.data.get("receiver_id")
    message = request.data.get("message")

    sender = get_object_or_404(User, id=sender_id)
    receiver = get_object_or_404(User, id=receiver_id)

    dm = DirectMessage.objects.create(
        sender=sender,
        receiver=receiver,
        message=message
    )
    return Response({"status": "ok", "id": dm.id})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def store_group_msg(request):
    sender_id = request.data.get("sender_id")
    room_id = request.data.get("room_id")
    room_type = request.data.get("room_type", "group")
    message = request.data.get("message")

    sender = get_object_or_404(User, id=sender_id)

    msg = GroupMessage.objects.create(
        sender=sender,
        room_id=room_id,
        room_type=room_type,
        message=message
    )
    return Response({"status": "ok", "id": msg.id})

@api_view(["POST"])
@permission_classes([AllowAny])
def store_notification(request):
    if not verify_internal_key(request):
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    
    user_id = request.data.get("user_id")
    from_user_id = request.data.get("from_user_id")
    notif_type = request.data.get("type")
    data = request.data.get("data", {})

    user = get_object_or_404(User, id=user_id)
    from_user = User.objects.filter(id=from_user_id).first() if from_user_id else None

    notif = Notification.objects.create(
        user=user,
        from_user=from_user,
        type=notif_type,
        data={"message": data} if isinstance(data, str) else data
    )

    from_user_info = None
    if from_user:
        from_user_info = {
            "id": str(from_user.id),
            "username": from_user.username,
            "email": from_user.email,
            "avatar": from_user.avatar,
        }

    return Response({
        "status": "ok",
        "id": notif.id,
        "created_at": notif.created_at.isoformat(),
        "from_user_info": from_user_info
    })
