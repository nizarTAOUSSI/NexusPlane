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
const INTERNAL_API_KEY  = process.env.INTERNAL_API_KEY  || '';
const PORT              = process.env.PORT              || 5000;

const API_USER_STATUS        = process.env.API_USER_STATUS        || '/api/messages/users/:userId/status/';
const API_STORE_DM           = process.env.API_STORE_DM           || '/api/messages/direct/store/';
const API_STORE_GROUP_MSG    = process.env.API_STORE_GROUP_MSG    || '/api/messages/group/store/';
const API_STORE_NOTIFICATION = process.env.API_STORE_NOTIFICATION || '/api/messages/notifications/store/';

console.log('🚀 NexusPlan Chat Service starting…');
console.log('   DJANGO_URL :', DJANGO_URL);
console.log('   INTERNAL_API_KEY :', INTERNAL_API_KEY ? '✅ set' : '⚠️  missing');


const internalHeaders = {
    'Content-Type': 'application/json',
    'X-Internal-Key': INTERNAL_API_KEY,
};

const resolveUrl = (template, params = {}) =>
    Object.entries(params).reduce(
        (url, [k, v]) => url.replace(`:${k}`, v),
        `${DJANGO_URL}${template}`
    );

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

const usersOnline = {};

app.use(express.json());

app.get('/', (_req, res) =>
    res.json({ status: 'ok', service: 'nexusplan-chat', version: '2.0.0' })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));


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

    socket.on('sendDM', async ({ receiverId, message, senderId: payloadSenderId }) => {
        const senderId = currentUserId || payloadSenderId;
        if (!senderId) { socket.emit('error', { message: 'Not identified — call userOnline first' }); return; }

        const ids  = [String(senderId), String(receiverId)].sort();
        const room = `dm_${ids[0]}_${ids[1]}`;

        const payload = {
            type:       'dm',
            senderId,
            receiverId,
            message,
            timestamp:  new Date().toISOString(),
        };

        io.to(room).emit('receiveMessage', payload);

        const saved = await djangoFetch(
            resolveUrl(API_STORE_DM),
            'POST',
            { sender_id: senderId, receiver_id: receiverId, message }
        );

        const receiverSocketId = usersOnline[receiverId];
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

    socket.on('sendGroupMessage', async ({ roomId, roomType = 'group', message, senderId: payloadSenderId }) => {
        const senderId = currentUserId || payloadSenderId;
        if (!senderId) { socket.emit('error', { message: 'Not identified — call userOnline first' }); return; }
        if (!roomId)   { socket.emit('error', { message: 'roomId is required' }); return; }

        const room = `group_${roomId}`;

        const payload = {
            type:      'group',
            roomId,
            roomType,
            senderId,
            message,
            timestamp: new Date().toISOString(),
        };

        io.to(room).emit('receiveMessage', payload);

        const saved = await djangoFetch(
            resolveUrl(API_STORE_GROUP_MSG),
            'POST',
            { sender_id: senderId, room_id: roomId, room_type: roomType, message }
        );
    });

    socket.on('typing', ({ room, isTyping }) => {
        socket.to(room).emit('userTyping', {
            userId:   currentUserId,
            room,
            isTyping,
        });
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