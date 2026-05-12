import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TeamMember } from '../teamsApi';

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
  pendingRoomId: string | null;
  setPendingRoomId: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextValue>({
  rooms: [],
  setRooms: () => {},
  roomMembers: {},
  setRoomMembers: () => {},
  updateRoomLastMsg: () => {},
  pendingRoomId: null,
  setPendingRoomId: () => {},
});

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMembers, setRoomMembersState] = useState<Record<string, TeamMember[]>>({});
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

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

  return (
    <ChatContext.Provider
      value={{
        rooms,
        setRooms,
        roomMembers,
        setRoomMembers,
        updateRoomLastMsg,
        pendingRoomId,
        setPendingRoomId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChatContext() {
  return useContext(ChatContext);
}
