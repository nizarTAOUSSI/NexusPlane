import os
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
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
@permission_classes([AllowAny])
def store_dm(request):
    if not verify_internal_key(request):
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
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
@permission_classes([AllowAny])
def store_group_msg(request):
    if not verify_internal_key(request):
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dm_history(request, other_user_id):
    other_user = get_object_or_404(User, id=other_user_id)
    messages = DirectMessage.objects.filter(
        Q(sender=request.user, receiver=other_user) |
        Q(sender=other_user, receiver=request.user)
    ).order_by("created_at")[:100]

    return Response([{
        "id": str(m.id),
        "senderId": str(m.sender_id),
        "senderName": m.sender.username,
        "message": m.message,
        "timestamp": m.created_at.isoformat(),
        "type": "dm",
    } for m in messages])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def group_history(request, room_id):
    messages = GroupMessage.objects.filter(room_id=room_id).order_by("created_at")[:100]

    return Response([{
        "id": str(m.id),
        "senderId": str(m.sender_id),
        "senderName": m.sender.username,
        "message": m.message,
        "timestamp": m.created_at.isoformat(),
        "type": "group",
        "roomId": m.room_id,
    } for m in messages])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_conversations(request):
    """
    Returns the last message for each conversation the authenticated user
    has participated in.

    Query params:
      group_ids  — comma-separated list of group room IDs the caller belongs to.
                   Without this, only DM conversations are included.
    """
    user = request.user
    group_ids_param = request.query_params.get("group_ids", "")
    group_ids = [g.strip() for g in group_ids_param.split(",") if g.strip()]

    results = []

    all_dms = (
        DirectMessage.objects
        .filter(Q(sender=user) | Q(receiver=user))
        .order_by("-created_at")
        .select_related("sender", "receiver")
    )

    seen_partners: set = set()
    for dm in all_dms:
        partner = dm.receiver if str(dm.sender_id) == str(user.id) else dm.sender
        if partner.id in seen_partners:
            continue
        seen_partners.add(partner.id)

        unread = DirectMessage.objects.filter(
            sender=partner, receiver=user, is_read=False
        ).count()

        results.append({
            "type": "dm",
            "roomId": str(partner.id),
            "lastMsg": dm.message,
            "lastTime": dm.created_at.isoformat(),
            "unread": unread,
        })

    # --- Groups: latest message per requested room ---
    for room_id in group_ids:
        last = (
            GroupMessage.objects
            .filter(room_id=room_id)
            .order_by("-created_at")
            .select_related("sender")
            .first()
        )
        if last:
            results.append({
                "type": "group",
                "roomId": room_id,
                "lastMsg": last.message,
                "lastTime": last.created_at.isoformat(),
                "unread": 0,
            })

    results.sort(key=lambda x: x["lastTime"], reverse=True)
    return Response(results)
