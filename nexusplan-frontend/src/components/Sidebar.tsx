import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useChatContext } from '../context/ChatContext';
import logo from '../assets/logoNexus.png';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Bell,
  Settings,
  LogOut,
  Plus,
  ChevronDown,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  MessageSquare,
} from 'lucide-react';
import { IoFolderOutline } from 'react-icons/io5';
import { LuKanban } from 'react-icons/lu';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    label: 'Dashboard',
  },
  { id: 'projects', icon: IoFolderOutline, path: '/projects', label: 'My Projects' },
  { id: 'tasks',    icon: LuKanban,        path: '/tasks',    label: 'Tasks' },
  { id: 'teams',    icon: Users,           path: '/teams',    label: 'Teams' },
  { id: 'chat',     icon: MessageSquare,   path: '/chat',     label: 'Chat' },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'My Projects',
  teams: 'Teams',
  revenue: 'Revenue',
  insights: 'Insights',
  contracts: 'Contracts',
  payments: 'Payments',
  notifications: 'Notifications',
};

const formatSegment = (seg: string) =>
  SEGMENT_LABELS[seg.toLowerCase()] ?? seg;


const MAX_NAV_AV = 4;

const CURSOR_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
];
function avatarColor(userId: string): string {
  let h = 5381;
  for (const c of userId) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return CURSOR_PALETTE[h % CURSOR_PALETTE.length];
}

const CHAT_COLORS = ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899','#3B82F6'];
function chatColorFor(id: string) { return CHAT_COLORS[id.charCodeAt(0) % CHAT_COLORS.length]; }
function fmtChatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const MiniAvatar: React.FC<{ name: string; avatar?: string; size?: number }> = ({ name, avatar, size = 36 }) => {
  const color = chatColorFor(name);
  const label = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  return avatar ? (
    <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.37, flexShrink: 0,
      letterSpacing: '-0.5px',
    }}>{label}</div>
  );
};

const OnlineUsersAvatars: React.FC = () => {
  const { isConnected, onlineUserIds, userMap } = useRealtime();
  const { user: currentUser } = useAuth();
  const others  = [...onlineUserIds].filter(uid => uid !== currentUser?.id);
  const visible = others.slice(0, MAX_NAV_AV);
  const extra   = others.length - MAX_NAV_AV;

  return (
    <div className="nb-online-stack">
      <span
        className={`nb-ws-dot ${isConnected ? 'nb-ws-dot--on' : 'nb-ws-dot--off'}`}
        title={isConnected ? 'Live sync active' : 'Connecting…'}
      />

      <div className="op-avatars">
        {visible.map((uid, i) => {
          const meta  = userMap[uid];
          const color = avatarColor(uid);
          const label = (meta?.username || meta?.email || uid).slice(0, 2).toUpperCase();
          return (
            <div
              key={uid}
              className="nb-av nb-av--live"
              style={{ background: color, zIndex: MAX_NAV_AV - i }}
              title={meta?.username || meta?.email || uid}
            >
              {meta?.avatar
                ? <img src={meta.avatar} alt="" />
                : label
              }
            </div>
          );
        })}
        {extra > 0 && (
          <div className="nb-av nb-av--extra" title={`${extra} more`}>+{extra}</div>
        )}
      </div>
    </div>
  );
};

export const TopNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = useState(false);

  const segments = location.pathname.split('/').filter(Boolean);


  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="nb">
      <div className="nb-left">
        <span className="nb-breadcrumb flex items-center">
          <button
            className="nb-breadcrumb-root hover:underline cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            NexusPlan
          </button>
          {segments.map((seg, i) => {
            const path = '/' + segments.slice(0, i + 1).join('/');
            const isLast = i === segments.length - 1;
            return (
              <React.Fragment key={path}>
                <svg className="nb-breadcrumb-sep" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                {isLast ? (
                  <span className="nb-breadcrumb-page">{formatSegment(seg)}</span>
                ) : (
                  <button
                    className="nb-breadcrumb-root hover:underline cursor-pointer"
                    onClick={() => navigate(path)}
                  >
                    {formatSegment(seg)}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </span>
      </div>

      <div className="nb-right">
        <label className="nb-search">
          <Search size={14} className="nb-search-icon" strokeWidth={2} />
          <input type="text" placeholder="Search anything…" className="nb-search-input" />
          <kbd className="nb-search-kbd">⌘K</kbd>
        </label>

        <button className="nb-icon-btn" title="Notifications">
          <Bell size={18} strokeWidth={2} />
          <span className="nb-badge">3</span>
        </button>

        <OnlineUsersAvatars />

        <div className="nb-user">
          <button className="nb-user-btn" onClick={() => setUserOpen(o => !o)}>
            <img
              src={user?.avatar ?? 'https://i.pravatar.cc/36?img=11'}
              alt={user?.username ?? 'User'}
              className="nb-user-avatar"
            />
            <span className="nb-user-ring" />
          </button>

          <AnimatePresence>
            {userOpen && (
              <motion.div
                className="nb-user-menu"
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
              >
                <div className="nb-user-menu-head">
                  <img
                    src={user?.avatar ?? 'https://i.pravatar.cc/36?img=11'}
                    alt={user?.username ?? 'User'}
                    className="nb-user-menu-avatar"
                  />
                  <div>
                    <p className="nb-user-menu-name">{user?.username ?? 'John Doe'}</p>
                    <p className="nb-user-menu-email">{user?.email ?? 'john@nexusplan.io'}</p>
                  </div>
                </div>
                <div className="nb-user-menu-divider" />
                <button className="nb-user-menu-item nb-user-menu-item--danger" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [subOpen, setSubOpen] = useState<string | null>('dashboard');
  const { rooms } = useChatContext();

  const recentConvos = [...rooms]
    .filter(r => !!r.lastMsg)
    .sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return b.lastTime.localeCompare(a.lastTime);
    })
    .slice(0, 3);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNav = (item: any) => {
    if (item.sub?.length) {
      if (collapsed) setCollapsed(false);
      setSubOpen(prev => (prev === item.id ? null : item.id));
    } else {
      navigate(item.path);
    }
  };

  return (
    <motion.aside
      className="sb"
      animate={{ width: collapsed ? 68 : 256 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="sb-header">
        <button className="sb-logo" onClick={() => navigate('/dashboard')}>
          <div className="sb-logo-icon">
            <img src={logo} alt="NexusPlan" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                className="sb-logo-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                Nexus<span className="sb-logo-thin">Plan</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <motion.button
          className="sb-toggle absolute p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
          animate={{
            x: collapsed ? 5 : 200,
            y: collapsed ? 50 : 0
          }}
          initial={false}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        >
          {collapsed
            ? <PanelLeftOpen size={16} strokeWidth={2} />
            : <PanelLeftClose size={16} strokeWidth={2} />
          }
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="sb-search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Search size={14} strokeWidth={2} className="sb-search-icon" />
            <input type="text" placeholder="Search…" className="sb-search-input" />
            <kbd className="sb-search-kbd">⌘S</kbd>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className={`sb-nav ${collapsed ? 'mt-10 transition-all' : ''}`}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p className="sb-section-label"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >MAIN</motion.p>
          )}
        </AnimatePresence>

        {NAV_ITEMS.map((item: any) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const open = subOpen === item.id;
          const hasSub = !!item.sub?.length;

          return (
            <div key={item.id} className="sb-group">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={[
                  'sb-item',
                  active && !hasSub ? 'sb-item--active' : '',
                  hasSub && open && !collapsed ? 'sb-item--open' : '',
                ].join(' ')}
                onClick={() => handleNav(item)}
                title={collapsed ? item.label : undefined}
              >
                <span className="sb-item-icon"><Icon size={18} strokeWidth={2} /></span>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      key={item.id}
                      className="sb-item-label"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {!collapsed && hasSub && (
                  <motion.span
                    className="sb-item-chevron"
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={13} strokeWidth={2.5} />
                  </motion.span>
                )}
              </motion.button>

              <AnimatePresence initial={false}>
                {hasSub && open && !collapsed && (
                  <motion.div
                    className="sb-subnav"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    {item.sub!.map((sub: any) => (
                      <button
                        key={sub.id}
                        className={`sb-sub-item ${isActive(sub.path) ? 'sb-sub-item--active' : ''}`}
                        onClick={() => navigate(sub.path)}
                      >
                        <span className="sb-sub-dot" />
                        {sub.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="sb-messages">
        <div className="sb-messages-head">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p className="sb-section-label"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >MESSAGES</motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.button className="sb-messages-add"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <Plus size={13} strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {recentConvos.length === 0 && !collapsed && (
          <p style={{ fontSize: 11, opacity: 0.4, padding: '4px 12px' }}>No recent chats</p>
        )}
        {recentConvos.map(room => (
          <button
            key={room.id}
            className="sb-contact"
            title={collapsed ? room.name : undefined}
            onClick={() => navigate(`/chat/${room.id}`)}
          >
            <div className="sb-contact-av-wrap" style={{ position: 'relative' }}>
              <MiniAvatar name={room.name} avatar={room.avatar} size={36} />
              {(room.unread ?? 0) > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: '#EF4444', color: '#fff', borderRadius: '50%',
                  width: 16, height: 16, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(room.unread ?? 0) > 9 ? '9+' : room.unread}
                </span>
              )}
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  className="sb-contact-name"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden', flex: 1 }}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: (room.unread ?? 0) > 0 ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                      {room.name}
                    </span>
                    {room.lastTime && (
                      <span style={{ fontSize: 10, opacity: 0.45, flexShrink: 0 }}>{fmtChatTime(room.lastTime)}</span>
                    )}
                  </div>
                  {room.lastMsg && (
                    <span style={{ fontSize: 11, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                      {room.lastMsg.length > 28 ? room.lastMsg.slice(0, 28) + '\u2026' : room.lastMsg}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      <div className="sb-footer">
        <button className="sb-settings sb-item" title={collapsed ? 'Settings' : undefined}>
          <span className="sb-item-icon"><Settings size={18} strokeWidth={2} /></span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span className="sb-item-label"
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
              >Settings</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;