import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logoNexus.png';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  LogOut,
  FolderKanban,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';

const MESSAGES = [
  { id: 1, name: 'Esther Howard', avatar: 'https://i.pravatar.cc/36?img=5', online: true },
  { id: 2, name: 'Jacob Jones',   avatar: 'https://i.pravatar.cc/36?img=12', online: false },
  { id: 3, name: 'Cody Fisher',   avatar: 'https://i.pravatar.cc/36?img=8', online: true },
];

const NAV_MAIN = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    sub: [
      { id: 'project',  label: 'Project',  path: '/dashboard/project' },
      { id: 'revenue',  label: 'Revenue',  path: '/dashboard/revenue' },
      { id: 'insights', label: 'Insights', path: '/dashboard/insights' },
    ],
  },
  { id: 'contracts',    label: 'Contracts',     icon: FileText,    path: '/dashboard/contracts' },
  { id: 'payments',     label: 'Payments',      icon: CreditCard,  path: '/dashboard/payments' },
  { id: 'notification', label: 'Notification',  icon: Bell,        path: '/dashboard/notifications' },
];

const Sidebar: React.FC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, logout } = useAuth();
  const [collapsed,   setCollapsed]   = useState(false);
  const [expanded,    setExpanded]    = useState<string | null>('dashboard');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNav = (path: string, hasChildren?: boolean, id?: string) => {
    if (hasChildren && id) {
      if (collapsed) { setCollapsed(false); }
      setExpanded(prev => (prev === id ? null : id));
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`sidebar-root ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
    >
      <div className="sidebar-header">
        <button
          className="sidebar-logo-btn"
          onClick={() => navigate('/dashboard')}
          title="NexusPlan"
        >
          <img src={logo} alt="NexusPlan" className="sidebar-logo-img" />
          {!collapsed && <span className="sidebar-logo-text">NexusPlan</span>}
        </button>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar-search-wrap">
        <Search className="sidebar-search-icon" size={15} />
        {!collapsed && (
          <>
            <input
              type="text"
              placeholder="Search"
              className="sidebar-search-input"
            />
            <span className="sidebar-search-hint">⌘ S</span>
          </>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">{!collapsed && 'MAIN'}</p>
        {NAV_MAIN.map(item => {
          const Icon = item.icon;
          const hasSub = !!item.sub?.length;
          const open = expanded === item.id;
          const active = isActive(item.path);

          return (
            <div key={item.id}>
              <button
                className={`sidebar-nav-item ${active ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNav(item.path, hasSub, item.id)}
                title={collapsed ? item.label : ''}
              >
                <Icon size={18} className="sidebar-nav-icon" />
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {!collapsed && hasSub && (
                  <span className="sidebar-nav-chevron">
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                )}
              </button>

              {/* Sub-items */}
              {hasSub && open && !collapsed && (
                <div className="sidebar-subnav">
                  {item.sub!.map(sub => (
                    <button
                      key={sub.id}
                      className={`sidebar-subnav-item ${isActive(sub.path) ? 'sidebar-subnav-item--active' : ''}`}
                      onClick={() => navigate(sub.path)}
                    >
                      <span className="sidebar-subnav-dot" />
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              {hasSub && open && collapsed && (
                <div className="sidebar-tooltip-menu">
                  {item.sub!.map(sub => (
                    <button
                      key={sub.id}
                      className={`sidebar-tooltip-item ${isActive(sub.path) ? 'sidebar-tooltip-item--active' : ''}`}
                      onClick={() => { navigate(sub.path); setExpanded(null); }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-messages">
        <div className="sidebar-messages-header">
          {!collapsed && <p className="sidebar-section-label">MESSAGES</p>}
          {!collapsed && (
            <button className="sidebar-messages-add" title="New message">
              <Plus size={14} />
            </button>
          )}
        </div>
        {MESSAGES.map(m => (
          <button key={m.id} className="sidebar-contact" title={collapsed ? m.name : ''}>
            <div className="sidebar-contact-avatar-wrap">
              <img src={m.avatar} alt={m.name} className="sidebar-contact-avatar" />
              {m.online && <span className="sidebar-contact-dot" />}
            </div>
            {!collapsed && <span className="sidebar-contact-name">{m.name}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-user-wrap">
        <button
          className="sidebar-user"
          onClick={() => setUserMenuOpen(o => !o)}
          title={collapsed ? (user?.username ?? 'User') : ''}
        >
          <div className="sidebar-user-avatar-wrap">
            {user?.avatar
              ? <img src={user.avatar} alt={user.username} className="sidebar-user-avatar" />
              : <div className="sidebar-user-avatar sidebar-user-avatar--placeholder">
                  {(user?.username?.[0] ?? 'U').toUpperCase()}
                </div>
            }
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.username ?? 'User'}</span>
              <span className="sidebar-user-role">{user?.role ?? 'Member'}</span>
            </div>
          )}
          {!collapsed && <ChevronDown size={14} className="sidebar-user-chevron" />}
        </button>

        {userMenuOpen && (
          <div className="sidebar-user-menu">
            <button className="sidebar-user-menu-item sidebar-user-menu-item--danger" onClick={handleLogout}>
              <LogOut size={14} />
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
