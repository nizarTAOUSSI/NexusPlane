import React, { useEffect, useState } from 'react';
import {
  Plus, Search, LayoutGrid, List, RefreshCw, Users,
  X, Send, Crown, UserPlus, CheckCircle, AlertCircle,
  Mail, Loader2, Shield, UserMinus, LogOut, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { teamsApi, type Team, type TeamMember } from '../teamsApi';
import { useAuth } from '../context/AuthContext';


const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function initials(s: string) { return s.slice(0, 2).toUpperCase(); }

const PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#10B981',
  '#F59E0B', '#3B82F6', '#EF4444', '#06B6D4',
];
function teamColor(id: string) {
  let h = 5381;
  for (const c of id) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}


interface CreateModalProps {
  userId: string;
  onClose: () => void;
  onCreate: (t: Team) => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ userId, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Team name is required.'); return; }
    setLoading(true);
    try {
      const t = await teamsApi.create({ name: name.trim(), description: desc.trim() }, userId);
      onCreate(t);
    } catch {
      setError('Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="projects-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="projects-modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="projects-modal-title">New Team</h2>
        <p className="projects-modal-sub">Create a reusable group of collaborators.</p>

        <form onSubmit={handleSubmit} className="projects-modal-form">
          <div className="projects-field">
            <label className="projects-label">Team name *</label>
            <input
              className="projects-input"
              type="text"
              placeholder="e.g. UI/UX Design Team"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="projects-field">
            <label className="projects-label">Description</label>
            <textarea
              className="projects-input projects-textarea"
              placeholder="What does this team work on?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="projects-error">{error}</p>}
          <div className="projects-modal-actions">
            <button type="button" className="projects-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="projects-btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};


interface InviteModalProps {
  team: Team;
  onClose: () => void;
  onInvited: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ team, onClose, onInvited }) => {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState<'added' | 'sent' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true); setError('');
    try {
      const res = await teamsApi.invite(team.id, { email: trimmed, role }) as Record<string, unknown>;
      if ((res as { id?: string })?.id) {
        setDone('added');
        setMessage(`${trimmed} has been added to "${team.name}".`);
        onInvited();
      } else {
        setDone('sent');
        setMessage(`No account found. A registration invite was sent to ${trimmed}.`);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="projects-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="projects-modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="projects-modal-title">Invite to Team</h2>
        <p className="projects-modal-sub">Add a member to <strong>{team.name}</strong></p>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" className="teams-invite-result"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`teams-result-icon ${done === 'sent' ? 'teams-result-icon--sent' : ''}`}>
                {done === 'sent' ? <Mail size={26} /> : <CheckCircle size={26} />}
              </div>
              <p className="teams-result-title">{done === 'sent' ? 'Invite Sent!' : 'Member Added!'}</p>
              <p className="teams-result-msg">{message}</p>
              <div className="projects-modal-actions" style={{ justifyContent: 'center' }}>
                {done === 'added' && (
                  <button className="projects-btn-ghost" onClick={() => { setEmail(''); setDone(null); }}>
                    Invite Another
                  </button>
                )}
                <button className="projects-btn-primary" onClick={onClose}>Done</button>
              </div>
            </motion.div>
          ) : (
            <motion.form key="form" className="projects-modal-form" onSubmit={handleSubmit}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="projects-field">
                <label className="projects-label">Email address</label>
                <input
                  type="email"
                  className="projects-input"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
              <div className="projects-field">
                <label className="projects-label">Role</label>
                <div className="teams-role-row">
                  {(['MEMBER', 'ADMIN'] as const).map(r => (
                    <button key={r} type="button"
                      className={`teams-role-chip ${role === r ? 'teams-role-chip--active' : ''}`}
                      onClick={() => setRole(r)}>
                      {r === 'ADMIN' ? <Crown size={12} /> : <Users size={12} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div className="teams-error-row">
                  <AlertCircle size={13} /><span>{error}</span>
                </div>
              )}
              <div className="projects-modal-actions">
                <button type="button" className="projects-btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="projects-btn-primary" disabled={loading || !email.trim()}>
                  {loading ? <><Loader2 size={13} className="teams-spin" /> Sending…</> : <><Send size={13} /> Send Invite</>}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};


interface TeamCardProps {
  team: Team;
  isOwner: boolean;
  onClick: () => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, isOwner, onClick }) => {
  const color = teamColor(team.id);
  return (
    <motion.button
      className="teams-card"
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <div className="teams-card-top" style={{ background: `${color}18`, borderBottom: `1px solid ${color}28` }}>
        <div className="teams-card-av" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          {initials(team.name)}
        </div>
        {isOwner && (
          <span className="teams-card-owner-badge">
            <Shield size={10} /> Owner
          </span>
        )}
      </div>
      <div className="teams-card-body">
        <p className="teams-card-name">{team.name}</p>
        {team.description && <p className="teams-card-desc">{team.description}</p>}
        <div className="teams-card-meta">
          <span><Users size={11} /> {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
          <span>{fmtDate(team.createdAt)}</span>
        </div>
      </div>
      <div className="teams-card-arrow"><ChevronRight size={14} /></div>
    </motion.button>
  );
};


interface DrawerProps {
  team: Team;
  currentUserId: string;
  onClose: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onQuit: (id: string) => void;
}

const TeamDrawer: React.FC<DrawerProps> = ({
  team, currentUserId, onClose, onRefresh, onDelete, onQuit,
}) => {
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [kicking, setKicking]   = useState<string | null>(null);
  const isOwner = team.ownerId === currentUserId;
  const color = teamColor(team.id);

  const fetchMembers = async () => {
    setLoading(true);
    try { setMembers(await teamsApi.getMembers(team.id)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, [team.id]);

  const handleKick = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    setKicking(userId);
    try {
      await teamsApi.kick(team.id, userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
      onRefresh();
    } catch { /* ignore */ }
    finally { setKicking(null); }
  };

  return (
    <>
      <motion.div
        className="teams-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="teams-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      >
        <div className="teams-drawer-head" style={{ borderBottom: `2px solid ${color}40` }}>
          <div className="teams-drawer-av" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
            {initials(team.name)}
          </div>
          <div className="teams-drawer-title-wrap">
            <h2 className="teams-drawer-name">{team.name}</h2>
            {team.description && <p className="teams-drawer-desc">{team.description}</p>}
          </div>
          <button className="teams-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="teams-drawer-meta">
          <span className="projects-status-badge projects-status-badge--active">
            <Users size={11} /> {team.memberCount} members
          </span>
          <span className="teams-drawer-date">Since {fmtDate(team.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="teams-drawer-actions">
          {isOwner && (
            <button className="projects-btn-primary teams-drawer-invite" onClick={() => setShowInvite(true)}>
              <UserPlus size={14} /> Invite Member
            </button>
          )}
          {isOwner ? (
            <button className="projects-btn-ghost teams-drawer-danger" onClick={() => onDelete(team.id)}>
              <X size={14} /> Delete Team
            </button>
          ) : (
            <button className="projects-btn-ghost teams-drawer-warn" onClick={() => onQuit(team.id)}>
              <LogOut size={14} /> Leave Team
            </button>
          )}
        </div>

        <div className="teams-drawer-section">
          <p className="teams-drawer-section-title">Members</p>
          {loading ? (
            <div className="teams-drawer-loading">
              <Loader2 size={20} className="teams-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="teams-drawer-empty">
              <Users size={32} strokeWidth={1} style={{ opacity: 0.2 }} />
              <p>No members yet</p>
            </div>
          ) : (
            <div className="teams-drawer-members">
              {members.map(m => {
                const label = m.username || m.email || m.userId.slice(0, 8);
                return (
                  <div key={m.id} className="teams-drawer-member">
                    <div className="teams-drawer-member-av" style={{ background: teamColor(m.userId) }}>
                      {m.avatar
                        ? <img src={m.avatar} alt="" />
                        : initials(label)
                      }
                    </div>
                    <div className="teams-drawer-member-info">
                      <span className="teams-drawer-member-name">{label}</span>
                      {m.email && m.username && (
                        <span className="teams-drawer-member-email">{m.email}</span>
                      )}
                    </div>
                    <span className={`teams-member-badge teams-member-badge--${m.role.toLowerCase()}`}>
                      {m.role === 'OWNER' && <Shield size={10} />}
                      {m.role === 'ADMIN' && <Crown size={10} />}
                      {m.role}
                    </span>
                    {isOwner && m.role !== 'OWNER' && (
                      <button
                        className="teams-drawer-kick"
                        title="Remove"
                        disabled={kicking === m.userId}
                        onClick={() => handleKick(m.userId, label)}
                      >
                        {kicking === m.userId
                          ? <Loader2 size={12} className="teams-spin" />
                          : <UserMinus size={12} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showInvite && (
            <InviteModal
              team={team}
              onClose={() => setShowInvite(false)}
              onInvited={() => { fetchMembers(); onRefresh(); setShowInvite(false); }}
            />
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
};


const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams]       = useState<Team[]>([]);
  const [filtered, setFiltered] = useState<Team[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [view, setView]         = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Team | null>(null);

  const fetchTeams = async () => {
    if (!user?.id) return;
    setLoading(true); setError('');
    try {
      const data = await teamsApi.list(user.id);
      setTeams(data);
      setFiltered(data);
    } catch {
      setError('Could not load teams. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, [user?.id]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q
      ? teams.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        )
      : teams
    );
  }, [search, teams]);

  const handleCreated = (t: Team) => {
    setTeams(prev => [t, ...prev]);
    setShowCreate(false);
    setSelected(t);
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Delete this team? This cannot be undone.')) return;
    try {
      await teamsApi.delete(teamId);
      const remaining = teams.filter(t => t.id !== teamId);
      setTeams(remaining);
      setSelected(null);
    } catch { alert('Could not delete team.'); }
  };

  const handleQuit = async (teamId: string) => {
    if (!confirm('Leave this team?')) return;
    try {
      await teamsApi.quit(teamId);
      setTeams(prev => prev.filter(t => t.id !== teamId));
      setSelected(null);
    } catch { alert('Could not leave team.'); }
  };

  const renderContent = () => {
    if (loading) return (
      <div className="projects-state">
        <div className="projects-spinner" />
        <p>Loading teams…</p>
      </div>
    );

    if (error) return (
      <div className="projects-state projects-state--error">
        <Users size={40} strokeWidth={1.2} />
        <p>{error}</p>
        <button className="projects-btn-primary" onClick={fetchTeams}>
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );

    if (filtered.length === 0) return (
      <div className="projects-state">
        <Users size={48} strokeWidth={1} style={{ opacity: 0.25 }} />
        <p style={{ color: 'var(--text-3)' }}>
          {search ? 'No teams match your search.' : 'No teams yet. Create your first one!'}
        </p>
        {!search && (
          <button className="projects-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Team
          </button>
        )}
      </div>
    );

    if (view === 'grid') return (
      <motion.div
        className="flex justify-start items-start gap-6 flex-wrap p-2"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      >
        {filtered.map(t => (
          <motion.div
            key={t.id}
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          >
            <TeamCard
              team={t}
              isOwner={t.ownerId === user?.id}
              onClick={() => setSelected(t)}
            />
          </motion.div>
        ))}
      </motion.div>
    );

    return (
      <div className="projects-list">
        {filtered.map((t, i) => (
          <motion.button
            key={t.id}
            className="projects-list-row"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(t)}
          >
            <div className="projects-list-icon" style={{ color: teamColor(t.id) }}>
              <Users size={18} strokeWidth={1.8} />
            </div>
            <div className="projects-list-info">
              <span className="projects-list-name">{t.name}</span>
              {t.description && <span className="projects-list-desc">{t.description}</span>}
            </div>
            <span className="projects-status-badge projects-status-badge--active">
              <Users size={10} /> {t.memberCount}
            </span>
            <span className="projects-list-date">{fmtDate(t.createdAt)}</span>
          </motion.button>
        ))}
      </div>
    );
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div>
          <h1 className="projects-title">My Teams</h1>
          <p className="projects-subtitle">
            {teams.length} team{teams.length !== 1 ? 's' : ''} · click a team to manage members
          </p>
        </div>
        <button className="projects-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} strokeWidth={2.5} />
          New Team
        </button>
      </div>

      <div className="projects-toolbar">
        <div className="projects-search">
          <Search size={14} className="projects-search-icon" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search teams…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="projects-search-input"
          />
        </div>
        <div className="projects-view-toggle">
          <button
            className={`projects-view-btn ${view === 'grid' ? 'projects-view-btn--active' : ''}`}
            onClick={() => setView('grid')} title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`projects-view-btn ${view === 'list' ? 'projects-view-btn--active' : ''}`}
            onClick={() => setView('list')} title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {renderContent()}

      <AnimatePresence>
        {showCreate && (
          <CreateModal
            userId={user?.id ?? ''}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreated}
          />
        )}
        {selected && (
          <TeamDrawer
            key={selected.id}
            team={selected}
            currentUserId={user?.id ?? ''}
            onClose={() => setSelected(null)}
            onRefresh={fetchTeams}
            onDelete={id => { handleDelete(id); }}
            onQuit={id => { handleQuit(id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamsPage;
