import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, Archive, Trash2,
  Clock, Crown, Eye, Edit3, RefreshCw, FolderOpen,
  UserPlus, X, Send, CheckCircle, AlertCircle, Mail,
  ChevronDown, Shield, LogOut, UserMinus, Loader2 as LoaderIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { projectsApi, type Project, type Membership, type InvitePayload } from '../projectsApi';
import { teamsApi, type Team } from '../teamsApi';
import { useAuth } from '../context/AuthContext';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

const roleIcon = (role: Membership['role']) => {
  if (role === 'OWNER') return <Shield size={13} className="pd-role-icon pd-role-icon--owner" />;
  if (role === 'MANAGER') return <Crown size={13} className="pd-role-icon pd-role-icon--manager" />;
  if (role === 'CONTRIBUTOR') return <Edit3 size={13} className="pd-role-icon pd-role-icon--contributor" />;
  return <Eye size={13} className="pd-role-icon pd-role-icon--viewer" />;
};

const roleClass = (role: Membership['role']) => ({
  OWNER: 'pd-badge pd-badge--owner',
  MANAGER: 'pd-badge pd-badge--manager',
  CONTRIBUTOR: 'pd-badge pd-badge--contributor',
  VIEWER: 'pd-badge pd-badge--viewer',
}[role] ?? 'pd-badge pd-badge--viewer');


type InviteStatus = 'idle' | 'loading' | 'success_existing' | 'success_new' | 'error';

interface InviteModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onMemberAdded: () => void;
}

const ROLES: Array<{ value: NonNullable<InvitePayload['role']>; label: string; desc: string }> = [
  { value: 'VIEWER', label: 'Viewer', desc: 'Can view project only' },
  { value: 'CONTRIBUTOR', label: 'Contributor', desc: 'Can edit tasks & content' },
  { value: 'MANAGER', label: 'Manager', desc: 'Full project control' },
];

const InviteModal: React.FC<InviteModalProps> = ({
  projectId, projectName, onClose, onMemberAdded,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<NonNullable<InvitePayload['role']>>('VIEWER');
  const [roleOpen, setRoleOpen] = useState(false);
  const [status, setStatus] = useState<InviteStatus>('idle');
  const [message, setMessage] = useState('');
  const roleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedRole = ROLES.find(r => r.value === role)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStatus('loading');
    setMessage('');

    try {
      const result = await projectsApi.inviteMember(projectId, { email: trimmed, role });

      if (result?.id) {
        setStatus('success_existing');
        setMessage(`${trimmed} has been added to "${projectName}". An invitation email has been sent.`);
        onMemberAdded();
      } else {
        setStatus('success_new');
        setMessage(`No account found for ${trimmed}. A registration invitation has been sent to their email.`);
      }
    } catch (err: unknown) {
      setStatus('error');
      const msg =
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'Something went wrong. Please try again.';
      setMessage(msg);
    }
  };

  const isSuccess = status === 'success_existing' || status === 'success_new';
  // const canSendAnother = isSuccess && status === 'success_new';

  const resetForm = () => {
    setEmail('');
    setRole('VIEWER');
    setStatus('idle');
    setMessage('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="invite-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        className="invite-modal"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="invite-modal-header">
          <div className="invite-modal-icon">
            <UserPlus size={20} />
          </div>
          <div className="invite-modal-title-wrap">
            <h2 className="invite-modal-title">Invite Member</h2>
            <p className="invite-modal-sub">Add a collaborator to <strong>{projectName}</strong></p>
          </div>
          <button className="invite-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              className="invite-success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className={`invite-success-icon ${status === 'success_new' ? 'invite-success-icon--new' : ''}`}>
                {status === 'success_new' ? <Mail size={28} /> : <CheckCircle size={28} />}
              </div>
              <p className="invite-success-title">
                {status === 'success_existing' ? 'Member Added!' : 'Invitation Sent!'}
              </p>
              <p className="invite-success-msg">{message}</p>
              <div className="invite-success-actions">
                {status === 'success_existing' && (
                  <button className="invite-btn-ghost" onClick={resetForm}>
                    <UserPlus size={15} /> Invite Another
                  </button>
                )}
                <button className="invite-btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className="invite-form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="invite-field">
                <label className="invite-label" htmlFor="invite-email">
                  Email address
                </label>
                <div className="invite-input-wrap">
                  <Mail size={16} className="invite-input-icon" />
                  <input
                    ref={inputRef}
                    id="invite-email"
                    type="email"
                    className="invite-input"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (status !== 'idle') setStatus('idle'); }}
                    disabled={status === 'loading'}
                    required
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="invite-field">
                <label className="invite-label">Role</label>
                <div className="invite-role-select" ref={roleRef}>
                  <button
                    type="button"
                    className="invite-role-btn"
                    onClick={() => setRoleOpen(o => !o)}
                    disabled={status === 'loading'}
                  >
                    <span className={`invite-role-dot invite-role-dot--${role.toLowerCase()}`} />
                    <span className="invite-role-btn-label">{selectedRole.label}</span>
                    <span className="invite-role-btn-desc">{selectedRole.desc}</span>
                    <ChevronDown size={15} className={`invite-role-chevron ${roleOpen ? 'invite-role-chevron--open' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {roleOpen && (
                      <motion.div
                        className="invite-role-dropdown"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                      >
                        {ROLES.map(r => (
                          <button
                            key={r.value}
                            type="button"
                            className={`invite-role-option ${role === r.value ? 'invite-role-option--active' : ''}`}
                            onClick={() => { setRole(r.value); setRoleOpen(false); }}
                          >
                            <span className={`invite-role-dot invite-role-dot--${r.value.toLowerCase()}`} />
                            <span className="invite-role-option-info">
                              <span className="invite-role-option-label">{r.label}</span>
                              <span className="invite-role-option-desc">{r.desc}</span>
                            </span>
                            {role === r.value && <CheckCircle size={14} className="invite-role-check" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence>
                {status === 'error' && (
                  <motion.div
                    className="invite-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <AlertCircle size={15} />
                    <span>{message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="invite-note">
                If the email isn't registered, they'll receive an invitation to create an account.
              </p>

              <div className="invite-actions">
                <button type="button" className="invite-btn-ghost" onClick={onClose} disabled={status === 'loading'}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="invite-btn-primary"
                  disabled={status === 'loading' || !email.trim()}
                >
                  {status === 'loading' ? (
                    <>
                      <div className="invite-spinner" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ── Add Team to Project Modal ──────────────────────────────────────────────

interface AddTeamModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onAdded: () => void;
}

const PROJECT_ROLES: Array<{ value: 'VIEWER' | 'CONTRIBUTOR' | 'MANAGER'; label: string }> = [
  { value: 'VIEWER',      label: 'Viewer' },
  { value: 'CONTRIBUTOR', label: 'Contributor' },
  { value: 'MANAGER',     label: 'Manager' },
];

const AddTeamModal: React.FC<AddTeamModalProps> = ({
  projectId, projectName, onClose, onAdded,
}) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [role, setRole] = useState<'VIEWER' | 'CONTRIBUTOR' | 'MANAGER'>('CONTRIBUTOR');
  const [roleOpen, setRoleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    teamsApi.list(user.id)
      .then(data => { setTeams(data); if (data.length > 0) setSelectedTeam(data[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!selectedTeam) return;
    setSubmitting(true); setError('');
    try {
      const res = await teamsApi.inviteToProject(selectedTeam.id, { projectId, role });
      setResult({ added: res.added, skipped: res.skipped });
      onAdded();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to invite team.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="invite-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        className="invite-modal"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="invite-modal-header">
          <div className="invite-modal-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
            <Users size={20} />
          </div>
          <div className="invite-modal-title-wrap">
            <h2 className="invite-modal-title">Add Team to Project</h2>
            <p className="invite-modal-sub">Invite all members of a team to <strong>{projectName}</strong></p>
          </div>
          <button className="invite-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {result ? (
          <motion.div className="invite-success"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="invite-success-icon">
              <CheckCircle size={28} />
            </div>
            <p className="invite-success-title">Team Added!</p>
            <p className="invite-success-msg">
              {result.added} member{result.added !== 1 ? 's' : ''} added
              {result.skipped > 0 ? `, ${result.skipped} already in project` : ''}.
            </p>
            <div className="invite-success-actions">
              <button className="invite-btn-primary" onClick={onClose}>Done</button>
            </div>
          </motion.div>
        ) : (
          <div className="invite-form">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <LoaderIcon size={24} className="projects-spinner" />
              </div>
            ) : teams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-2)' }}>
                <Users size={36} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>You have no teams yet.</p>
                <p style={{ fontSize: 13 }}>Create a team first from the Teams page.</p>
              </div>
            ) : (
              <>
                <div className="invite-field">
                  <label className="invite-label">Select Team</label>
                  <div className="atm-team-list">
                    {teams.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className={`atm-team-opt ${selectedTeam?.id === t.id ? 'atm-team-opt--active' : ''}`}
                        onClick={() => setSelectedTeam(t)}
                      >
                        <div className="atm-team-av">{t.name.slice(0, 2).toUpperCase()}</div>
                        <div className="atm-team-info">
                          <span className="atm-team-name">{t.name}</span>
                          <span className="atm-team-count">
                            {t.memberCount} member{t.memberCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {selectedTeam?.id === t.id && <CheckCircle size={16} className="atm-team-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="invite-field">
                  <label className="invite-label">Role to assign</label>
                  <div className="invite-role-select" ref={roleRef}>
                    <button
                      type="button"
                      className="invite-role-btn"
                      onClick={() => setRoleOpen(o => !o)}
                    >
                      <span className={`invite-role-dot invite-role-dot--${role.toLowerCase()}`} />
                      <span className="invite-role-btn-label">{role}</span>
                      <ChevronDown size={15} className={`invite-role-chevron ${roleOpen ? 'invite-role-chevron--open' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {roleOpen && (
                        <motion.div
                          className="invite-role-dropdown"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.14 }}
                        >
                          {PROJECT_ROLES.map(r => (
                            <button
                              key={r.value}
                              type="button"
                              className={`invite-role-option ${role === r.value ? 'invite-role-option--active' : ''}`}
                              onClick={() => { setRole(r.value); setRoleOpen(false); }}
                            >
                              <span className={`invite-role-dot invite-role-dot--${r.value.toLowerCase()}`} />
                              <span>{r.label}</span>
                              {role === r.value && <CheckCircle size={14} className="invite-role-check" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {error && (
                  <div className="invite-error">
                    <AlertCircle size={14} /><span>{error}</span>
                  </div>
                )}

                <div className="invite-actions">
                  <button type="button" className="invite-btn-ghost" onClick={onClose}>Cancel</button>
                  <button
                    className="invite-btn-primary"
                    disabled={!selectedTeam || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting
                      ? <><LoaderIcon size={14} className="projects-spinner" style={{ display: 'inline-block', marginRight: 6 }} /> Adding…</>
                      : <><Users size={14} /> Add Team</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};


const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);
  const [quitting, setQuitting] = useState(false);
  const { user } = useAuth();

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [proj, mems] = await Promise.all([
        projectsApi.get(id),
        projectsApi.getMembers(id),
      ]);
      setProject(proj);
      setMembers(mems);
    } catch {
      setError('Project not found or could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleArchive = async () => {
    if (!project || archiving) return;
    setArchiving(true);
    try {
      const updated = await projectsApi.archive(project.id);
      setProject(updated);
    } catch {
      alert('Could not archive project.');
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || deleting) return;
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await projectsApi.delete(project.id);
      navigate('/projects');
    } catch {
      alert('Could not delete project.');
      setDeleting(false);
    }
  };

  const handleKick = async (membership: Membership) => {
    if (!project) return;
    if (!confirm(`Remove ${membership.username || membership.email || 'this member'} from the project?`)) return;
    setKicking(membership.userId);
    try {
      await projectsApi.kickMember(project.id, membership.userId);
      setMembers(prev => prev.filter(m => m.userId !== membership.userId));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not remove member.';
      alert(msg);
    } finally {
      setKicking(null);
    }
  };

  const handleQuit = async () => {
    if (!project || quitting) return;
    if (!confirm('Leave this project?')) return;
    setQuitting(true);
    try {
      await projectsApi.quitProject(project.id);
      navigate('/projects');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not leave project.';
      alert(msg);
      setQuitting(false);
    }
  };

  if (loading) return (
    <div className="pd-page">
      <div className="pd-state">
        <div className="projects-spinner" />
        <p>Loading project…</p>
      </div>
    </div>
  );

  if (error || !project) return (
    <div className="pd-page">
      <div className="pd-state pd-state--error">
        <FolderOpen size={48} strokeWidth={1} />
        <p>{error || 'Project not found.'}</p>
        <button className="projects-btn-primary" onClick={() => navigate('/projects')}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    </div>
  );

  const isActive = project.status === 'ACTIVE';
  const isArchived = project.status === 'ARCHIVED';

  return (
    <div className="pd-page">
      <button className="pd-back" onClick={() => navigate('/projects')}>
        <ArrowLeft size={16} strokeWidth={2} />
        <span>All Projects</span>
      </button>

      <motion.div
        className="pd-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="pd-hero-main">
          <div className="pd-hero-icon">
            <FolderOpen size={28} strokeWidth={1.5} />
          </div>

          <div className="pd-hero-info">
            <div className="pd-hero-name-row">
              <h1 className="pd-hero-name">{project.name}</h1>
              <span className={`pd-status-pill ${isActive ? 'pd-status-pill--active' : isArchived ? 'pd-status-pill--archived' : 'pd-status-pill--deleted'}`}>
                {project.status}
              </span>
            </div>
            {project.description
              ? <p className="pd-hero-desc">{project.description}</p>
              : <p className="pd-hero-desc pd-hero-desc--empty">No description provided.</p>
            }
          </div>
        </div>

        <div className="pd-hero-actions">
          {isActive && (
            <button
              className="pd-action-btn pd-action-btn--warning"
              onClick={handleArchive}
              disabled={archiving || project.ownerId !== user?.id}
              title={project.ownerId !== user?.id ? 'Only the project owner can archive' : undefined}
            >
              <Archive size={15} />
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          {project.ownerId === user?.id ? (
            <button
              className="pd-action-btn pd-action-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={15} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : (
            <button
              className="pd-action-btn pd-action-btn--warning"
              onClick={handleQuit}
              disabled={quitting}
            >
              <LogOut size={15} />
              {quitting ? 'Leaving…' : 'Leave Project'}
            </button>
          )}
        </div>
      </motion.div>

      <motion.div
        className="pd-meta-row"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <div className="pd-meta-card">
          <Calendar size={16} className="pd-meta-icon" />
          <div>
            <p className="pd-meta-label">Created</p>
            <p className="pd-meta-value">{fmt(project.createdAt)}</p>
          </div>
        </div>
        <div className="pd-meta-card">
          <Clock size={16} className="pd-meta-icon" />
          <div>
            <p className="pd-meta-label">Last updated</p>
            <p className="pd-meta-value">{fmt(project.updatedAt)}</p>
          </div>
        </div>
        <div className="pd-meta-card">
          <Users size={16} className="pd-meta-icon" />
          <div>
            <p className="pd-meta-label">Members</p>
            <p className="pd-meta-value">{members.length}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pd-section"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.16 }}
      >
        <div className="pd-section-head">
          <h2 className="pd-section-title">
            <Users size={16} />
            Members
          </h2>

          <div className="pd-section-head-actions">
            <button className="pd-section-refresh" onClick={fetchAll} title="Refresh members">
              <RefreshCw size={14} />
            </button>
            {(project.ownerId === user?.id ||
              members.find(m => m.userId === user?.id && (m.role === 'MANAGER' || m.role === 'OWNER'))
            ) && (
              <>
                <button
                  className="pd-invite-btn pd-invite-btn--team"
                  onClick={() => setShowAddTeam(true)}
                  title="Add entire team to project"
                >
                  <Users size={15} />
                  <span>Add Team</span>
                </button>
                <button
                  className="pd-invite-btn"
                  onClick={() => setShowInvite(true)}
                  title="Invite a member"
                >
                  <UserPlus size={15} />
                  <span>Invite</span>
                </button>
              </>
            )}
          </div>
        </div>

        {members.length === 0 ? (
          <div className="pd-empty">
            <Users size={32} strokeWidth={1} style={{ opacity: 0.2 }} />
            <p>No members yet.</p>
            <button className="pd-invite-empty-btn" onClick={() => setShowInvite(true)}>
              <UserPlus size={14} /> Invite your first member
            </button>
          </div>
        ) : (
          <div className="pd-members">
            {members.map((m, i) => (
              <motion.div
                key={m.id}
                className="pd-member"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <div className="pd-member-av">
                  {m.avatar
                    ? <img src={m.avatar} alt={m.username || m.email || 'member'} className="pd-member-av-img" />
                    : (m.username || m.email || m.userId).slice(0, 2).toUpperCase()
                  }
                </div>

                <div className="pd-member-info">
                  <span className="pd-member-id" title={m.email || m.userId}>
                    {m.username || m.email || `${m.userId.slice(0, 8)}…`}
                  </span>
                  <span className="pd-member-joined">
                    {m.email && m.username ? m.email : ''}
                    {(!m.email || !m.username) ? `Joined ${fmtShort(m.joinedAt)}` : ''}
                  </span>
                </div>

                <span className={roleClass(m.role)}>
                  {roleIcon(m.role)}
                  {m.role}
                </span>

                {/* Kick button — owner or manager can remove non-owners */}
                {project.ownerId === user?.id && m.role !== 'OWNER' && (
                  <button
                    className="pd-kick-btn"
                    title="Remove member"
                    disabled={kicking === m.userId}
                    onClick={() => handleKick(m)}
                  >
                    {kicking === m.userId
                      ? <LoaderIcon size={13} className="pd-spin" />
                      : <UserMinus size={13} />}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <p className="pd-id-hint">Project ID: <code>{project.id}</code></p>

      <AnimatePresence>
        {showInvite && (
          <InviteModal
            projectId={project.id}
            projectName={project.name}
            onClose={() => setShowInvite(false)}
            onMemberAdded={fetchAll}
          />
        )}
        {showAddTeam && (
          <AddTeamModal
            projectId={project.id}
            projectName={project.name}
            onClose={() => setShowAddTeam(false)}
            onAdded={fetchAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectDetailPage;
