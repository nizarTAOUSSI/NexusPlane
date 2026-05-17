import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Users, Send, Crown, UserPlus,
  CheckCircle, AlertCircle, Mail, Loader2, Shield,
  Trash2, LogOut, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { teamsApi, type Team, type TeamMember } from '../teamsApi';
import { useAuth } from '../context/AuthContext';


const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function initials(s: string) { return (s || '??').slice(0, 2).toUpperCase(); }

const PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#10B981',
  '#F59E0B', '#3B82F6', '#EF4444', '#06B6D4',
];
function teamColor(id?: string | null) {
  if (!id || typeof id !== 'string') return PALETTE[0];
  let h = 5381;
  for (const c of id) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}


const CreateModal: React.FC<{ userId: string; onClose: () => void; onCreate: (t: Team) => void }> = ({
  userId, onClose, onCreate,
}) => {
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
    } finally { setLoading(false); }
  };

  return (
    <motion.div className="projects-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="projects-modal" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ duration: 0.22 }} onClick={e => e.stopPropagation()}>
        <h2 className="projects-modal-title">New Team</h2>
        <p className="projects-modal-sub">Create a reusable group of collaborators.</p>
        <form onSubmit={handleSubmit} className="projects-modal-form">
          <div className="projects-field">
            <label className="projects-label">Team name *</label>
            <input className="projects-input" type="text" placeholder="e.g. UI/UX Design Team" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="projects-field">
            <label className="projects-label">Description</label>
            <textarea className="projects-input projects-textarea" placeholder="What does this team work on?" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          </div>
          {error && <p className="projects-error">{error}</p>}
          <div className="projects-modal-actions">
            <button type="button" className="projects-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="projects-btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Team'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};


const InviteModal: React.FC<{ team: Team; onClose: () => void; onInvited: () => void }> = ({
  team, onClose, onInvited,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<'added' | 'sent' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true); setError('');
    try {
      const res = await teamsApi.invite(team.id, { email: trimmed, role }) as Record<string, unknown>;
      if ((res as { id?: string })?.id) {
        setDone('added'); setMessage(`${trimmed} added to "${team.name}".`); onInvited();
      } else {
        setDone('sent'); setMessage(`Invite sent to ${trimmed}.`);
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div className="projects-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="projects-modal" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ duration: 0.22 }} onClick={e => e.stopPropagation()}>
        <h2 className="projects-modal-title">Invite Member</h2>
        <p className="projects-modal-sub">Add someone to <strong>{team.name}</strong></p>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" className="teams-invite-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`teams-result-icon ${done === 'sent' ? 'teams-result-icon--sent' : ''}`}>
                {done === 'sent' ? <Mail size={26} /> : <CheckCircle size={26} />}
              </div>
              <p className="teams-result-title">{done === 'sent' ? 'Invite Sent!' : 'Member Added!'}</p>
              <p className="teams-result-msg">{message}</p>
              <div className="projects-modal-actions" style={{ justifyContent: 'center', marginTop: 8 }}>
                {done === 'added' && <button className="projects-btn-ghost" onClick={() => { setEmail(''); setDone(null); }}>Invite Another</button>}
                <button className="projects-btn-primary" onClick={onClose}>Done</button>
              </div>
            </motion.div>
          ) : (
            <motion.form key="form" className="projects-modal-form" onSubmit={handleSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="projects-field">
                <label className="projects-label">Email address</label>
                <input type="email" className="projects-input" placeholder="colleague@company.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoFocus required />
              </div>
              <div className="projects-field">
                <label className="projects-label">Role</label>
                <div className="teams-role-row">
                  {(['MEMBER', 'ADMIN'] as const).map(r => (
                    <button key={r} type="button" className={`teams-role-chip ${role === r ? 'teams-role-chip--active' : ''}`} onClick={() => setRole(r)}>
                      {r === 'ADMIN' ? <Crown size={12} /> : <Users size={12} />}{r}
                    </button>
                  ))}
                </div>
              </div>
              {error && <div className="teams-error-row"><AlertCircle size={13} /><span>{error}</span></div>}
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


const roleBadgeClass: Record<string, string> = {
  OWNER: 'tm-tbl-badge--owner',
  ADMIN: 'tm-tbl-badge--admin',
  MEMBER: 'tm-tbl-badge--member',
};

const MemberTable: React.FC<{
  members: TeamMember[];
  canKick: (m: TeamMember) => boolean;
  kicking: string | null;
  onKick: (m: TeamMember) => void;
}> = ({ members, canKick, kicking, onKick }) => {
  const hasKickCol = members.some(canKick);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<'name' | 'role' | 'joinedAt'>('joinedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const visible = [...members]
    .filter(m => {
      const q = search.toLowerCase();
      return !q || (m.username || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av = '', bv = '';
      if (sortCol === 'name') { av = a.username || a.email || ''; bv = b.username || b.email || ''; }
      else if (sortCol === 'role') { av = a.role; bv = b.role; }
      else { av = a.joinedAt; bv = b.joinedAt; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const SortIcon = ({ col }: { col: typeof sortCol }) => (
    <ChevronsUpDown size={13} style={{ opacity: sortCol === col ? 1 : 0.3 }} />
  );

  return (
    <div className="tm-tbl-wrap">
      {/* Table search bar */}
      <div className="tm-tbl-bar">
        <div className="projects-search" style={{ maxWidth: 280 }}>
          <Search size={13} className="projects-search-icon" />
          <input className="projects-search-input" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="tm-tbl-count">{visible.length} member{visible.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="tm-tbl-scroll">
        <table className="tm-tbl">
          <thead>
            <tr>
              <th className="tm-tbl-th tm-tbl-th--name" onClick={() => toggleSort('name')}>
                Full Name <SortIcon col="name" />
              </th>
              <th className="tm-tbl-th" onClick={() => toggleSort('role')}>
                Role <SortIcon col="role" />
              </th>
              <th className="tm-tbl-th" onClick={() => toggleSort('joinedAt')}>
                Join Date <SortIcon col="joinedAt" />
              </th>
              <th className="tm-tbl-th">Email</th>
              {hasKickCol && <th className="tm-tbl-th" />}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={hasKickCol ? 5 : 4} className="tm-tbl-empty">
                  <Users size={28} strokeWidth={1} style={{ opacity: 0.2 }} />
                  <p>{search ? 'No members match your search.' : 'No members yet.'}</p>
                </td>
              </tr>
            ) : visible.map((m, i) => {
              const label = m.username || m.email || m.userId.slice(0, 8);
              const color = teamColor(m.userId);
              return (
                <motion.tr
                  key={m.id}
                  className="tm-tbl-row"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {/* Name + avatar */}
                  <td className="tm-tbl-td tm-tbl-td--name">
                    <div className="tm-tbl-user">
                      <div className="tm-tbl-av" style={{ background: color }}>
                        {m.avatar ? <img src={m.avatar} alt="" /> : initials(label)}
                      </div>
                      <div className="tm-tbl-user-info">
                        <span className="tm-tbl-user-name">{m.username || m.userId.slice(0, 8)}</span>
                        {m.email && <span className="tm-tbl-user-handle">@{m.email.split('@')[0]}</span>}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="tm-tbl-td">
                    <span className={`tm-tbl-badge ${roleBadgeClass[m.role] ?? ''}`}>
                      {m.role === 'OWNER' && <Shield size={10} />}
                      {m.role === 'ADMIN' && <Crown size={10} />}
                      {m.role}
                    </span>
                  </td>

                  {/* Join date */}
                  <td className="tm-tbl-td tm-tbl-td--date">{fmtDate(m.joinedAt)}</td>

                  {/* Email */}
                  <td className="tm-tbl-td tm-tbl-td--email">{m.email || '—'}</td>

                  {/* Kick */}
                  {hasKickCol && (
                    <td className="tm-tbl-td tm-tbl-td--action">
                      {canKick(m) && (
                        <button
                          className="tm-tbl-kick"
                          title="Remove member"
                          disabled={kicking === m.userId}
                          onClick={() => onKick(m)}
                        >
                          {kicking === m.userId
                            ? <Loader2 size={14} className="teams-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      )}
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [teamDropOpen, setTeamDropOpen] = useState(false);

  const isOwner = !!activeTeam && !!currentUserId && activeTeam.ownerId === currentUserId;
  const isAdmin = !isOwner && members.some(m => m.userId === currentUserId && m.role === 'ADMIN');
  const canKick = (m: TeamMember) => {
    if (m.role === 'OWNER') return false;
    if (isOwner) return true;
    if (isAdmin && m.role === 'MEMBER') return true;
    return false;
  };

  const fetchTeams = async () => {
    if (!currentUserId) return;
    setLoadingTeams(true);
    try {
      const data = await teamsApi.list(currentUserId);
      setTeams(data);
      if (data.length > 0 && !activeTeam) setActiveTeam(data[0]);
    } catch {}
    finally { setLoadingTeams(false); }
  };

  const fetchMembers = async (team: Team) => {
    setLoadingMembers(true);
    try { setMembers(await teamsApi.getMembers(team.id)); }
    catch { setMembers([]); }
    finally { setLoadingMembers(false); }
  };

  useEffect(() => { fetchTeams(); }, [currentUserId]);
  useEffect(() => { if (activeTeam) fetchMembers(activeTeam); }, [activeTeam?.id]);

  const handleCreated = async (t: Team) => {
    setShowCreate(false);
    const ownedTeam: Team = { ...t, ownerId: currentUserId };
    setTeams(prev => [ownedTeam, ...prev]);
    setActiveTeam(ownedTeam);

    try {
      const data = await teamsApi.list(currentUserId);
      setTeams(data);
      const fresh = data.find(x => x.id === t.id);
      if (fresh) setActiveTeam(fresh);
    } catch {}
  };

  const handleDelete = async () => {
    if (!activeTeam || !confirm(`Delete "${activeTeam.name}"? This cannot be undone.`)) return;
    try {
      await teamsApi.delete(activeTeam.id);
      const remaining = teams.filter(t => t.id !== activeTeam.id);
      setTeams(remaining);
      setActiveTeam(remaining[0] ?? null);
      setMembers([]);
    } catch { alert('Could not delete team.'); }
  };

  const handleQuit = async () => {
    if (!activeTeam || !confirm(`Leave "${activeTeam.name}"?`)) return;
    try {
      await teamsApi.quit(activeTeam.id);
      const remaining = teams.filter(t => t.id !== activeTeam.id);
      setTeams(remaining);
      setActiveTeam(remaining[0] ?? null);
      setMembers([]);
    } catch { alert('Could not leave team.'); }
  };

  const handleKick = async (m: TeamMember) => {
    if (!activeTeam) return;
    const name = m.username || m.email || m.userId.slice(0, 8);
    if (!confirm(`Remove ${name} from the team?`)) return;
    setKicking(m.userId);
    try {
      await teamsApi.kick(activeTeam.id, m.userId);
      setMembers(prev => prev.filter(x => x.userId !== m.userId));
      setActiveTeam(t => t ? { ...t, memberCount: t.memberCount - 1 } : t);
      setTeams(prev => prev.map(t => t.id === activeTeam.id ? { ...t, memberCount: t.memberCount - 1 } : t));
    } catch { alert('Could not remove member.'); }
    finally { setKicking(null); }
  };

  const color = activeTeam ? teamColor(activeTeam.id) : '#6366F1';


  if (loadingTeams) return (
    <div className="projects-page">
      <div className="projects-state"><div className="projects-spinner" /><p>Loading teams…</p></div>
    </div>
  );

  return (
    <div className="projects-page">

      <div className="projects-header">
        <div>
          <h1 className="projects-title">My Teams</h1>
          <p className="projects-subtitle">
            {activeTeam
              ? <><span style={{ color, fontWeight: 700 }}>{activeTeam.name}</span> · {activeTeam.memberCount} member{activeTeam.memberCount !== 1 ? 's' : ''}</>
              : `${teams.length} team${teams.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        <div className="tm-header-actions">
          {teams.length > 0 && (
            <div className="tm-team-switcher" style={{ position: 'relative' }}>
              <button
                className="projects-btn-ghost tm-switcher-btn"
                onClick={() => setTeamDropOpen(o => !o)}
              >
                <div className="tm-switcher-dot" style={{ background: color }} />
                <span>{activeTeam?.name ?? 'Select team'}</span>
                <ChevronDown size={14} style={{ marginLeft: 4, opacity: 0.6 }} />
              </button>
              <AnimatePresence>
                {teamDropOpen && (
                  <motion.div
                    className="tm-switcher-drop"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.14 }}
                  >
                    {teams.map(t => (
                      <button
                        key={t.id}
                        className={`tm-switcher-opt ${activeTeam?.id === t.id ? 'tm-switcher-opt--active' : ''}`}
                        onClick={() => { setActiveTeam(t); setTeamDropOpen(false); }}
                      >
                        <div className="tm-switcher-dot" style={{ background: teamColor(t.id) }} />
                        <span>{t.name}</span>
                        {t.ownerId === currentUserId && <Shield size={11} style={{ marginLeft: 'auto', color: '#818CF8', opacity: 0.7 }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {activeTeam && (isOwner || isAdmin) && (
            <button className="projects-btn-primary" onClick={() => setShowInvite(true)}>
              <UserPlus size={15} /> Invite Member
            </button>
          )}
          {activeTeam && isOwner && (
            <button className="projects-btn-ghost tm-danger-btn" onClick={handleDelete} title="Delete team">
              <Trash2 size={14} />
            </button>
          )}
          {activeTeam && !isOwner && (
            <button className="projects-btn-ghost tm-warn-btn" onClick={handleQuit} title="Leave team">
              <LogOut size={14} />
            </button>
          )}

          <button className="projects-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} strokeWidth={2.5} /> New Team
          </button>
        </div>
      </div>

      {!activeTeam ? (
        <div className="projects-state">
          <Users size={48} strokeWidth={1} style={{ opacity: 0.25 }} />
          <p style={{ color: 'var(--text-3)' }}>No teams yet. Create your first one!</p>
          <button className="projects-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Team
          </button>
        </div>
      ) : loadingMembers ? (
        <div className="projects-state"><div className="projects-spinner" /><p>Loading members…</p></div>
      ) : (
        <MemberTable
          members={members}
          canKick={canKick}
          kicking={kicking}
          onKick={handleKick}
        />
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateModal userId={currentUserId} onClose={() => setShowCreate(false)} onCreate={handleCreated} />
        )}
        {showInvite && activeTeam && (
          <InviteModal
            team={activeTeam}
            onClose={() => setShowInvite(false)}
            onInvited={() => { fetchMembers(activeTeam); fetchTeams(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamsPage;