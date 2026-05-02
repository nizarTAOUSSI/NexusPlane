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
    <aside className={`sidebar-root ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
      </button>

      <div className="sidebar-header">
        <button className="sidebar-logo-btn" onClick={() => navigate('/dashboard')} title="NexusPlan">
          <img src={logo} alt="NexusPlan" className="sidebar-logo-img" />
        </button>
      </div>

      <div className="sidebar-search-wrap">
        <Search className="sidebar-search-icon" size={18} strokeWidth={2} />
        {!collapsed && (
          <>
            <input
              type="text"
              placeholder="Search"
              className="sidebar-search-input"
            />
            <span className="sidebar-search-hint">
              <span className="cmd-icon">⌘</span> S
            </span>
          </>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-header">
           <p className="sidebar-section-label">{!collapsed && 'MAIN'}</p>
        </div>
        
        {NAV_MAIN.map(item => {
          const Icon = item.icon;
          const hasSub = !!item.sub?.length;
          const open = expanded === item.id;
          const active = isActive(item.path);

          return (
            <div key={item.id} className="sidebar-nav-group">
              <button
                className={`sidebar-nav-item ${active && !hasSub ? 'sidebar-nav-item--active' : ''} ${hasSub && open && !collapsed ? 'sidebar-nav-item--expanded' : ''}`}
                onClick={() => handleNav(item.path, hasSub, item.id)}
                title={collapsed ? item.label : ''}
              >
                <Icon size={20} strokeWidth={2} className="sidebar-nav-icon" />
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {!collapsed && hasSub && (
                  <span className="sidebar-nav-chevron">
                    {open ? <ChevronUp size={16} strokeWidth={2.5}/> : <ChevronDown size={16} strokeWidth={2.5} />}
                  </span>
                )}
              </button>

              {hasSub && open && !collapsed && (
                <div className="sidebar-subnav">
                  {item.sub!.map(sub => (
                    <button
                      key={sub.id}
                      className={`sidebar-subnav-item ${isActive(sub.path) ? 'sidebar-subnav-item--active' : ''}`}
                      onClick={() => navigate(sub.path)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              {hasSub && collapsed && (
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
        <div className="sidebar-section-header">
          <p className="sidebar-section-label">{!collapsed && 'MESSAGES'}</p>
          {!collapsed && (
            <button className="sidebar-messages-add" title="New message">
              <Plus size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        
        <div className="sidebar-messages-list">
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
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-user-wrap">
        <button
          className="sidebar-user"
          onClick={() => setUserMenuOpen(o => !o)}
          title={collapsed ? (user?.username ?? 'John Doe') : ''}
        >
          <div className="sidebar-user-avatar-wrap">
            {user?.avatar
              ? <img src={user.avatar} alt={user.username} className="sidebar-user-avatar" />
              : <div className="sidebar-user-avatar sidebar-user-avatar--placeholder">
                  <img src="https://i.pravatar.cc/150?img=11" alt="Placeholder" />
                </div>
            }
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.username ?? 'John Doe'}</span>
              <span className="sidebar-user-role">{user?.role ?? 'DESIGNER'}</span>
            </div>
          )}
          {!collapsed && <ChevronDown size={16} strokeWidth={2} className="sidebar-user-chevron" />}
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