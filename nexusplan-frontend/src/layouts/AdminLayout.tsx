import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, FolderKanban, ShieldAlert, Users, LogOut, Inbox, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ADMIN_NAV = [
  { id: 'overview', label: 'Overview', hash: '#overview', icon: BarChart3 },
  { id: 'users', label: 'Users', hash: '#users', icon: Users },
  { id: 'projects', label: 'Projects', hash: '#projects', icon: FolderKanban },
  { id: 'appeals', label: 'Appeals', hash: '#appeals', icon: Inbox },
  { id: 'ai-logs', label: 'AI Logs', hash: '#ai-logs', icon: Bot },
];

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user?.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-100 via-white to-red-50/40 flex">
      <aside className="hidden lg:flex w-72 border-r border-slate-200 bg-white/80 backdrop-blur-sm p-6 flex-col gap-6 sticky top-0 h-screen">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-600">Admin Space</p>
          <h1 className="text-2xl font-black text-slate-900 leading-tight mt-1">NexusPlan Control</h1>
          <p className="text-xs text-slate-500 mt-2">Espace de supervision et gouvernance plateforme</p>
        </div>

        <nav className="space-y-2">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = location.hash === item.hash || (!location.hash && item.id === 'overview');
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/admin${item.hash}`)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer',
                  isActive
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                    : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <ShieldAlert size={16} />
            User Workspace
          </button>
          <button
            onClick={handleSignout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-650 hover:bg-red-50 transition-all cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="lg:hidden mb-4 rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-red-600">Admin Space</p>
            <p className="text-base font-bold text-slate-900">NexusPlan Control</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-700"
          >
            User Workspace
          </button>
        </div>

        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
