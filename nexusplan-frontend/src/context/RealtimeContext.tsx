

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { type UserMeta } from '../types/task';

export interface CursorState {
  x:   number; 
  y:   number; 
  ts:  number; 
}

interface RealtimeContextValue {
  isConnected:   boolean;
  onlineUserIds: Set<string>;
  userMap:       Record<string, UserMeta>;
  cursors:       Map<string, CursorState>;

  _publish: (update: Partial<{
    isConnected:   boolean;
    onlineUserIds: Set<string>;
    userMap:       Record<string, UserMeta>;
  }>) => void;
  _updateCursor: (userId: string, pos: CursorState) => void;
  _removeCursor: (userId: string) => void;

  send: (data: object) => void;
  _registerSend: (fn: (data: object) => void) => void;
}



const noop = () => {};

const defaultCtx: RealtimeContextValue = {
  isConnected:   false,
  onlineUserIds: new Set(),
  userMap:       {},
  cursors:       new Map(),
  _publish:      noop,
  _updateCursor: noop,
  _removeCursor: noop,
  send:          noop,
  _registerSend: noop,
};

const RealtimeContext = createContext<RealtimeContextValue>(defaultCtx);


export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected,   setIsConnected]   = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [userMap,       setUserMap]       = useState<Record<string, UserMeta>>({});
  const [cursors,       setCursors]       = useState<Map<string, CursorState>>(new Map());

  const sendRef = useRef<(data: object) => void>(noop);

  const _publish = useCallback((update: Parameters<RealtimeContextValue['_publish']>[0]) => {
    if (update.isConnected   !== undefined) setIsConnected(update.isConnected);
    if (update.onlineUserIds !== undefined) setOnlineUserIds(update.onlineUserIds);
    if (update.userMap       !== undefined) setUserMap(update.userMap);
  }, []);

  const _updateCursor = useCallback((userId: string, pos: CursorState) => {
    setCursors(prev => new Map(prev).set(userId, pos));
  }, []);

  const _removeCursor = useCallback((userId: string) => {
    setCursors(prev => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const _registerSend = useCallback((fn: (data: object) => void) => {
    sendRef.current = fn;
  }, []);

  const send = useCallback((data: object) => sendRef.current(data), []);

  return (
    <RealtimeContext.Provider value={{
      isConnected, onlineUserIds, userMap, cursors,
      _publish, _updateCursor, _removeCursor,
      send, _registerSend,
    }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  return useContext(RealtimeContext);
}
