require('dotenv').config();

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const fetch   = require('node-fetch');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const DJANGO_URL        = process.env.DJANGO_URL        || 'http://localhost:8000';
const COPILOT_ENDPOINT_URL = process.env.COPILOT_ENDPOINT_URL || 'http://ai_service:8000/api/ai/copilot/';
const COPILOT_ENDPOINT_FALLBACK_URL = process.env.COPILOT_ENDPOINT_FALLBACK_URL || 'https://nexusplan.duckdns.org/api/ai/copilot/';
const COPILOT_INTERNAL_HOST_HEADER = process.env.COPILOT_INTERNAL_HOST_HEADER || 'ai_service';
const NEXUS_AI_NAME = process.env.NEXUS_AI_NAME || 'Nexus AI';
const NEXUS_AI_AVATAR = process.env.NEXUS_AI_AVATAR || 'https://nexusplan.duckdns.org/logoNexus.png';
const INTERNAL_API_KEY  = process.env.INTERNAL_API_KEY  || '';
const PORT              = process.env.PORT              || 5000;

const API_USER_STATUS        = process.env.API_USER_STATUS        || '/api/messages/users/:userId/status/';
const API_STORE_DM           = process.env.API_STORE_DM           || '/api/messages/direct/store/';
const API_STORE_GROUP_MSG    = process.env.API_STORE_GROUP_MSG    || '/api/messages/group/store/';
const API_STORE_NOTIFICATION = process.env.API_STORE_NOTIFICATION || '/api/messages/notifications/store/';
const API_MARK_DM_READ       = process.env.API_MARK_DM_READ       || '/api/messages/direct/mark-read/';
const API_ENSURE_NEXUS_AI    = process.env.API_ENSURE_NEXUS_AI    || '/api/messages/system/nexus-ai/ensure/';

console.log('🚀 NexusPlan Chat Service starting…');
console.log('   DJANGO_URL :', DJANGO_URL);
console.log('   COPILOT_ENDPOINT_URL :', COPILOT_ENDPOINT_URL);
console.log('   COPILOT_ENDPOINT_FALLBACK_URL :', COPILOT_ENDPOINT_FALLBACK_URL);
console.log('   COPILOT_INTERNAL_HOST_HEADER :', COPILOT_INTERNAL_HOST_HEADER);
console.log('   NEXUS_AI_NAME :', NEXUS_AI_NAME);
console.log('   NEXUS_AI_AVATAR :', NEXUS_AI_AVATAR);
console.log('   INTERNAL_API_KEY :', INTERNAL_API_KEY ? '✅ set' : '⚠️  missing');


const internalHeaders = {
    'Content-Type': 'application/json',
    'X-Internal-Key': INTERNAL_API_KEY,
    'Host': 'localhost',
};

const resolveUrl = (template, params = {}) =>
    Object.entries(params).reduce(
        (url, [k, v]) => url.replace(`:${k}`, v),
        `${DJANGO_URL}${template}`
    );

let nexusAiUserIdCache = null;

function messageMentionsNexusAI(text = '') {
    return /@nexus(?:[\s_-]*ai)\b/i.test(String(text));
}

function cleanNexusAiMention(text = '') {
    return String(text).replace(/@nexus(?:[\s_-]*ai)\b/gi, '').trim();
}

function buildNexusAiPrompt(text = '') {
    const cleaned = cleanNexusAiMention(text);
    if (cleaned.length >= 3) {
        return cleaned;
    }

    const original = String(text).trim();
    if (original.length >= 3) {
        return `Please respond to this team chat message: ${original}`;
    }

    return 'Please help with this team chat request.';
}

async function ensureNexusAiUserId() {
    if (nexusAiUserIdCache) return nexusAiUserIdCache;
    const data = await djangoFetch(resolveUrl(API_ENSURE_NEXUS_AI), 'POST', {});
    if (data?.id) {
        nexusAiUserIdCache = String(data.id);
        return nexusAiUserIdCache;
    }
    return null;
}

async function djangoFetch(url, method = 'POST', body, headers = internalHeaders) {
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text();
            console.warn(`[django] ${method} ${url} → ${res.status}`, text.slice(0, 200));
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error(`[django] fetch error: ${err.message}`);
        return null;
    }
}

async function fetchJsonDetailed(url, method = 'POST', body, headers = { 'Content-Type': 'application/json' }) {
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
        });

        const raw = await res.text();
        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }

        return {
            ok: res.ok,
            status: res.status,
            data: parsed,
            text: raw,
        };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            data: null,
            text: err.message || 'Network error',
        };
    }
}

async function maybeSendNexusAiReply({ senderId, roomId, roomType, roomSocketName, originalMessage, replyToId }) {
    if (!senderId || !roomId || !messageMentionsNexusAI(originalMessage)) return;

    const aiUserId = await ensureNexusAiUserId();
    if (!aiUserId || String(senderId) === String(aiUserId)) {
        console.warn('[nexus-ai] Missing bot user id or sender is bot, skipping response');
        return;
    }

    const prompt = buildNexusAiPrompt(originalMessage);
    const aiPayload = {
        message: prompt,
        context: {
            source: 'group_chat',
            roomId,
            roomType,
        },
    };

    const endpointCandidates = [COPILOT_ENDPOINT_URL, COPILOT_ENDPOINT_FALLBACK_URL]
        .map((u) => String(u || '').trim())
        .filter(Boolean);

    let aiResponse = null;
    let aiEndpointUsed = '';
    let typingSent = false;

    io.to(roomSocketName).emit('userTyping', {
        room: roomSocketName,
        userId: aiUserId,
        isTyping: true,
        displayName: NEXUS_AI_NAME,
        avatar: NEXUS_AI_AVATAR,
        isBot: true,
    });
    typingSent = true;

    try {
        for (const endpoint of endpointCandidates) {
            const endpointHeaders = {
                'Content-Type': 'application/json',
                'X-User-Id': String(senderId),
            };

            if (endpoint.includes('ai_service')) {
                endpointHeaders.Host = COPILOT_INTERNAL_HOST_HEADER;
            }

            const attempt = await fetchJsonDetailed(
                endpoint,
                'POST',
                aiPayload,
                endpointHeaders
            );

            if (attempt.ok && attempt?.data?.reply) {
                aiResponse = attempt;
                aiEndpointUsed = endpoint;
                break;
            }

            console.warn(
                `[nexus-ai] Copilot endpoint attempt failed endpoint=${endpoint} status=${attempt.status} detail=${String(attempt?.data?.detail || attempt?.text || 'Unknown').slice(0, 200)}`
            );

            if (!aiResponse || aiResponse.status === 0) {
                aiResponse = attempt;
            }
        }

        if (aiEndpointUsed) {
            console.log(`[nexus-ai] Copilot reply generated via endpoint=${aiEndpointUsed}`);
        }

        let replyText = aiResponse?.data?.reply ? String(aiResponse.data.reply).trim() : '';
        if (!replyText) {
            const backendDetail =
                aiResponse?.data?.detail
                || aiResponse?.data?.error
                || aiResponse?.text
                || 'Unknown error';
            console.warn(
                `[nexus-ai] Copilot request failed/empty (status=${aiResponse?.status || 'n/a'}) detail=${String(backendDetail).slice(0, 300)}`
            );

            if ((aiResponse?.status || 0) >= 500) {
                replyText = 'Nexus AI provider is currently unavailable (server error). Please try again shortly.';
            } else if (aiResponse?.status === 401) {
                replyText = 'Nexus AI authorization failed (missing or invalid identity header).';
            } else if (aiResponse?.status === 400) {
                replyText = 'Nexus AI could not process this request. Try a clearer prompt after @nexus-ai.';
            } else if (aiResponse?.status === 0) {
                replyText = 'Nexus AI service is unreachable from chat service (network/connection error).';
            } else {
                replyText = 'Nexus AI is temporarily unavailable right now. Please try again in a moment.';
            }
        }

        const savedAi = await djangoFetch(
            resolveUrl(API_STORE_GROUP_MSG),
            'POST',
            {
                sender_id: aiUserId,
                room_id: roomId,
                room_type: roomType || 'group',
                message: replyText,
                reply_to_id: replyToId || null,
            }
        );

        if (!savedAi || savedAi.status !== 'ok') {
            console.warn('[nexus-ai] Failed to persist AI reply in group messages');
            return;
        }

        io.to(roomSocketName).emit('receiveMessage', {
            type: 'group',
            roomId,
            roomType: roomType || 'group',
            senderId: aiUserId,
            senderName: savedAi.senderName || NEXUS_AI_NAME,
            message: replyText,
            timestamp: new Date().toISOString(),
            id: savedAi.id,
            replyTo: savedAi.replyTo || undefined,
        });
    } finally {
        if (typingSent) {
            io.to(roomSocketName).emit('userTyping', {
                room: roomSocketName,
                userId: aiUserId,
                isTyping: false,
                displayName: NEXUS_AI_NAME,
                avatar: NEXUS_AI_AVATAR,
                isBot: true,
            });
        }
    }
}

const usersOnline = {};

app.use(express.json());

app.get('/', (_req, res) =>
    res.json({ status: 'ok', service: 'nexusplan-chat', version: '2.0.0' })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/internal/appeal-notifications/', (req, res) => {
    if (req.headers['x-internal-key'] !== INTERNAL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const recipientIds = Array.isArray(req.body?.recipient_ids) ? req.body.recipient_ids.map(String) : [];
    const notification = req.body?.notification || {};

    if (!recipientIds.length || !notification?.id) {
        return res.status(400).json({ error: 'recipient_ids and notification.id are required' });
    }

    let delivered = 0;
    for (const recipientId of recipientIds) {
        const socketId = usersOnline[recipientId];
        if (!socketId) continue;

        io.to(socketId).emit('receiveNotification', {
            id: notification.id,
            type: notification.type || 'deactivation_appeal_submitted',
            data: notification.data || {},
            is_read: false,
            created_at: notification.created_at || new Date().toISOString(),
            from_user: notification.from_user ?? null,
            from_user_info: notification.from_user_info ?? null,
        });
        delivered += 1;
    }

    return res.json({ status: 'ok', delivered, recipients: recipientIds.length });
});


io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    let userToken    = null;
    let currentUserId = null;

    socket.on('userOnline', async ({ userId, token }) => {
        userToken     = token;
        currentUserId = userId;
        usersOnline[userId] = socket.id;
        await djangoFetch(
            resolveUrl(API_USER_STATUS, { userId }),
            'PUT',
            { is_online: true }
        );

        io.emit('userStatusChange', { userId, isOnline: true });
        console.log(`[presence] ${userId} online  (total: ${Object.keys(usersOnline).length})`);
    });
    socket.on('joinRoom', (payload) => {
        let room;

        if (typeof payload === 'string') {
            room = payload;
        } else if (payload.type === 'dm') {
            const ids = [String(payload.targetUserId), String(currentUserId || payload.senderId || '')].sort();
            room = `dm_${ids[0]}_${ids[1]}`;
        } else if (payload.type === 'group') {
            room = `group_${payload.roomId}`;
        } else {
            console.warn('[joinRoom] unknown payload', payload);
            return;
        }

        socket.join(room);
        socket.emit('joinedRoom', { room });
        console.log(`[room] ${socket.id} joined: ${room}`);
    });

    socket.on('sendDM', async ({ receiverId, message, senderId: payloadSenderId, senderName }) => {
        const senderId = currentUserId || payloadSenderId;
        if (!senderId) { socket.emit('error', { message: 'Not identified — call userOnline first' }); return; }

        const ids  = [String(senderId), String(receiverId)].sort();
        const room = `dm_${ids[0]}_${ids[1]}`;

        const payload = {
            type:       'dm',
            senderId,
            senderName: senderName || undefined,
            receiverId,
            message,
            timestamp:  new Date().toISOString(),
        };

        io.to(room).emit('receiveMessage', payload);

        const receiverSocketIdEarly = usersOnline[receiverId];
        if (receiverSocketIdEarly) {
            try {
                const roomSockets = await io.in(room).fetchSockets();
                const isInRoom = roomSockets.some(s => s.id === receiverSocketIdEarly);
                if (!isInRoom) {
                    io.to(receiverSocketIdEarly).emit('receiveMessage', payload);
                }
            } catch {
                io.to(receiverSocketIdEarly).emit('receiveMessage', payload);
            }
        }

        const saved = await djangoFetch(
            resolveUrl(API_STORE_DM),
            'POST',
            { sender_id: senderId, receiver_id: receiverId, message }
        );

        const receiverSocketId = usersOnline[receiverId];
        const senderSocketId = usersOnline[senderId];
        if (saved && receiverSocketId && senderSocketId) {
            io.to(senderSocketId).emit('messageDelivered', { roomId: receiverId });
        }
        if (receiverSocketId) {
            const notif = await djangoFetch(
                resolveUrl(API_STORE_NOTIFICATION),
                'POST',
                { user_id: receiverId, from_user_id: senderId, type: 'dm', data: message }
            );
            if (notif) {
                io.to(receiverSocketId).emit('receiveNotification', {
                    id:             notif.id,
                    type:           'dm',
                    from_user:      senderId,
                    from_user_info: notif.from_user_info,
                    data:           message,
                    is_read:        false,
                    created_at:     notif.created_at || new Date().toISOString(),
                });
            }
        }
    });

    socket.on('sendGroupMessage', async ({
        roomId,
        roomType = 'group',
        message,
        senderId: payloadSenderId,
        replyToId,
    }) => {
        const senderId = currentUserId || payloadSenderId;
        if (!senderId) { socket.emit('error', { message: 'Not identified — call userOnline first' }); return; }
        if (!roomId)   { socket.emit('error', { message: 'roomId is required' }); return; }

        const room = `group_${roomId}`;

        const saved = await djangoFetch(
            resolveUrl(API_STORE_GROUP_MSG),
            'POST',
            {
                sender_id: senderId,
                room_id: roomId,
                room_type: roomType,
                message,
                reply_to_id: replyToId || null,
            }
        );

        if (!saved || saved.status !== 'ok') {
            socket.emit('error', { message: 'Failed to store group message' });
            return;
        }

        const payload = {
            type:       'group',
            roomId,
            roomType,
            senderId,
            senderName: saved.senderName || undefined,
            message,
            timestamp:  new Date().toISOString(),
            id:         saved.id,
            replyTo:    saved.replyTo || undefined,
        };

        io.to(room).emit('receiveMessage', payload);

        await maybeSendNexusAiReply({
            senderId,
            roomId,
            roomType,
            roomSocketName: room,
            originalMessage: message,
            replyToId: saved.id,
        });
    });

    socket.on('typing', ({ room, isTyping }) => {
        socket.to(room).emit('userTyping', {
            userId:   currentUserId,
            room,
            isTyping,
        });
    });

    socket.on('markDMRead', async ({ otherUserId }) => {
        if (!currentUserId || !otherUserId) return;
        // Mark messages from otherUserId → currentUserId as read in DB
        await djangoFetch(
            resolveUrl(API_MARK_DM_READ),
            'POST',
            { sender_id: otherUserId, reader_id: currentUserId }
        );
        // Tell the original sender their messages were read
        const otherSocketId = usersOnline[otherUserId];
        if (otherSocketId) {
            io.to(otherSocketId).emit('messagesRead', { roomId: currentUserId });
        }
    });

    socket.on('sendMessage', async ({ room, message, senderId, receiverId }) => {
        io.to(room).emit('receiveMessage', {
            type:      'dm',
            message,
            senderId,
            receiverId,
            timestamp: new Date().toISOString(),
        });

        if (!userToken) return;

        const authHeaders = {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${userToken}`,
        };

        const saved = await djangoFetch(
            resolveUrl(API_STORE_DM),
            'POST',
            { sender_id: senderId, receiver_id: receiverId, message },
            authHeaders
        );

        const receiverSocketId = usersOnline[receiverId];
        if (receiverSocketId) {
            const notif = await djangoFetch(
                resolveUrl(API_STORE_NOTIFICATION),
                'POST',
                { user_id: receiverId, from_user_id: senderId, type: 'message', data: message }
            );
            if (notif) {
                io.to(receiverSocketId).emit('receiveNotification', {
                    id:             notif.id,
                    from_user:      senderId,
                    from_user_info: notif.from_user_info,
                    type:           'message',
                    data:           message,
                    is_read:        false,
                    created_at:     notif.created_at || new Date().toISOString(),
                });
            }
        }
    });

    socket.on('disconnect', async () => {
        console.log(`[socket] disconnected: ${socket.id}`);
        if (!currentUserId) return;

        delete usersOnline[currentUserId];

        await djangoFetch(
            resolveUrl(API_USER_STATUS, { userId: currentUserId }),
            'PUT',
            { is_online: false }
        );

        io.emit('userStatusChange', { userId: currentUserId, isOnline: false });
        console.log(`[presence] ${currentUserId} offline  (total: ${Object.keys(usersOnline).length})`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Chat & Notification server running on port ${PORT}`);
});