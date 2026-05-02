import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, Archive, Trash2,
  Clock, Crown, Eye, Edit3, RefreshCw, FolderOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { projectsApi, type Project, type Membership } from '../projectsApi';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

const roleIcon = (role: Membership['role']) => {
  if (role === 'MANAGER')     return <Crown  size={13} className="pd-role-icon pd-role-icon--manager" />;
  if (role === 'CONTRIBUTOR') return <Edit3  size={13} className="pd-role-icon pd-role-icon--contributor" />;
  return                              <Eye    size={13} className="pd-role-icon pd-role-icon--viewer" />;
};

const roleClass = (role: Membership['role']) => ({
  MANAGER:     'pd-badge pd-badge--manager',
  CONTRIBUTOR: 'pd-badge pd-badge--contributor',
  VIEWER:      'pd-badge pd-badge--viewer',
}[role]);


const ProjectDetailPage: React.FC = () => {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const [project,  setProject]  = useState<Project | null>(null);
  const [members,  setMembers]  = useState<Membership[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [archiving, setArchiving] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

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
      navigate('/dashboard/projects');
    } catch {
      alert('Could not delete project.');
      setDeleting(false);
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
        <button className="projects-btn-primary" onClick={() => navigate('/dashboard/projects')}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    </div>
  );

  const isActive   = project.status === 'ACTIVE';
  const isArchived = project.status === 'ARCHIVED';

  return (
    <div className="pd-page">
      <button className="pd-back" onClick={() => navigate('/dashboard/projects')}>
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
              disabled={archiving}
            >
              <Archive size={15} />
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          <button
            className="pd-action-btn pd-action-btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={15} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
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
          <button className="pd-section-refresh" onClick={fetchAll} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {members.length === 0 ? (
          <div className="pd-empty">
            <Users size={32} strokeWidth={1} style={{ opacity: 0.2 }} />
            <p>No members yet.</p>
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
                  {m.userId.slice(0, 2).toUpperCase()}
                </div>

                <div className="pd-member-info">
                  <span className="pd-member-id" title={m.userId}>
                    {m.userId.slice(0, 8)}…
                  </span>
                  <span className="pd-member-joined">Joined {fmtShort(m.joinedAt)}</span>
                </div>

                <span className={roleClass(m.role)}>
                  {roleIcon(m.role)}
                  {m.role}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <p className="pd-id-hint">Project ID: <code>{project.id}</code></p>
    </div>
  );
};

export default ProjectDetailPage;
