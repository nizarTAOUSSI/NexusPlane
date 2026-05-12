import { useCallback, useEffect, useRef, useState } from 'react';
import { type Task, type TaskStatus } from '../types/task';

export type WSEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_deleted'
  | 'user_connected'
  | 'user_disconnected'
  | 'cursor_move'
  | 'error';

export interface WSEvent {
  type:       WSEventType;
  userId?:    string;
  projectId?: string;
  taskId?:    string;
  status?:    TaskStatus;
  task?:      Task;
  payload?:   Record<string, unknown>;
  timestamp?: string;
  message?:   string;
}

interface Options {
  projectId:     string | null;
  token:         string | null;
  currentUserId: string | null;
  onEvent:       (event: WSEvent) => void;
}

export interface UseProjectWebSocketReturn {
  isConnected:   boolean;
  onlineUserIds: Set<string>;
  send:          (data: object) => void;
}

const PING_MS          = 25_000;
const RECONNECT_BASE_MS = 2_000;
const MAX_ATTEMPTS      = 6;


function buildWsUrl(projectId: string, token: string): string {
  const base =
    (import.meta.env.VITE_WS_BASE_URL as string | undefined) ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  return `${base}/ws/projects/${projectId}/?token=${encodeURIComponent(token)}`;
}

export function useProjectWebSocket({
  projectId,
  token,
  currentUserId,
  onEvent,
}: Options): UseProjectWebSocketReturn {
  const [isConnected,   setIsConnected]   = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const wsRef         = useRef<WebSocket | null>(null);
  const pingRef       = useRef<ReturnType<typeof setInterval>  | undefined>(undefined);
  const reconnectRef  = useRef<ReturnType<typeof setTimeout>   | undefined>(undefined);
  const attemptsRef   = useRef(0);
  const unmountedRef  = useRef(false);
  const onEventRef    = useRef(onEvent);
  const currentUidRef = useRef(currentUserId);

  onEventRef.current    = onEvent;
  currentUidRef.current = currentUserId;

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!projectId || !token) return;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(buildWsUrl(projectId!, token!));
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        attemptsRef.current = 0;
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_MS);
      };

      ws.onmessage = ({ data }) => {
        let event: WSEvent;
        try { event = JSON.parse(data); } catch { return; }

        if (event.type === 'user_connected' && event.userId) {
          setOnlineUserIds(prev => new Set([...prev, event.userId!]));
        } else if (event.type === ('presence_list' as any) && Array.isArray((event as any).userIds)) {
          setOnlineUserIds(prev => new Set([...prev, ...(event as any).userIds as string[]]));
        } else if (event.type === 'user_disconnected' && event.userId) {
          setOnlineUserIds(prev => {
            const next = new Set(prev);
            next.delete(event.userId!);
            return next;
          });
        }

        if (
          event.userId &&
          event.userId === currentUidRef.current &&
          event.type !== 'user_connected' &&
          event.type !== 'user_disconnected'
        ) {
          return;
        }

        if (event.type !== ('pong' as WSEventType)) {
          onEventRef.current(event);
        }
      };

      ws.onclose = ({ code }) => {
        clearInterval(pingRef.current);
        if (unmountedRef.current) return;
        setIsConnected(false);
        setOnlineUserIds(new Set());

        if (code !== 1000 && code !== 4001 && code !== 4002) {
          if (attemptsRef.current < MAX_ATTEMPTS) {
            const delay = RECONNECT_BASE_MS * Math.pow(1.5, attemptsRef.current);
            attemptsRef.current++;
            reconnectRef.current = setTimeout(connect, delay);
          }
        }
      };

      ws.onerror = () => { };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      clearInterval(pingRef.current);
      clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000, 'component unmounted');
      setIsConnected(false);
      setOnlineUserIds(new Set());
    };
  }, [projectId, token]); 

  return { isConnected, onlineUserIds, send };
}
