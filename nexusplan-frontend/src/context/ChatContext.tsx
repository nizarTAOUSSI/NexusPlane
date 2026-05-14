import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { teamsApi, type TeamMember } from '../teamsApi';
import api from '../api';
import { useAuth } from './AuthContext';
import { messagesApi, type AppNotification } from '../messagesApi';

export type { AppNotification } from '../messagesApi';

const SOCKET_URL = (import.meta as any).env?.VITE_CHAT_URL || 'https://nexusplane.duckdns.org';

interface ToastNotif {
  id: string;
  senderName: string;
  message: string;
  roomId: string;
}

function playNotificationSound() {
  try {
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

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth() as any;
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMembers, setRoomMembersState] = useState<Record<string, TeamMember[]>>({});
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);
  const updateRoomLastMsgRef = useRef<(roomId: string, msg: string, time: string, isActive: boolean) => void>(() => {});

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

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

  // Keep ref in sync so the socket handler always has the latest version
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
      /* ignore */
    }
  }, [user?.id]);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      const updated = await messagesApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? updated : n)));
    } catch {
      /* ignore */
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await messagesApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void refreshNotifications();
  }, [user?.id, refreshNotifications]);

  // Auto-join ALL rooms whenever socket is connected + rooms are loaded.
  // This ensures receiveMessage events are delivered even when ChatPage is not open.
  // Also handles reconnects: `connected` flips false→true, re-running this effect.
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

  // Socket lifecycle — runs for the full session, not just while ChatPage is open
  useEffect(() => {
    if (!user?.id || !token) return;

    const sock = io(SOCKET_URL, { reconnectionAttempts: 5, timeout: 5000 });
    socketRef.current = sock;
    setSocket(sock);

    const onReceiveNotification = (payload: Record<string, unknown>) => {
      const row = normalizeSocketNotification(payload);
      if (!row) return;
      setNotifications(prev => {
        if (prev.some(n => n.id === row.id)) return prev;
        return [row, ...prev];
      });
      playNotificationSound();
    };

    sock.on('connect', () => {
      setConnected(true);
      sock.emit('userOnline', { userId: user.id, token });
      void messagesApi.listNotifications({ limit: 50 }).then(setNotifications).catch(() => {});
    });
    sock.on('disconnect', () => setConnected(false));

    sock.on('receiveMessage', (data: any) => {
      const msgTime = data.timestamp || new Date().toISOString();
      const targetRoomId: string = data.type === 'group'
        ? data.roomId
        : (data.senderId === user?.id ? data.receiverId : data.senderId);

      const isActive = activeRoomIdRef.current === targetRoomId;
      updateRoomLastMsgRef.current(targetRoomId, data.message, msgTime, isActive);

      if (data.senderId !== user?.id && !isActive) {
        const room = roomsRef.current.find(r => r.id === targetRoomId);
        const senderName = room?.name ?? data.senderId;
        const toastId = crypto.randomUUID();
        setToasts(prev => [...prev, { id: toastId, senderName, message: data.message, roomId: targetRoomId }]);
        playNotificationSound();
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);
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
            lastMsg: string;
            lastTime: string;
            unread: number;
          }>;
          setRooms(prev =>
            prev.map(r => {
              const match = recent.find(c => c.roomId === r.id);
              if (!match) return r;
              return { ...r, lastMsg: match.lastMsg, lastTime: match.lastTime, unread: match.unread };
            })
          );
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
