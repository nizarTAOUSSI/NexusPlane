import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { ShieldAlert, PowerOff, Power, Trash2, Edit2, Sparkles, Loader2 } from 'lucide-react';
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

const DialogModal: React.FC<{ dialog: NotificationModal; onClose: () => void }> = ({ dialog, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
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
                className="px-4 py-2.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4" 
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
        {/* Header */}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-wrap">
              {project.description || 'No description provided for this project.'}
            </p>
          </div>

          {/* Owner details */}
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

          {/* AI SUMMARY */}
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

          {/* Members list */}
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

        {/* Footer */}
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

const EditUserModal: React.FC<EditUserModalProps> = ({ userToEdit, onClose, onUpdateSuccess, showAlert }) => {
  const [username, setUsername] = useState(userToEdit.username || '');
  const [email, setEmail] = useState(userToEdit.email || '');
  const [role, setRole] = useState(userToEdit.role || 'USER');
  const [isActive, setIsActive] = useState(userToEdit.is_active ?? true);
  const [isSuperuser, setIsSuperuser] = useState(userToEdit.is_superuser ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.patch(`/auth/admin/users/${userToEdit.id}/`, {
        username,
        email,
        role,
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
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
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-800 bg-white"
            >
              <option value="USER">Standard User</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
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
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-650 hover:bg-slate-50 transition-all cursor-pointer"
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
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<any | null>(null);
  
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
        const usersRes = await api.get('/auth/admin/users/');
        setUsers(usersRes.data);
        const projRes = await api.get('/auth/admin/projects-with-members/');
        setProjects(projRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

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

  if (!user?.is_superuser) {
    return <div className="p-8 text-center text-red-500">Forbidden: Superadmin only</div>;
  }

  if (loading) return <div className="p-8">Loading admin dashboard...</div>;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert size={32} className="text-red-500" />
        <h1 className="text-2xl font-bold text-gray-800">Superadmin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* USERS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">All Users ({users.length})</h2>
          <div className="overflow-y-auto max-h-[60vh] -mx-4 px-4">
            {users.map(u => (
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
                      {u.username} {u.is_superuser && <span className="text-[10px] bg-red-55 text-red-700 border border-red-100 px-2 py-0.5 rounded-full ml-1.5 font-bold tracking-wider">SUPERADMIN</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700 border border-green-150' : 'bg-red-50 text-red-700 border border-red-150'}`}>
                     {u.is_active ? 'Active' : 'Banned'}
                  </span>
                  
                  {/* EDIT USER */}
                  <button 
                    onClick={() => setSelectedUserToEdit(u)}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    title="Modify User"
                  >
                    <Edit2 size={14} />
                  </button>

                  {!u.is_superuser && (
                    <>
                      {/* TOGGLE BAN */}
                      <button onClick={() => toggleBan(u.id, u.username, u.is_active)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors cursor-pointer" title={u.is_active ? "Ban User" : "Unban User"}>
                        {u.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      
                      {/* DELETE USER */}
                      <button onClick={() => handleDeleteUser(u.id, u.username)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-650 transition-colors cursor-pointer" title="Delete User">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* PROJECTS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">All Projects ({projects.length})</h2>
          <div className="overflow-y-auto max-h-[60vh] -mx-4 px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-16 p-2 justify-items-center">
              {projects.map(p => {
                const owner = users.find(u => u.id === p.ownerId);
                return (
                  <div key={p.id} className="w-60 h-[220px] flex items-center justify-center">
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
          </div>
        </div>
      </div>

      {/* PROJECT DETAILS MODAL */}
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

      {/* MODIFY USER MODAL */}
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

      {/* GENERAL DIALOG MODAL (CONFIRMATIONS / ALERTS) */}
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
