import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useChatContext, type ChatRoom } from '../context/ChatContext';
import type { TeamMember } from '../teamsApi';
import { RiGroupLine } from "react-icons/ri";


interface ReplyRef {
  id: string;
  senderId: string;
  senderName?: string;
  message: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  message: string;
  timestamp: string;
  type: 'dm' | 'group';
  status?: 'sent' | 'delivered' | 'read';
  replyTo?: ReplyRef | null;
}

function mentionHandle(m: TeamMember): string {
  if (m.userId === 'nexus-ai') return 'nexus-ai';
  const u = (m.username || '').trim();
  if (u) return u;
  const email = m.email || '';
  return email.split('@')[0] || 'user';
}

function mentionHandleSet(members: TeamMember[]): Set<string> {
  const s = new Set<string>();
  for (const m of members) {
    const h = mentionHandle(m).toLowerCase();
    if (h) s.add(h);
  }
  return s;
}

function splitMentionSegments(
  text: string,
  handles: Set<string>,
): Array<{ kind: 'text' | 'mention'; v: string }> {
  const re = /@([^\s@]+)/g;
  const out: Array<{ kind: 'text' | 'mention'; v: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', v: text.slice(last, m.index) });
    const full = m[0];
    if (handles.has(m[1].toLowerCase())) out.push({ kind: 'mention', v: full });
    else out.push({ kind: 'text', v: full });
    last = m.index + full.length;
  }
  if (last < text.length) out.push({ kind: 'text', v: text.slice(last) });
  return out;
}

const chatMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <span className="chat-md-inline">{children}</span>
  ),
};

const ChatMessageBody: React.FC<{ text: string; memberHandles: Set<string> }> = ({ text, memberHandles }) => {
  const segs = useMemo(() => splitMentionSegments(text, memberHandles), [text, memberHandles]);
  return (
    <>
      {segs.map((seg, i) =>
        seg.kind === 'mention' ? (
          <span key={i} className="chat-mention">{seg.v}</span>
        ) : (
          <ReactMarkdown key={i} components={chatMdComponents}>{seg.v}</ReactMarkdown>
        )
      )}
    </>
  );
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtSidebarTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 24 * 60 * 60 * 1000 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateSep(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

const AvatarChip: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 36, color = '#6366F1' }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
    letterSpacing: '-0.5px',
  }}>
    {initials(name)}
  </div>
);

const COLORS = ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899','#3B82F6'];
function colorFor(id: string) { return COLORS[id.charCodeAt(0) % COLORS.length]; }

const StatusTick: React.FC<{ status?: 'sent' | 'delivered' | 'read' }> = ({ status }) => {
  if (!status) return null;
  if (status === 'sent') {
    return (
      <svg className="msg-status-tick" width="14" height="10" viewBox="0 0 14 10" fill="none">
        <path d="M1 5l3 3 6-6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  const color = status === 'read' ? '#93c5fd' : 'rgba(255,255,255,0.55)';
  return (
    <svg className="msg-status-tick" width="18" height="10" viewBox="0 0 18 10" fill="none">
      <path d="M1 5l3 3 6-6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5l3 3 6-6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

interface FoundUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
}

const NEXUS_AI_AVATAR_URL = '/logoNexus.png';

const NEXUS_AI_MENTION_MEMBER: TeamMember = {
  id: 'nexus-ai',
  teamId: 'nexus-ai',
  userId: 'nexus-ai',
  username: 'Nexus AI',
  email: 'nexus.ai@bot.local',
  avatar: NEXUS_AI_AVATAR_URL,
  role: 'MEMBER',
  joinedAt: '',
};

const GroupAvatarCluster: React.FC<{
  members: TeamMember[];
  totalCount?: number;
  size?: number;
}> = ({ members, totalCount, size = 42 }) => {
  const total = totalCount ?? members.length;
  const hasExtra = total > 3;
  const visible = members.slice(0, hasExtra ? 2 : Math.min(total, 3));
  const extra = total - 3;
  const mini = Math.floor(size * 0.57);

  const pos2: React.CSSProperties[] = [
    { top: 0, left: 0 },
    { top: '28%', left: '28%' },
  ];
  const pos3: React.CSSProperties[] = [
    { top: 0, left: 0 },
    { top: 0, right: 0 },
    { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  ];

  if (visible.length === 0) return <AvatarChip name="?" size={size} />;

  if (visible.length === 1 && !hasExtra) {
    const m = visible[0];
    const name = m.username || m.email || '?';
    return m.avatar
      ? <img src={m.avatar} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      : <AvatarChip name={name} size={size} color={colorFor(m.userId)} />;
  }

  const positions = hasExtra ? pos3 : (visible.length === 2 ? pos2 : pos3);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {visible.map((m, i) => {
        const name = m.username || m.email || '?';
        return (
          <div key={m.userId} style={{ position: 'absolute', ...positions[i], lineHeight: 0 }}>
            {m.avatar
              ? <img src={m.avatar} alt={name} style={{ width: mini, height: mini, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--surface)', display: 'block' }} />
              : <AvatarChip name={name} size={mini} color={colorFor(m.userId)} />
            }
          </div>
        );
      })}
      {hasExtra && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: mini, height: mini, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff',
          fontSize: mini * 0.35, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid var(--surface)', zIndex: 3,
        }}>
          +{extra > 9 ? '9' : extra}
        </div>
      )}
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { user } = useAuth() as any;
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { rooms, setRooms, roomMembers, roomsLoaded, updateRoomLastMsg,
          socket, connected, setActiveRoomId } = useChatContext();

  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [search, setSearch]         = useState('');
  const [typing, setTyping]         = useState<{ userId: string; displayName?: string; avatar?: string; isBot?: boolean } | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(() => (window.innerWidth >= 768));
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    if (mobileView === 'chat' && window.innerWidth < 768) {
      setShowPanel(false);
    }
  }, [mobileView]);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [newChatSearching, setNewChatSearching] = useState(false);
  const [newChatUser, setNewChatUser] = useState<FoundUser | null>(null);
  const [newChatError, setNewChatError] = useState<string | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionList, setMentionList] = useState<TeamMember[]>([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!roomsLoaded || rooms.length === 0) return;
    const target = urlRoomId
      ? rooms.find(r => r.id === urlRoomId) ?? rooms[0]
      : rooms[0];
    setActiveRoom(target);
    if (!urlRoomId) navigate(`/chat/${target.id}`, { replace: true });
  }, [roomsLoaded, urlRoomId]);

  useEffect(() => {
    setActiveRoomId(activeRoom?.id ?? null);
    return () => {
      setActiveRoomId(null);
    };
  }, [activeRoom?.id, setActiveRoomId]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const onMessage = (data: any) => {
      if (data.senderId === user?.id && data.type === 'dm') return;

      const current = activeRoomRef.current;
      if (!current) return;
      const msgTime = data.timestamp || new Date().toISOString();
      const targetRoomId: string = data.type === 'group'
        ? data.roomId
        : (data.senderId === user?.id ? data.receiverId : data.senderId);
      const isActiveRoom =
        (data.type === 'group' && current.id === targetRoomId) ||
        (data.type === 'dm'    && current.type === 'dm' && current.id === targetRoomId);
      if (!isActiveRoom) return;
      setMessages(prev => [...prev, {
        id: data.id || crypto.randomUUID(),
        senderId: data.senderId,
        senderName: data.senderName || (data.senderId === user?.id ? 'You' : data.senderId),
        message: data.message,
        timestamp: msgTime,
        type: data.type,
        replyTo: data.replyTo ?? undefined,
      }]);
    };

    const onTyping = (data: any) => {
      if (data.userId !== user?.id) {
        setTyping(
          data.isTyping
            ? {
                userId: data.userId,
                displayName: data.displayName,
                avatar: data.avatar,
                isBot: data.isBot,
              }
            : null
        );
      }
    };

    const onDelivered = (_data: any) => {
      setMessages(prev => prev.map(m =>
        m.senderId === user?.id && m.type === 'dm' && (m.status === 'sent' || !m.status)
          ? { ...m, status: 'delivered' as const }
          : m
      ));
    };

    const onRead = (data: any) => {
      const current = activeRoomRef.current;
      if (!current || data.roomId !== current.id) return;
      setMessages(prev => prev.map(m =>
        m.senderId === user?.id ? { ...m, status: 'read' as const } : m
      ));
    };

    socket.on('receiveMessage', onMessage);
    socket.on('userTyping', onTyping);
    socket.on('messageDelivered', onDelivered);
    socket.on('messagesRead', onRead);
    return () => {
      socket.off('receiveMessage', onMessage);
      socket.off('userTyping', onTyping);
      socket.off('messageDelivered', onDelivered);
      socket.off('messagesRead', onRead);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    if (!activeRoom || !user?.id) return;
    setMessages([]);
    setTyping(null);
    setReplyingTo(null);
    setMentionOpen(false);

    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, unread: 0 } : r));

    if (socket) {
      socket.emit('joinRoom', {
        type: activeRoom.type,
        roomId: activeRoom.id,
        targetUserId: activeRoom.id,
        senderId: user?.id
      });
      if (activeRoom.type === 'dm') {
        socket.emit('markDMRead', { otherUserId: activeRoom.id });
      }
    }

    const endpoint = activeRoom.type === 'group'
      ? `messages/group/${activeRoom.id}/history/`
      : `messages/direct/${activeRoom.id}/history/`;

    api.get(endpoint).then(res => {
      const rawHistory = res.data as Array<Message & { is_read?: boolean }>;
      const history: Message[] = rawHistory.map(m => ({
        ...m,
        replyTo: m.replyTo ?? undefined,
        status: m.senderId === user?.id
          ? (m.is_read ? 'read' : 'sent')
          : undefined,
      }));
      setMessages(history);
      if (history.length > 0) {
        const last = history[history.length - 1];
        updateRoomLastMsg(activeRoom.id, last.message, last.timestamp, true);
      }
    }).catch(() => {});
  }, [activeRoom?.id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socket) return;
    setInput('');
    setMentionOpen(false);

    if (!activeRoom) return;

    const now = new Date().toISOString();
    const replySnapshot = replyingTo;
    setReplyingTo(null);

    if (activeRoom.type === 'group') {
      socket.emit('sendGroupMessage', {
        roomId: activeRoom.id,
        roomType: 'group',
        message: text,
        senderId: user?.id,
        replyToId: replySnapshot?.id,
      });
      return;
    }

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      senderId: user?.id,
      senderName: 'You',
      message: text,
      timestamp: now,
      type: activeRoom.type,
      status: 'sent',
    }]);

    socket.emit('sendDM', { receiverId: activeRoom.id, message: text, senderId: user?.id, senderName: user?.username || user?.email?.split('@')[0] || user?.id });
  }, [input, activeRoom, user, socket, replyingTo]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && mentionList.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionHighlight(i => Math.min(i + 1, mentionList.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionHighlight(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const pick = mentionList[mentionHighlight] ?? mentionList[0];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const cursor = e.target.selectionStart ?? v.length;
    setInput(v);

    if (activeRoom?.type === 'group' && user?.id) {
      const before = v.slice(0, cursor);
      const match = /@([\w.-]*)$/.exec(before);
      if (match) {
        const q = match[1].toLowerCase();
        const members = (roomMembers[activeRoom.id] ?? []).filter(m => m.userId !== user.id);
        let filteredM = q
          ? members.filter(m => {
              const h = mentionHandle(m).toLowerCase();
              const email = (m.email || '').toLowerCase();
              return h.includes(q) || email.includes(q);
            })
          : members;

        const aiTokens = ['nexus', 'ai', 'nexusai', 'nexus-ai', 'nexus_ai'];
        const aiMatch = !q || aiTokens.some(token => token.includes(q));
        if (aiMatch) {
          filteredM = [NEXUS_AI_MENTION_MEMBER, ...filteredM];
        }

        setMentionList(filteredM.slice(0, 8));
        setMentionOpen(filteredM.length > 0);
        setMentionHighlight(0);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }

    if (!socket || !activeRoom || !user) return;

    let room = '';
    if (activeRoom.type === 'group') {
      room = `group_${activeRoom.id}`;
    } else {
      const ids = [user.id, activeRoom.id].sort();
      room = `dm_${ids[0]}_${ids[1]}`;
    }

    socket.emit('typing', { room, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { room, isTyping: false }), 1500);
  };

  const filtered = rooms
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!a.lastTime && !b.lastTime) return 0;
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
    });

  const groupMemberHandles = useMemo(() => {
    if (activeRoom?.type !== 'group') return new Set<string>();
    const handles = mentionHandleSet(roomMembers[activeRoom.id] ?? []);
    handles.add('nexus-ai');
    handles.add('nexus_ai');
    handles.add('nexusai');
    return handles;
  }, [activeRoom?.type, activeRoom?.id, roomMembers]);

  const insertMention = useCallback((m: TeamMember) => {
    const el = inputRef.current;
    if (!el) return;
    const v = el.value;
    const cursor = el.selectionStart ?? v.length;
    const before = v.slice(0, cursor);
    const start = before.lastIndexOf('@');
    if (start < 0) return;
    const insert = `@${mentionHandle(m)} `;
    const next = v.slice(0, start) + insert + v.slice(cursor);
    setInput(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const openNewChatModal = () => {
    setShowNewChatModal(true);
    setNewChatEmail('');
    setNewChatUser(null);
    setNewChatError(null);
  };

  const handleEmailSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newChatEmail.trim();
    if (!email) return;
    setNewChatSearching(true);
    setNewChatUser(null);
    setNewChatError(null);
    try {
      const res = await api.get('auth/lookup/', { params: { email } });
      const found = res.data as FoundUser;
      if (found.id === user?.id) {
        setNewChatError("You can't start a conversation with yourself.");
      } else {
        setNewChatUser(found);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNewChatError('No user found with this email address.');
      } else {
        setNewChatError('Something went wrong. Please try again.');
      }
    } finally {
      setNewChatSearching(false);
    }
  };

  const startDMFromModal = (foundUser: FoundUser) => {
    const existing = rooms.find(r => r.type === 'dm' && r.id === foundUser.id);
    if (existing) {
      setShowNewChatModal(false);
      navigate(`/chat/${existing.id}`);
      return;
    }
    const newRoom: ChatRoom = {
      id: foundUser.id,
      name: foundUser.username || foundUser.email,
      type: 'dm',
      avatar: foundUser.avatar || undefined,
      online: false,
    };
    setRooms(prev => [newRoom, ...prev]);
    setShowNewChatModal(false);
    navigate(`/chat/${foundUser.id}`);
  };

  if (!roomsLoaded) {
    return <div className="chat-page" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading chats...</div>;
  }

  return (
    <div className={`chat-page rounded-4xl${mobileView === 'chat' ? ' chat-page--mobile-chat' : ''}`}>
      <aside className={`chat-sidebar${mobileView === 'chat' ? ' chat-sidebar--mobile-hidden' : ''}`}>
        <div className="chat-sidebar-header">
          <div>
            <h2 className="chat-sidebar-title">Messages</h2>
            <p className="chat-sidebar-sub">Team conversations</p>
          </div>
          <button className="chat-compose-btn" title="New chat" onClick={openNewChatModal}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>

        <div className="chat-search-wrap">
          <svg className="chat-search-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="chat-search-input"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-room-list">
          <p className="chat-room-section-label">Channels & Groups</p>
          {filtered.map(room => (
            <button
              key={room.id}
              className={`chat-room-item${activeRoom?.id === room.id ? ' chat-room-item--active' : ''}`}
              onClick={() => { navigate(`/chat/${room.id}`); setMobileView('chat'); }}
            >
              <div className="chat-room-avatar-wrap">
                {room.type === 'dm'
                  ? (room.avatar
                      ? <img src={room.avatar} alt={room.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <AvatarChip name={room.name} size={42} color={colorFor(room.id)} />
                    )
                  : (roomMembers[room.id]?.length
                      ? <GroupAvatarCluster members={roomMembers[room.id]} totalCount={room.members} size={42} />
                      : <AvatarChip name={room.name} size={42} color={colorFor(room.id)} />
                    )
                }
                {/* {room.online && <span className="chat-room-online-dot" />} */}
              </div>
              <div className="chat-room-info">
                <div className="chat-room-name-row">
                  <span className="chat-room-name">{room.name}</span>
                  <span className="chat-room-time">{room.lastTime ? fmtSidebarTime(room.lastTime) : ''}</span>
                </div>
                <div className="chat-room-last-row">
                  <span className="chat-room-last">{room.lastMsg}</span>
                  {room.unread ? <span className="chat-room-badge">{room.unread}</span> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {activeRoom ? (
        <>
          <div className={`chat-main${mobileView === 'chat' ? ' chat-main--mobile-visible' : ''}`}>
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <button
              className="chat-back-btn"
              onClick={() => setMobileView('list')}
              aria-label="Back to conversations"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {activeRoom.type === 'dm'
                  ? (activeRoom.avatar
                      ? <img src={activeRoom.avatar} alt={activeRoom.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <AvatarChip name={activeRoom.name} size={42} color={colorFor(activeRoom.id)} />
                    )
                  : (roomMembers[activeRoom.id]?.length
                      ? <GroupAvatarCluster members={roomMembers[activeRoom.id]} totalCount={activeRoom.members} size={42} />
                      : <AvatarChip name={activeRoom.name} size={42} color={colorFor(activeRoom.id)} />
                    )
                }
            <div>
              <p className="chat-topbar-name">{activeRoom.name}</p>
              {activeRoom.type !== 'dm' &&(
                <p className='chat-topbar-meta flex items-center font-semibold'> <RiGroupLine size={14}/> {activeRoom?.members}</p>
              )} 
              {/* <p className="chat-topbar-meta">
                {activeRoom.type === 'group'
                  ? `${activeRoom.members ?? 0} members`
                  : connected ? 'Online' : 'Offline'}
              </p> */}
            </div>
          </div>
          <div className="chat-topbar-actions">
            <div className={`chat-status-dot${connected ? ' chat-status-dot--on' : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
            <button
              className={`chat-topbar-btn${showPanel ? ' chat-topbar-btn--active' : ''}`}
              title={showPanel ? 'Hide details' : 'Show details'}
              onClick={() => setShowPanel(v => !v)}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.3">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="chat-empty-text">No messages yet</p>
              <p className="chat-empty-sub">Start the conversation in <strong>{activeRoom.name}</strong></p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = msg.senderId === user?.id || msg.senderName === 'You';
            const showAvatar = !isMe && (i === 0 || messages[i-1]?.senderId !== msg.senderId);
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const showDateSep = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
            
            let displayName = msg.senderName;
            if (!isMe && msg.senderId) {
              const dmRoom = rooms.find(r => r.type === 'dm' && r.id === msg.senderId);
              if (dmRoom) {
                displayName = dmRoom.name;
              }
            }

            let senderAvatar: string | null = null;
            const dmRoom = rooms.find(r => r.type === 'dm' && r.id === msg.senderId);
            if (dmRoom?.avatar) {
              senderAvatar = dmRoom.avatar;
            } else if (activeRoom?.type === 'group') {
              senderAvatar = (roomMembers[activeRoom.id] ?? []).find(m => m.userId === msg.senderId)?.avatar ?? null;
            }
            if (!senderAvatar && (msg.senderName || '').toLowerCase() === 'nexus ai') {
              senderAvatar = NEXUS_AI_AVATAR_URL;
            }

            return (
              <React.Fragment key={msg.id}>
              {showDateSep && (
                <div className="chat-date-sep"><span>{fmtDateSep(msg.timestamp)}</span></div>
              )}
              <div className={`chat-msg-row${isMe ? ' chat-msg-row--me' : ''}`}>
                {!isMe && (
                  <div className="chat-msg-avatar">
                    {showAvatar
                      ? (senderAvatar
                          ? <img src={senderAvatar} alt={displayName || msg.senderId} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <AvatarChip name={displayName || msg.senderId} size={32} color={colorFor(msg.senderId)} />
                        )
                      : <div style={{ width: 32 }} />
                    }
                  </div>
                )}
                <div className="chat-msg-content">
                  {showAvatar && !isMe && (
                    <p className="chat-msg-sender">{displayName || msg.senderId}</p>
                  )}
                  <div className={`chat-bubble${isMe ? ' chat-bubble--me' : ''}`}>
                    {activeRoom.type === 'group' && (
                      <button
                        type="button"
                        className="chat-bubble-reply-btn"
                        title="Reply"
                        aria-label="Reply to message"
                        onClick={() => setReplyingTo(msg)}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                        </svg>
                      </button>
                    )}
                    <div className="chat-bubble-text">
                      {msg.replyTo && (
                        <div className="chat-reply-quote">
                          <span className="chat-reply-quote-bar" aria-hidden />
                          <div className="chat-reply-quote-inner">
                            <span className="chat-reply-quote-name">{msg.replyTo.senderName || msg.replyTo.senderId}</span>
                            <span className="chat-reply-quote-text">{msg.replyTo.message}</span>
                          </div>
                        </div>
                      )}
                      {msg.type === 'group' ? (
                        <ChatMessageBody text={msg.message} memberHandles={groupMemberHandles} />
                      ) : (
                        <ReactMarkdown components={chatMdComponents}>{msg.message}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                  <p className="chat-msg-time">
                    {fmtTime(msg.timestamp)}
                    {isMe && <StatusTick status={msg.status} />}
                  </p>
                </div>
              </div>
              </React.Fragment>
            );
          })}

          {typing && (() => {
            const typingMember =
              (roomMembers[activeRoom.id] ?? []).find(m => m.userId === typing.userId) ??
              (rooms.find(r => r.type === 'dm' && r.id === typing.userId) as any);
            const typingName = typing.displayName || typingMember?.username || typingMember?.name || typingMember?.email || typing.userId;
            const typingAvatar = typing.avatar || typingMember?.avatar || (typing.isBot ? NEXUS_AI_AVATAR_URL : null);
            return (
              <div className="chat-msg-row">
                <div className="chat-msg-avatar">
                  {typingAvatar
                    ? <img src={typingAvatar} alt={typingName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <AvatarChip name={typingName} size={32} color={colorFor(typing.userId)} />
                  }
                </div>
                {typing.isBot ? (
                  <div className="chat-bubble chat-bubble--typing chat-bubble--typing-bot" aria-live="polite" aria-label="Nexus is generating a response">
                    <img src={NEXUS_AI_AVATAR_URL} alt="Nexus loader" className="chat-nexus-loader-logo" />
                    <span className="chat-typing-label">Nexus is thinking...</span>
                  </div>
                ) : (
                  <div className="chat-bubble chat-bubble--typing">
                    <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
                  </div>
                )}
              </div>
            );
          })()}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-bar">
          {replyingTo && activeRoom.type === 'group' && (
            <div className="chat-replying-strip">
              <div className="chat-replying-strip-inner">
                <span className="chat-replying-strip-label">
                  Replying to {replyingTo.senderName
                    || (roomMembers[activeRoom.id] ?? []).find(m => m.userId === replyingTo.senderId)?.username
                    || replyingTo.senderId}
                </span>
                <span className="chat-replying-strip-preview">
                  {(replyingTo.message || '').replace(/\n/g, ' ').slice(0, 100)}
                  {(replyingTo.message || '').length > 100 ? '…' : ''}
                </span>
              </div>
              <button type="button" className="chat-replying-strip-cancel" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                ×
              </button>
            </div>
          )}
          <div className="chat-input-bar-row">
            {mentionOpen && activeRoom.type === 'group' && mentionList.length > 0 && (
              <div className="chat-mention-popover" role="listbox">
                {mentionList.map((m, idx) => {
                  const name = m.username || m.email || 'Unknown';
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      role="option"
                      aria-selected={idx === mentionHighlight}
                      className={`chat-mention-option${idx === mentionHighlight ? ' chat-mention-option--active' : ''}`}
                      onMouseDown={e => e.preventDefault()}
                      onMouseEnter={() => setMentionHighlight(idx)}
                      onClick={() => insertMention(m)}
                    >
                      {m.avatar
                        ? <img src={m.avatar} alt="" className="chat-mention-option-avatar" />
                        : <AvatarChip name={name} size={28} color={colorFor(m.userId)} />}
                      <span className="chat-mention-option-name">{name}</span>
                      <span className="chat-mention-option-handle">@{mentionHandle(m)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <input
              ref={inputRef}
              className="chat-input"
              placeholder={
                activeRoom.type === 'group'
                  ? `Message ${activeRoom.name}… (@ to mention)`
                  : `Message ${activeRoom.name}…`
              }
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
            />
          <div ref={emojiPickerRef} style={{ position: 'relative' }}>
            {showEmojiPicker && (
              <div style={{ position: 'absolute', bottom: '48px', right: 0, zIndex: 1000 }}>
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: any) => setInput(prev => prev + emoji.native)}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
            <button
              className="chat-input-action"
              title="Emoji"
              onClick={() => setShowEmojiPicker(v => !v)}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
          </div>
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim()}
            title="Send"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
          </div>
        </div>
      </div>

      {showPanel && <aside className="chat-right-panel">
        {/* Mobile close button */}
        <button
          className="chat-right-close-btn"
          onClick={() => setShowPanel(false)}
          aria-label="Close panel"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="chat-right-header">
          {activeRoom.type === 'dm' && activeRoom.avatar
            ? <img src={activeRoom.avatar} alt={activeRoom.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
            : <AvatarChip name={activeRoom.name} size={52} color={colorFor(activeRoom.id)} />
          }
          <p className="chat-right-name">{activeRoom.name}</p>
          <p className="chat-right-type">
            {activeRoom.type === 'group' ? `Group · ${activeRoom.members} members` : 'Direct Message'}
          </p>
        </div>

        {activeRoom.type === 'group' && (
        <div className="chat-right-section">
          <p className="chat-right-section-title">Members</p>
          <div className="chat-right-members">
            {(roomMembers[activeRoom.id] || []).map(m => {
                  const name = m.username || m.email || 'Unknown';
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      className="chat-right-member"
                      title="Add mention to message"
                      onClick={() => {
                        if (m.userId === user?.id) return;
                        const h = mentionHandle(m);
                        setInput(prev => (prev ? `${prev.trimEnd()} @${h} ` : `@${h} `));
                        inputRef.current?.focus();
                      }}
                    >
                      {m.avatar
                        ? <img src={m.avatar} alt={name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <AvatarChip name={name} size={30} color={colorFor(m.userId)} />
                      }
                      <span className="chat-right-member-name">{name}</span>
                      <span className="chat-right-member-dot" />
                    </button>
                  );
                })}
            {!(roomMembers[activeRoom.id]?.length) && (
              <p style={{ fontSize: 12, opacity: 0.45, padding: '4px 0' }}>Loading members…</p>
            )}
          </div>
        </div>
        )}

        {/* <div className="chat-right-section">
          <p className="chat-right-section-title">Shared Files</p>
          <div className="chat-right-files">
            {['Q2-Report.pdf','Design-v3.fig','Sprint-24.xlsx'].map(f => (
              <div key={f} className="chat-right-file">
                <div className="chat-right-file-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <span className="chat-right-file-name">{f}</span>
              </div>
            ))}
          </div>
        </div> */}
      </aside>}
      {showPanel && <div className="chat-panel-backdrop" onClick={() => setShowPanel(false)} />}
        </>
      ) : (
        <div className="chat-main chat-empty">Select a conversation to start chatting</div>
      )}

      {showNewChatModal && (
        <div className="chat-modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <h3 className="chat-modal-title">New Direct Message</h3>
              <button className="chat-modal-close" onClick={() => setShowNewChatModal(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="chat-modal-body">
              <form className="chat-modal-form" onSubmit={handleEmailSearch}>
                <input
                  className="chat-modal-input"
                  type="email"
                  placeholder="Search by email address…"
                  value={newChatEmail}
                  onChange={e => { setNewChatEmail(e.target.value); setNewChatUser(null); setNewChatError(null); }}
                  autoFocus
                />
                <button type="submit" className="chat-modal-search-btn" disabled={newChatSearching || !newChatEmail.trim()}>
                  {newChatSearching ? '…' : 'Search'}
                </button>
              </form>

              {newChatError && (
                <div className="chat-modal-error">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {newChatError}
                </div>
              )}

              {newChatUser && (
                <div className="chat-modal-result">
                  {newChatUser.avatar
                    ? <img src={newChatUser.avatar} alt={newChatUser.username} className="chat-modal-result-avatar" />
                    : <AvatarChip name={newChatUser.username || newChatUser.email} size={44} color={colorFor(newChatUser.id)} />
                  }
                  <div className="chat-modal-result-info">
                    <p className="chat-modal-result-name">{newChatUser.username}</p>
                    <p className="chat-modal-result-email">{newChatUser.email}</p>
                  </div>
                  <button className="chat-modal-start-btn" onClick={() => startDMFromModal(newChatUser)}>
                    Start conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;