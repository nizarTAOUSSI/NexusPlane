import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { ShieldAlert, PowerOff, Power, Trash2, Edit2, Sparkles, Loader2, Inbox, Bot, BarChart3, UsersRound, FolderKanban, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Folder from '../components/Folder';
import { aiService } from '../services/aiService';
import { taskService } from '../services/taskService';

interface NotificationModal {
  type: 'confirm' | 'alert';
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AIRequestLog {
  id: string;
  userId: string;
  projectId: string | null;
  promptType: string;
  tokensUsed: number;
  createdAt: string;
}

const DialogModal: React.FC<{ dialog: NotificationModal; onClose: () => void }> = ({ dialog, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-200 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', duration: 0.25 }}
        className="w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-6"
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 border border-slate-100 mb-4 text-xl">
            {dialog.type === 'confirm' ? '❓' : '⚠️'}
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">{dialog.message}</p>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          {dialog.type === 'confirm' ? (
            <>
              <button 
                onClick={() => { dialog.onCancel?.(); onClose(); }} 
                className="px-4 py-2.5 border border-slate-200 text-xs font-bold text-slate-650 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => { dialog.onConfirm?.(); onClose(); }} 
                className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
              >
                Confirm
              </button>
            </>
          ) : (
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 active:scale-[0.98] transition-all shadow-md shadow-slate-900/15 cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ProjectModalProps {
  project: any;
  users: any[];
  onClose: () => void;
  onDeleteSuccess: (id: string) => void;
  showAlert: (msg: string) => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const ProjectDetailsModal: React.FC<ProjectModalProps> = ({ project, users, onClose, onDeleteSuccess, showAlert, showConfirm }) => {
  const { user } = useAuth();
  const owner = users.find(u => u.id === project.ownerId);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      VIEWER: 'bg-indigo-50/80 text-indigo-600 border-indigo-100',
      CONTRIBUTOR: 'bg-emerald-50/80 text-emerald-600 border-emerald-100',
      MANAGER: 'bg-amber-50/80 text-amber-600 border-amber-100',
    };
    return styles[role] || 'bg-gray-50 text-gray-600 border-gray-100';
  };

  const handleGetSummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const tasks = await taskService.getTasksByProject(project.id);
      const taskContexts = tasks.map(t => ({
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate || '',
        assignee: t.assigneeIds && t.assigneeIds.length > 0 ? t.assigneeIds.join(', ') : ''
      }));

      const res = await aiService.summarizeProject({
        projectId: project.id,
        projectName: project.name,
        tasks: taskContexts
      }, user?.id || '');
      setAiSummary(res.summary);
    } catch (err) {
      console.error(err);
      showAlert("Failed to generate AI summary. Verify that your AI service and keys are configured correctly.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    showConfirm(`Are you sure you want to permanently delete the project "${project.name}"? This action cannot be undone.`, async () => {
      try {
        await api.delete(`/projects/${project.id}/`, {
          headers: { 'X-Is-Superuser': 'true' }
        });
        onDeleteSuccess(project.id);
        onClose();
      } catch (err) {
        console.error(err);
        showAlert("Failed to delete project.");
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="w-full max-w-2xl bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-snug">{project.name}</h2>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                project.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {project.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Created on {new Date(project.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-wrap">
              {project.description || 'No description provided for this project.'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Project Owner</h3>
            <div className="flex items-center gap-3.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              {owner?.avatar ? (
                <img src={owner.avatar} alt="avatar" className="w-11 h-11 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                  {owner?.username?.slice(0, 2).toUpperCase() || 'OW'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{owner?.username || 'Unknown User'}</span>
                <span className="text-xs text-slate-500 mt-0.5">{owner?.email || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Executive Summary</h3>
              <button 
                onClick={handleGetSummary}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50 cursor-pointer"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? 'Summarizing...' : 'Summarize Project'}
              </button>
            </div>
            <AnimatePresence>
              {aiSummary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 text-sm text-indigo-950 font-medium leading-relaxed whitespace-pre-wrap"
                >
                  {aiSummary}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Team Members ({project.members?.length || 0})
            </h3>
            {project.members && project.members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[25vh] overflow-y-auto pr-1">
                {project.members.map((m: any) => {
                  const mUser = m.user || {};
                  return (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {mUser.avatar ? (
                          <img src={mUser.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {(mUser.username || mUser.email || 'M').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-700 truncate">{mUser.username || 'User'}</span>
                          <span className="text-[10px] text-slate-400 truncate mt-0.5">{mUser.email}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${getRoleBadge(m.role)}`}>
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                This project does not have any team members.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button 
            onClick={handleDeleteProject}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-650 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 hover:text-red-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 active:scale-[0.98] transition-all shadow-md shadow-slate-900/10 cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface EditUserModalProps {
  userToEdit: any;
  onClose: () => void;
  onUpdateSuccess: (updatedUser: any) => void;
  showAlert: (msg: string) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ userToEdit, onClose, onUpdateSuccess }) => {
  const [username, setUsername] = useState(userToEdit.username || '');
  const [email, setEmail] = useState(userToEdit.email || '');
  const [isActive, setIsActive] = useState(userToEdit.is_active ?? true);
  const [isSuperuser, setIsSuperuser] = useState(userToEdit.is_superuser ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isBotAccount = String(userToEdit.role || '').toUpperCase() === 'BOT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.patch(`/auth/admin/users/${userToEdit.id}/`, {
        username,
        email,
        role: 'USER',
        is_active: isActive,
        is_superuser: isSuperuser,
      });
      onUpdateSuccess(res.data.user);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || "Failed to update user.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-110 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Modify User Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-800"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-800"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">System Role</label>
            <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>{isBotAccount ? 'Bot' : 'User'}</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isBotAccount ? 'System' : 'Default'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
                disabled={isBotAccount}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              Active Account
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={isSuperuser} 
                onChange={e => setIsSuperuser(e.target.checked)} 
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              Superadmin Access
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-655 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-650 text-white text-xs font-bold hover:bg-indigo-750 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const AdminDashboardPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<AIRequestLog[]>([]);
  const [aiLogsLoading, setAiLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<any | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'superadmin' | 'user' | 'bot'>('all');

  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'ACTIVE' | 'ARCHIVED'>('all');
  const [projectOwnerFilter, setProjectOwnerFilter] = useState<string>('all');
  
  // Tabs navigation
  const [leftTab, setLeftTab] = useState<'users' | 'appeals'>('users');

  // Custom dialog notifications modal state
  const [dialog, setDialog] = useState<NotificationModal | null>(null);

  const showAlert = (message: string) => {
    setDialog({ type: 'alert', message });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setDialog({
      type: 'confirm',
      message,
      onConfirm
    });
  };

  useEffect(() => {
    if (!user?.is_superuser) return;

    const fetchData = async () => {
      try {
        setAiLogsLoading(true);
        const usersRes = await api.get('/auth/admin/users/');
        setUsers(usersRes.data);
        const projRes = await api.get('/auth/admin/projects-with-members/');
        setProjects(projRes.data);
        const appealsRes = await api.get('/auth/admin/appeals/');
        setAppeals(appealsRes.data);
        const logsRes = await api.get('/auth/admin/ai-request-logs/');
        setAiLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setAiLogsLoading(false);
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const section = (location.hash || '#overview').slice(1);

    if (section === 'appeals') {
      setLeftTab('appeals');
    } else if (section === 'users') {
      setLeftTab('users');
    }

    // Wait for possible tab switch render before scrolling.
    setTimeout(() => {
      const target = document.getElementById(section);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }, [location.hash]);

  const toggleBan = async (id: string, username: string, isActive: boolean) => {
    const action = isActive ? 'ban' : 'unban';
    showConfirm(`Are you sure you want to ${action} user "${username}"?`, async () => {
      try {
        const res = await api.post(`/auth/admin/ban-user/${id}/`);
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.data.is_active } : u));
        showAlert(`User successfully ${action}ned.`);
      } catch (e: any) {
        console.error(e);
        const detail = e.response?.data?.detail;
        showAlert(detail || `Failed to ${action} user.`);
      }
    });
  };

  const handleDeleteUser = async (id: string, username: string) => {
    showConfirm(`Are you sure you want to permanently delete user "${username}"? This cannot be undone.`, async () => {
      try {
        await api.delete(`/auth/admin/users/${id}/`);
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (e: any) {
        console.error(e);
        showAlert(e.response?.data?.detail || 'Failed to delete user.');
      }
    });
  };

  const handleUserUpdateSuccess = (updatedUser: any) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleResolveAppeal = async (appealId: string, email: string) => {
    const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      showAlert("Could not find a registered user with this email.");
      return;
    }

    showConfirm(`Are you sure you want to reactivate user "${targetUser.username}"?`, async () => {
      try {
        // Unban user
        const res = await api.post(`/auth/admin/ban-user/${targetUser.id}/`);
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: res.data.is_active } : u));
        
        // Delete appeal record
        await api.delete(`/auth/admin/appeals/${appealId}/`);
        setAppeals(prev => prev.filter(a => a.id !== appealId));

        showAlert("User account reactivated successfully.");
      } catch (e: any) {
        console.error(e);
        showAlert(e.response?.data?.detail || "Failed to resolve appeal.");
      }
    });
  };

  const handleDeleteAppeal = async (appealId: string) => {
    showConfirm("Are you sure you want to dismiss this appeal?", async () => {
      try {
        await api.delete(`/auth/admin/appeals/${appealId}/`);
        setAppeals(prev => prev.filter(a => a.id !== appealId));
        showAlert("Appeal dismissed successfully.");
      } catch (e: any) {
        console.error(e);
        showAlert("Failed to delete appeal.");
      }
    });
  };

  const aiStats = useMemo(() => {
    const totalTokens = aiLogs.reduce((sum, log) => sum + (Number(log.tokensUsed) || 0), 0);
    const uniqueUsers = new Set(aiLogs.map(log => log.userId)).size;
    const uniqueProjects = new Set(aiLogs.filter(log => !!log.projectId).map(log => log.projectId)).size;

    const byPromptMap = new Map<string, number>();
    aiLogs.forEach((log) => {
      const key = (log.promptType || 'unknown').toLowerCase();
      byPromptMap.set(key, (byPromptMap.get(key) || 0) + 1);
    });
    const byPrompt = Array.from(byPromptMap.entries())
      .map(([promptType, count]) => ({ promptType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const byDayMap = new Map<string, number>();
    aiLogs.forEach((log) => {
      const day = new Date(log.createdAt).toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
    });
    const byDay = Array.from(byDayMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-7);

    return {
      totalRequests: aiLogs.length,
      totalTokens,
      uniqueUsers,
      uniqueProjects,
      byPrompt,
      byDay,
    };
  }, [aiLogs]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      const statusOk =
        userStatusFilter === 'all'
          ? true
          : userStatusFilter === 'active'
            ? !!u.is_active
            : !u.is_active;

      const roleOk =
        userRoleFilter === 'all'
          ? true
          : userRoleFilter === 'superadmin'
            ? !!u.is_superuser
            : userRoleFilter === 'bot'
              ? String(u.role || '').toUpperCase() === 'BOT'
            : !u.is_superuser;

      const queryOk =
        !q ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q);

      return statusOk && roleOk && queryOk;
    });
  }, [users, userSearch, userStatusFilter, userRoleFilter]);

  const projectOwnerOptions = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u.username || u.email || u.id]));
    const owners = new Map<string, string>();
    projects.forEach((p) => {
      const ownerId = String(p.ownerId || '');
      if (!ownerId) return;
      owners.set(ownerId, byId.get(ownerId) || ownerId);
    });
    return Array.from(owners.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [users, projects]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const ownerNameById = new Map(users.map((u) => [u.id, u.username || u.email || u.id]));

    return projects.filter((p) => {
      const statusOk = projectStatusFilter === 'all' ? true : String(p.status) === projectStatusFilter;
      const ownerOk = projectOwnerFilter === 'all' ? true : String(p.ownerId) === projectOwnerFilter;
      const ownerName = String(ownerNameById.get(p.ownerId) || p.ownerId || '').toLowerCase();
      const queryOk =
        !q ||
        String(p.name || '').toLowerCase().includes(q) ||
        ownerName.includes(q);

      return statusOk && ownerOk && queryOk;
    });
  }, [projects, users, projectSearch, projectStatusFilter, projectOwnerFilter]);

  if (!user?.is_superuser) {
    return <div className="p-8 text-center text-red-500">Forbidden: Superadmin only</div>;
  }

  if (loading) return <div className="p-8">Loading admin dashboard...</div>;

  const maxPromptCount = Math.max(1, ...aiStats.byPrompt.map(x => x.count));
  const maxDayCount = Math.max(1, ...aiStats.byDay.map(x => x.count));

  return (
    <div id="overview" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-red-900 px-6 py-7 shadow-xl shadow-slate-900/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center">
              <ShieldAlert size={22} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-red-200 font-black">Admin Control Center</p>
              <h1 className="text-2xl font-black text-white">NexusPlan Governance Dashboard</h1>
            </div>
          </div>
          <p className="text-sm text-slate-200 font-medium">Espace dédié administration, sécurité et pilotage plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">AI Requests</p>
            <BarChart3 size={16} className="text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{aiStats.totalRequests}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Tokens Consumed</p>
            <Bot size={16} className="text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{aiStats.totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Managed Users</p>
            <UsersRound size={16} className="text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Projects</p>
            <FolderKanban size={16} className="text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{projects.length}</p>
        </div>
      </div>

      <section id="ai-logs" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">AI Requests by Prompt Type</h2>
          {aiLogsLoading ? (
            <p className="text-sm text-slate-500">Loading AI logs...</p>
          ) : aiStats.byPrompt.length === 0 ? (
            <p className="text-sm text-slate-500">No AI request logs available.</p>
          ) : (
            <div className="space-y-3">
              {aiStats.byPrompt.map((item) => (
                <div key={item.promptType} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="capitalize">{item.promptType.replace(/_/g, ' ')}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-red-500 to-orange-500"
                      style={{ width: `${(item.count / maxPromptCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">AI Requests Last 7 Days</h2>
          {aiLogsLoading ? (
            <p className="text-sm text-slate-500">Loading AI logs...</p>
          ) : aiStats.byDay.length === 0 ? (
            <p className="text-sm text-slate-500">No activity in the selected period.</p>
          ) : (
            <div className="grid grid-cols-7 gap-2 items-end h-44">
              {aiStats.byDay.map((day) => (
                <div key={day.day} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="text-[10px] font-bold text-slate-700">{day.count}</div>
                  <div
                    className="w-full rounded-t-lg bg-linear-to-t from-slate-900 to-slate-500"
                    style={{ height: `${Math.max(8, (day.count / maxDayCount) * 120)}px` }}
                  />
                  <div className="text-[10px] text-slate-500 font-semibold">{new Date(day.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500 grid grid-cols-2 gap-2">
            <p>Unique users: <span className="font-bold text-slate-700">{aiStats.uniqueUsers}</span></p>
            <p>Active projects: <span className="font-bold text-slate-700">{aiStats.uniqueProjects}</span></p>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <div id="users" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">User Governance</p>
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
            <div className="flex gap-4">
              <button 
                onClick={() => setLeftTab('users')} 
                className={`text-sm font-bold pb-2 transition-all cursor-pointer ${leftTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-650' : 'text-gray-400 hover:text-gray-655'}`}
              >
                All Users ({filteredUsers.length}/{users.length})
              </button>
              <button 
                onClick={() => setLeftTab('appeals')} 
                className={`text-sm font-bold pb-2 transition-all cursor-pointer flex items-center gap-1.5 ${leftTab === 'appeals' ? 'text-indigo-600 border-b-2 border-indigo-655' : 'text-gray-400 hover:text-gray-655'}`}
              >
                <Inbox size={14} />
                Appeals ({appeals.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <label className="md:col-span-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white">
              <Search size={14} className="text-slate-400" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-sm outline-none bg-transparent"
              />
            </label>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value as 'all' | 'active' | 'banned')}
              className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as 'all' | 'superadmin' | 'user' | 'bot')}
              className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700"
            >
              <option value="all">All roles</option>
              <option value="superadmin">Superadmins</option>
              <option value="bot">Bots</option>
              <option value="user">Users</option>
            </select>
          </div>

          <div className="overflow-y-auto -mx-4 px-4 max-h-[60vh]">
            {leftTab === 'users' ? (
              filteredUsers.length > 0 ? filteredUsers.map(u => (
                <motion.div key={u.id} layout className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {u.username}
                        {String(u.role || '').toUpperCase() === 'BOT' && <span className="text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-100 px-2 py-0.5 rounded-full ml-1.5 font-bold tracking-wider">BOT</span>}
                        {u.is_superuser && <span className="text-[10px] bg-red-55 text-red-700 border border-red-100 px-2 py-0.5 rounded-full ml-1.5 font-bold tracking-wider">SUPERADMIN</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700 border border-green-150' : 'bg-red-50 text-red-700 border border-red-150'}`}>
                       {u.is_active ? 'Active' : 'Banned'}
                    </span>
                    
                    <button 
                      onClick={() => setSelectedUserToEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Modify User"
                    >
                      <Edit2 size={14} />
                    </button>

                    {!u.is_superuser && String(u.role || '').toUpperCase() !== 'BOT' && (
                      <>
                        <button onClick={() => toggleBan(u.id, u.username, u.is_active)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors cursor-pointer" title={u.is_active ? "Ban User" : "Unban User"}>
                          {u.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                        </button>
                        
                        <button onClick={() => handleDeleteUser(u.id, u.username)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-650 transition-colors cursor-pointer" title="Delete User">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No users match current filters.
                </div>
              )
            ) : (
              <div id="appeals">
                {appeals.length > 0 ? (
                  appeals.map(appeal => (
                    <motion.div key={appeal.id} layout className="flex flex-col p-4 border-b border-gray-50 hover:bg-slate-50/50 rounded-xl space-y-2 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-800">{appeal.email}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{new Date(appeal.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-xl italic">
                        "{appeal.message}"
                      </p>
                      <div className="flex justify-end gap-2 pt-1">
                        <button 
                          onClick={() => handleResolveAppeal(appeal.id, appeal.email)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer"
                        >
                          Reactivate & Close
                        </button>
                        <button 
                          onClick={() => handleDeleteAppeal(appeal.id)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No pending deactivation appeals.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div id="projects" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Project Oversight</p>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">All Projects ({filteredProjects.length}/{projects.length})</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <label className="md:col-span-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white">
              <Search size={14} className="text-slate-400" />
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects or owner..."
                className="w-full text-sm outline-none bg-transparent"
              />
            </label>
            <select
              value={projectStatusFilter}
              onChange={(e) => setProjectStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'ARCHIVED')}
              className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700"
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              value={projectOwnerFilter}
              onChange={(e) => setProjectOwnerFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700"
            >
              <option value="all">All owners</option>
              {projectOwnerOptions.map(([ownerId, ownerName]) => (
                <option key={ownerId} value={ownerId}>{ownerName}</option>
              ))}
            </select>
          </div>

          <div className="overflow-y-auto max-h-[60vh] -mx-4 px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-16 p-2 justify-items-center">
              {filteredProjects.map(p => {
                const owner = users.find(u => u.id === p.ownerId);
                return (
                  <div key={p.id} className="w-60 h-55 flex items-center justify-center">
                    <Folder
                      title={p.name}
                      link={`/projects/${p.id}`}
                      subtitle={owner ? `Owner: ${owner.username}` : `Owner: ${p.ownerId}`}
                      status={p.status}
                      memberCount={p.members?.length}
                      onClick={() => setSelectedProject(p)}
                    />
                  </div>
                );
              })}
            </div>
            {filteredProjects.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                No projects match current filters.
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailsModal 
            project={selectedProject} 
            users={users} 
            onClose={() => setSelectedProject(null)} 
            onDeleteSuccess={(deletedId) => setProjects(prev => prev.filter(p => p.id !== deletedId))}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUserToEdit && (
          <EditUserModal 
            userToEdit={selectedUserToEdit}
            onClose={() => setSelectedUserToEdit(null)}
            onUpdateSuccess={handleUserUpdateSuccess}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog && (
          <DialogModal 
            dialog={dialog} 
            onClose={() => setDialog(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboardPage;
