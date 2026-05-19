import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
import { teamsApi, type TeamMember } from '../teamsApi';
import api from '../api';
import { useAuth } from './AuthContext';
import { messagesApi, type AppNotification } from '../messagesApi';

export type { AppNotification } from '../messagesApi';

const SOCKET_URL = (import.meta as any).env?.VITE_CHAT_URL || 'https://nexusplan.duckdns.org';

interface ToastNotif {
  id: string;
  senderName: string;
  message: string;
  roomId: string;
}

let lastNotifSoundAt = 0;

function playNotificationSound() {
  try {
    const now = Date.now();
    if (now - lastNotifSoundAt < 550) return;
    lastNotifSoundAt = now;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch { }
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'dm' | 'group';
  avatar?: string;
  lastMsg?: string;
  lastTime?: string;
  unread?: number;
  online?: boolean;
  members?: number;
}

interface ChatContextValue {
  rooms: ChatRoom[];
  setRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>;
  roomMembers: Record<string, TeamMember[]>;
  setRoomMembers: (roomId: string, members: TeamMember[]) => void;
  updateRoomLastMsg: (roomId: string, msg: string, time: string, isActive: boolean) => void;
  roomsLoaded: boolean;
  socket: Socket | null;
  connected: boolean;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  notifications: AppNotification[];
  notificationUnread: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue>({
  rooms: [],
  setRooms: () => {},
  roomMembers: {},
  setRoomMembers: () => {},
  updateRoomLastMsg: () => {},
  roomsLoaded: false,
  socket: null,
  connected: false,
  activeRoomId: null,
  setActiveRoomId: () => {},
  notifications: [],
  notificationUnread: 0,
  refreshNotifications: async () => {},
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
});

const LOCAL_MSG_NOTIF_PREFIX = 'local-msg-';

function normalizeSocketNotification(payload: Record<string, unknown>): AppNotification | null {
  if (!payload?.id) return null;
  const fromInfo = payload.from_user_info as Record<string, unknown> | undefined;
  let from_user: AppNotification['from_user'] = null;
  if (fromInfo && typeof fromInfo === 'object') {
    from_user = {
      id: String(fromInfo.id ?? ''),
      username: String(fromInfo.username ?? ''),
      email: String(fromInfo.email ?? ''),
      avatar: (fromInfo.avatar as string | null) ?? null,
    };
  } else if (payload.from_user) {
    const id = String(payload.from_user);
    from_user = { id, username: id, email: '', avatar: null };
  }
  const rawData = payload.data;
  const data: Record<string, unknown> =
    typeof rawData === 'string' ? { message: rawData } : (rawData as Record<string, unknown>) ?? {};
  return {
    id: String(payload.id),
    type: String(payload.type ?? 'message'),
    data,
    is_read: !!payload.is_read,
    created_at: String(payload.created_at ?? new Date().toISOString()),
    from_user,
  };
}

function isLocalMessageNotificationId(id: string): boolean {
  return id.startsWith(LOCAL_MSG_NOTIF_PREFIX);
}

function buildSyntheticMessageNotification(
  data: {
    type?: string;
    senderId?: string;
    receiverId?: string;
    roomId?: string;
    message?: string;
    timestamp?: string;
    senderName?: string;
  },
  userId: string,
  rooms: ChatRoom[],
  roomMembers: Record<string, TeamMember[]>,
): AppNotification | null {
  const senderId = data.senderId;
  const message = data.message;
  if (!senderId || message === undefined || senderId === userId) return null;

  const ts = data.timestamp || new Date().toISOString();
  const id = `${LOCAL_MSG_NOTIF_PREFIX}${crypto.randomUUID()}`;
  const isGroup = data.type === 'group';

  if (!isGroup) {
    const room = rooms.find(r => r.id === senderId && r.type === 'dm');
    return {
      id,
      type: 'dm',
      data: { message },
      is_read: false,
      created_at: ts,
      from_user: {
        id: senderId,
        username: room?.name || data.senderName || senderId,
        email: '',
        avatar: room?.avatar ?? null,
      },
    };
  }

  const roomId = data.roomId;
  if (!roomId) return null;
  const members = roomMembers[roomId] || [];
  const m = members.find(x => x.userId === senderId);
  const name = data.senderName || m?.username || m?.email || senderId;
  return {
    id,
    type: 'group',
    data: { message, roomId },
    is_read: false,
    created_at: ts,
    from_user: {
      id: senderId,
      username: name,
      email: '',
      avatar: m?.avatar ?? null,
    },
  };
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMembers, setRoomMembersState] = useState<Record<string, TeamMember[]>>({});
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatPathnameRef = useRef(location.pathname);
  const roomsRef = useRef<ChatRoom[]>([]);
  const roomMembersRef = useRef<Record<string, TeamMember[]>>({});
  const updateRoomLastMsgRef = useRef<(roomId: string, msg: string, time: string, isActive: boolean) => void>(() => {});

  useEffect(() => {
    chatPathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { roomMembersRef.current = roomMembers; }, [roomMembers]);

  const setRoomMembers = useCallback((roomId: string, members: TeamMember[]) => {
    setRoomMembersState(prev => ({ ...prev, [roomId]: members }));
  }, []);

  const updateRoomLastMsg = useCallback(
    (roomId: string, msg: string, time: string, isActive: boolean) => {
      setRooms(prev =>
        prev.map(r => {
          if (r.id !== roomId) return r;
          return {
            ...r,
            lastMsg: msg,
            lastTime: time,
            unread: isActive ? 0 : (r.unread ?? 0) + 1,
          };
        }),
      );
    },
    [],
  );

  useEffect(() => { updateRoomLastMsgRef.current = updateRoomLastMsg; }, [updateRoomLastMsg]);

  const notificationUnread = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications],
  );

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await messagesApi.listNotifications({ limit: 50 });
      setNotifications(list);
    } catch {
    }
  }, [user?.id]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (isLocalMessageNotificationId(id)) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
      return;
    }
    try {
      const updated = await messagesApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? updated : n)));
    } catch {
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await messagesApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    void refreshNotifications();
  }, [user?.id, refreshNotifications]);

  useEffect(() => {
    if (!connected || !roomsLoaded || !socketRef.current || !user?.id) return;
    const sock = socketRef.current;
    for (const room of roomsRef.current) {
      sock.emit('joinRoom', {
        type: room.type,
        roomId: room.id,
        targetUserId: room.id,
        senderId: user.id,
      });
    }
  }, [connected, roomsLoaded, user?.id]);

  useEffect(() => {
    if (!user?.id || !token) return;

    const uid = user.id;

    const sock = io(SOCKET_URL, { reconnectionAttempts: 5, timeout: 5000 });
    socketRef.current = sock;
    setSocket(sock);

    const onReceiveNotification = (payload: Record<string, unknown>) => {
      const row = normalizeSocketNotification(payload);
      if (!row) return;
      setNotifications(prev => {
        const fromId = row.from_user?.id;
        const msg = row.data?.message;
        const filtered = prev.filter(n => {
          if (!isLocalMessageNotificationId(n.id)) return true;
          if (fromId && n.from_user?.id !== fromId) return true;
          if (msg !== undefined && String(n.data?.message) !== String(msg)) return true;
          return false;
        });
        if (filtered.some(n => n.id === row.id)) return filtered;
        return [row, ...filtered].slice(0, 100);
      });
      playNotificationSound();
    };

    sock.on('connect', () => {
      setConnected(true);
      sock.emit('userOnline', { userId: uid, token });
      void messagesApi.listNotifications({ limit: 50 }).then(setNotifications).catch(() => {});
    });
    sock.on('disconnect', () => setConnected(false));

    sock.on('receiveMessage', (data: any) => {
      const msgTime = data.timestamp || new Date().toISOString();
      const targetRoomId: string = data.type === 'group'
        ? data.roomId
        : (data.senderId === user?.id ? data.receiverId : data.senderId);

      if (data.type !== 'group' && String(data.senderId) !== String(uid)) {
        const existingRoom = roomsRef.current.find(r => r.id === targetRoomId && r.type === 'dm');
        if (!existingRoom) {
          const newRoom: ChatRoom = {
            id: targetRoomId,
            name: data.senderName || targetRoomId,
            type: 'dm',
            avatar: undefined,
            lastMsg: data.message,
            lastTime: msgTime,
            unread: 1,
          };
          setRooms(prev => {
            if (prev.some(r => r.id === targetRoomId)) return prev;
            return [newRoom, ...prev];
          });
          socketRef.current?.emit('joinRoom', {
            type: 'dm',
            targetUserId: targetRoomId,
            senderId: uid,
          });
          const toastId = crypto.randomUUID();
          setToasts(prev => [...prev, { id: toastId, senderName: data.senderName || targetRoomId, message: data.message, roomId: targetRoomId }]);
          playNotificationSound();
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);
          return; 
        }
      }

      const pathMatch = /^\/chat\/([^/?#]+)/.exec(chatPathnameRef.current);
      const isViewingThisThread =
        pathMatch != null && String(pathMatch[1]) === String(targetRoomId);
      updateRoomLastMsgRef.current(targetRoomId, data.message, msgTime, isViewingThisThread);

      if (String(data.senderId) !== String(uid) && !isViewingThisThread) {
        const room = roomsRef.current.find(r => r.id === targetRoomId);
        const senderName = room?.name ?? data.senderId;
        const toastId = crypto.randomUUID();
        setToasts(prev => [...prev, { id: toastId, senderName, message: data.message, roomId: targetRoomId }]);
        playNotificationSound();
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);

      
        if (data.type !== 'group') {
          const syn = buildSyntheticMessageNotification(
            data,
            uid,
            roomsRef.current,
            roomMembersRef.current,
          );
          if (syn) {
            setNotifications(prev => {
              const head = prev.slice(0, 8);
              const dup = head.some(
                n =>
                  n.from_user?.id === syn.from_user?.id &&
                  String(n.data?.message) === String(syn.data?.message) &&
                  !n.is_read,
              );
              if (dup) return prev;
              return [syn, ...prev].slice(0, 100);
            });
          }
        }
      }
    });

    sock.on('receiveNotification', onReceiveNotification);

    return () => {
      sock.off('receiveNotification', onReceiveNotification);
      sock.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id, token]);

  useEffect(() => {
    if (!user?.id) return;

    async function bootstrap() {
      try {
        const myTeams = await teamsApi.list();
        const newRooms: ChatRoom[] = [];
        const usersMap = new Map<string, TeamMember>();

        for (const team of myTeams) {
          newRooms.push({
            id: team.id,
            name: team.name,
            type: 'group',
            members: team.memberCount,
          });

          const members = await teamsApi.getMembers(team.id);
          setRoomMembersState(prev => ({ ...prev, [team.id]: members }));
          for (const m of members) {
            if (m.userId !== user?.id) usersMap.set(m.userId, m);
          }
        }

        for (const [userId, m] of usersMap.entries()) {
          newRooms.push({
            id: userId,
            name: m.username || m.email || 'Unknown User',
            type: 'dm',
            avatar: m.avatar || undefined,
            online: false,
          });
        }

        setRooms(newRooms);
        setRoomsLoaded(true);

        try {
          const groupIds = newRooms
            .filter(r => r.type === 'group')
            .map(r => r.id)
            .join(',');
          const recentPath =
            `messages/conversations/recent${groupIds ? `?group_ids=${encodeURIComponent(groupIds)}` : ''}`;
          const res = await api.get(recentPath);
          const recent = res.data as Array<{
            type: 'dm' | 'group';
            roomId: string;
            partnerName?: string;
            partnerAvatar?: string | null;
            lastMsg: string;
            lastTime: string;
            unread: number;
          }>;
          setRooms(prev => {
            const updated = prev.map(r => {
              const match = recent.find(c => c.roomId === r.id);
              if (!match) return r;
              return { ...r, lastMsg: match.lastMsg, lastTime: match.lastTime, unread: match.unread };
            });
            const existingIds = new Set(updated.map(r => r.id));
            const extraDmRooms: ChatRoom[] = recent
              .filter(c => c.type === 'dm' && !existingIds.has(c.roomId))
              .map(c => ({
                id: c.roomId,
                name: c.partnerName || c.roomId,
                type: 'dm' as const,
                avatar: c.partnerAvatar || undefined,
                lastMsg: c.lastMsg,
                lastTime: c.lastTime,
                unread: c.unread,
              }));
            return extraDmRooms.length > 0 ? [...updated, ...extraDmRooms] : updated;
          });
        } catch {
        }
      } catch (err) {
        console.error('[ChatContext] bootstrap failed', err);
        setRoomsLoaded(true);
      }
    }

    bootstrap();
  }, [user?.id]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        setRooms,
        roomMembers,
        setRoomMembers,
        updateRoomLastMsg,
        roomsLoaded,
        socket,
        connected,
        activeRoomId,
        setActiveRoomId,
        notifications,
        notificationUnread,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}

      <div className="chat-toast-stack">
        {toasts.map(t => (
          <button
            key={t.id}
            className="chat-toast"
            onClick={() => {
              setToasts(prev => prev.filter(x => x.id !== t.id));
              navigate(`/chat/${t.roomId}`);
            }}
          >
            <div className="chat-toast-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="chat-toast-body">
              <p className="chat-toast-sender">{t.senderName}</p>
              <p className="chat-toast-msg">{t.message.length > 60 ? t.message.slice(0, 60) + '…' : t.message}</p>
            </div>
            <button
              className="chat-toast-close"
              onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}
              aria-label="Dismiss"
            >×</button>
          </button>
        ))}
      </div>
    </ChatContext.Provider>
  );
};

export function useChatContext() {
  return useContext(ChatContext);
}