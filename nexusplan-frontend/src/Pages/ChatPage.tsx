import React, { useState, useEffect, useRef, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useChatContext, type ChatRoom } from '../context/ChatContext';

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  message: string;
  timestamp: string;
  type: 'dm' | 'group';
  status?: 'sent' | 'delivered' | 'read';
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [typing, setTyping]         = useState<string | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(true);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [activeRoom?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const onMessage = (data: any) => {
      if (data.senderId === user?.id) return;

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
        id: crypto.randomUUID(),
        senderId: data.senderId,
        senderName: data.senderId === user?.id ? 'You' : data.senderId,
        message: data.message,
        timestamp: msgTime,
        type: data.type,
      }]);
    };

    const onTyping = (data: any) => {
      if (data.userId !== user?.id) {
        setTyping(data.isTyping ? data.userId : null);
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

    if (!activeRoom) return;

    // Add optimistically so the message appears instantly
    const now = new Date().toISOString();
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      senderId: user?.id,
      senderName: 'You',
      message: text,
      timestamp: now,
      type: activeRoom.type,
      status: 'sent',
    }]);

    if (activeRoom.type === 'group') {
      socket.emit('sendGroupMessage', {
        roomId: activeRoom.id,
        roomType: 'group',
        message: text,
        senderId: user?.id
      });
    } else {
      socket.emit('sendDM', { receiverId: activeRoom.id, message: text, senderId: user?.id });
    }
  }, [input, activeRoom, user, socket]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
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

  const filtered = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!roomsLoaded) {
    return <div className="chat-page" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading chats...</div>;
  }

  return (
    <div className="chat-page rounded-4xl">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div>
            <h2 className="chat-sidebar-title">Messages</h2>
            <p className="chat-sidebar-sub">Team conversations</p>
          </div>
          <button className="chat-compose-btn" title="New chat">
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
              onClick={() => navigate(`/chat/${room.id}`)}
            >
              <div className="chat-room-avatar-wrap">
                <AvatarChip name={room.name} size={42} color={colorFor(room.id)} />
                {room.online && <span className="chat-room-online-dot" />}
              </div>
              <div className="chat-room-info">
                <div className="chat-room-name-row">
                  <span className="chat-room-name">{room.name}</span>
                  <span className="chat-room-time">{room.lastTime ? fmtTime(room.lastTime) : ''}</span>
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
          <div className="chat-main">
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <AvatarChip name={activeRoom.name} size={40} color={colorFor(activeRoom.id)} />
            <div>
              <p className="chat-topbar-name">{activeRoom.name}</p>
              <p className="chat-topbar-meta">
                {activeRoom.type === 'group'
                  ? `${activeRoom.members ?? 0} members`
                  : connected ? 'Online' : 'Offline'}
              </p>
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
            
            let displayName = msg.senderName;
            if (!isMe && msg.senderId) {
              const dmRoom = rooms.find(r => r.type === 'dm' && r.id === msg.senderId);
              if (dmRoom) {
                displayName = dmRoom.name;
              }
            }

            return (
              <div key={msg.id} className={`chat-msg-row${isMe ? ' chat-msg-row--me' : ''}`}>
                {!isMe && (
                  <div className="chat-msg-avatar">
                    {showAvatar
                      ? <AvatarChip name={displayName || msg.senderId} size={32} color={colorFor(msg.senderId)} />
                      : <div style={{ width: 32 }} />
                    }
                  </div>
                )}
                <div className="chat-msg-content">
                  {showAvatar && !isMe && (
                    <p className="chat-msg-sender">{displayName || msg.senderId}</p>
                  )}
                  <div className={`chat-bubble${isMe ? ' chat-bubble--me' : ''}`}>
                    <p className="chat-bubble-text">{msg.message}</p>
                  </div>
                  <p className="chat-msg-time">
                    {fmtTime(msg.timestamp)}
                    {isMe && <StatusTick status={msg.status} />}
                  </p>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="chat-msg-row">
              <div className="chat-msg-avatar">
                <AvatarChip name={typing} size={32} color={colorFor(typing)} />
              </div>
              <div className="chat-bubble chat-bubble--typing">
                <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-bar">
          <input
            className="chat-input"
            placeholder={`Message ${activeRoom.name}…`}
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

      {showPanel && <aside className="chat-right-panel">
        <div className="chat-right-header">
          <AvatarChip name={activeRoom.name} size={52} color={colorFor(activeRoom.id)} />
          <p className="chat-right-name">{activeRoom.name}</p>
          <p className="chat-right-type">
            {activeRoom.type === 'group' ? `Group · ${activeRoom.members} members` : 'Direct Message'}
          </p>
        </div>

        <div className="chat-right-section">
          <p className="chat-right-section-title">Members</p>
          <div className="chat-right-members">
            {activeRoom.type === 'group'
              ? (roomMembers[activeRoom.id] || []).map(m => {
                  const name = m.username || m.email || 'Unknown';
                  return (
                    <div key={m.userId} className="chat-right-member">
                      {m.avatar
                        ? <img src={m.avatar} alt={name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <AvatarChip name={name} size={30} color={colorFor(m.userId)} />
                      }
                      <span className="chat-right-member-name">{name}</span>
                      <span className="chat-right-member-dot" />
                    </div>
                  );
                })
              : (
                <div className="chat-right-member">
                  {activeRoom.avatar
                    ? <img src={activeRoom.avatar} alt={activeRoom.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <AvatarChip name={activeRoom.name} size={30} color={colorFor(activeRoom.id)} />
                  }
                  <span className="chat-right-member-name">{activeRoom.name}</span>
                  <span className="chat-right-member-dot" />
                </div>
              )
            }
            {activeRoom.type === 'group' && !(roomMembers[activeRoom.id]?.length) && (
              <p style={{ fontSize: 12, opacity: 0.45, padding: '4px 0' }}>Loading members…</p>
            )}
          </div>
        </div>

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
        </>
      ) : (
        <div className="chat-main chat-empty">Select a conversation to start chatting</div>
      )}
    </div>
  );
};

export default ChatPage;
