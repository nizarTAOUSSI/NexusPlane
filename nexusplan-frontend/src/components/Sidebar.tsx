import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';
import { IoFolderOutline } from 'react-icons/io5';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    label: 'Dashboard',
    // sub: [
    //   { id: 'project',  label: 'Project',  path: '/dashboard/project'  },
    //   { id: 'revenue',  label: 'Revenue',  path: '/dashboard/revenue'  },
    //   { id: 'insights', label: 'Insights', path: '/dashboard/insights' },
    // ],
  },
  { id: 'projetcs', icon: IoFolderOutline, path: '/Projects', label: 'Projects' },
];

const MESSAGES = [
  { id: 1, name: 'Esther Howard', avatar: 'https://i.pravatar.cc/36?img=5', online: true },
  { id: 2, name: 'Jacob Jones', avatar: 'https://i.pravatar.cc/36?img=12', online: false },
  { id: 3, name: 'Cody Fisher', avatar: 'https://i.pravatar.cc/36?img=8', online: true },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  revenue: 'Revenue',
  insights: 'Insights',
  contracts: 'Contracts',
  payments: 'Payments',
  notifications: 'Notifications',
};

const formatSegment = (seg: string) =>
  SEGMENT_LABELS[seg.toLowerCase()] ?? seg;

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

        <div className="nb-avatars">
          <div className="nb-av nb-av--pink" title="Team member" />
          <div className="nb-av nb-av--blue" title="Team member" />
          <div className="nb-av nb-av--amber" title="Team member" />
        </div>

        <button className="nb-cta" onClick={() => { }}>
          <Plus size={14} strokeWidth={2.5} />
          <span>New Project</span>
        </button>

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

        {MESSAGES.map(m => (
          <button key={m.id} className="sb-contact" title={collapsed ? m.name : undefined}>
            <div className="sb-contact-av-wrap">
              <img src={m.avatar} alt={m.name} className="sb-contact-av" />
              {m.online && <span className="sb-contact-dot" />}
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  className="sb-contact-name"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {m.name}
                </motion.span>
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