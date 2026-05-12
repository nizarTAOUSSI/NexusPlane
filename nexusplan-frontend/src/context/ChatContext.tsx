import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { teamsApi, type TeamMember } from '../teamsApi';
import api from '../api';
import { useAuth } from './AuthContext';

const SOCKET_URL = (import.meta as any).env?.VITE_CHAT_URL || 'https://nexusplane.duckdns.org';

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
});

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth() as any;
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMembers, setRoomMembersState] = useState<Record<string, TeamMember[]>>({});
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const updateRoomLastMsgRef = useRef<(roomId: string, msg: string, time: string, isActive: boolean) => void>(() => {});

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);

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

  // Socket lifecycle — runs for the full session, not just while ChatPage is open
  useEffect(() => {
    if (!user?.id || !token) return;

    const sock = io(SOCKET_URL, { reconnectionAttempts: 5, timeout: 5000 });
    socketRef.current = sock;

    sock.on('connect', () => {
      setConnected(true);
      sock.emit('userOnline', { userId: user.id, token });
    });
    sock.on('disconnect', () => setConnected(false));

    sock.on('receiveMessage', (data: any) => {
      const msgTime = data.timestamp || new Date().toISOString();
      const targetRoomId: string = data.type === 'group'
        ? data.roomId
        : (data.senderId === user?.id ? data.receiverId : data.senderId);

      const isActive = activeRoomIdRef.current === targetRoomId;
      updateRoomLastMsgRef.current(targetRoomId, data.message, msgTime, isActive);
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
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
          const res = await api.get(
            `messages/conversations/recent/${groupIds ? `?group_ids=${encodeURIComponent(groupIds)}` : ''}`
          );
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
        socket: socketRef.current,
        connected,
        activeRoomId,
        setActiveRoomId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChatContext() {
  return useContext(ChatContext);
}
