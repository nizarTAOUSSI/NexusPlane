import React, { useEffect, useState } from 'react';
import { Plus, FolderOpen, Search, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Folder from '../components/Folder';
import { projectsApi, type Project } from '../projectsApi';
import { useAuth } from '../context/AuthContext';


interface CreateModalProps {
  userId: string;
  onClose: () => void;
  onCreate: (p: Project) => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ userId, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (!userId)       { setError('User session expired. Please log in again.'); return; }
    setLoading(true);
    try {
      const p = await projectsApi.create(
        { name: name.trim(), description: desc.trim() },
        userId,
      );
      onCreate(p);
    } catch {
      setError('Failed to create project. Please try again.');
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
        <h2 className="projects-modal-title">New Project</h2>
        <p className="projects-modal-sub">Start a new project workspace.</p>

        <form onSubmit={handleSubmit} className="projects-modal-form">
          <div className="projects-field">
            <label className="projects-label">Project name *</label>
            <input
              className="projects-input"
              type="text"
              placeholder="e.g. Mobile App Redesign"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="projects-field">
            <label className="projects-label">Description</label>
            <textarea
              className="projects-input projects-textarea"
              placeholder="What is this project about?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="projects-error">{error}</p>}
          <div className="projects-modal-actions">
            <button type="button" className="projects-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="projects-btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [view, setView]       = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await projectsApi.list(
        user?.id ? { ownerId: user.id } : undefined
      );
      setProjects(data);
      setFiltered(data);
    } catch {
      setError('Could not load projects. Check your connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? projects.filter(p =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      ) : projects
    );
  }, [search, projects]);

  const handleCreated = (p: Project) => {
    setProjects(prev => [p, ...prev]);
    setShowModal(false);
  };

  const renderContent = () => {
    if (loading) return (
      <div className="projects-state">
        <div className="projects-spinner" />
        <p>Loading projects…</p>
      </div>
    );

    if (error) return (
      <div className="projects-state projects-state--error">
        <FolderOpen size={40} strokeWidth={1.2} />
        <p>{error}</p>
        <button className="projects-btn-primary" onClick={fetchProjects}>
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );

    if (filtered.length === 0) return (
      <div className="projects-state">
        <FolderOpen size={48} strokeWidth={1} style={{ opacity: 0.25 }} />
        <p style={{ color: 'var(--text-3)' }}>
          {search ? 'No projects match your search.' : 'No projects yet. Create your first one!'}
        </p>
        {!search && (
          <button className="projects-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Project
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
        {filtered.map((p) => (
          <motion.div
            key={p.id}
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          >
            <Folder
              title={p.name}
              link={`/projects/${p.id}`}
              subtitle={p.description || undefined}
              status={p.status}
            />
          </motion.div>
        ))}
      </motion.div>
    );

    return (
      <div className="projects-list">
        {filtered.map((p, i) => (
          <motion.a
            key={p.id}
            href={`/projects/${p.id}`}
            className="projects-list-row"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={e => {
              e.preventDefault();
              window.location.href = `/projects/${p.id}`;
            }}
          >
            <div className="projects-list-icon" style={{ color: 'var(--amber)' }}>
              <FolderOpen size={18} strokeWidth={1.8} style={{ color: 'var(--amber)' }} />
            </div>
            <div className="projects-list-info">
              <span className="projects-list-name">{p.name}</span>
              {p.description && <span className="projects-list-desc">{p.description}</span>}
            </div>
            <span className={`projects-status-badge ${p.status === 'ACTIVE' ? 'projects-status-badge--active' : 'projects-status-badge--archived'}`}>
              {p.status}
            </span>
            <span className="projects-list-date">
              {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </motion.a>
        ))}
      </div>
    );
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div>
          <h1 className="projects-title">My Projects</h1>
          <p className="projects-subtitle">
            {projects.length} project{projects.length !== 1 ? 's' : ''} · click a folder to open
          </p>
        </div>
        <button className="projects-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} strokeWidth={2.5} />
          New Project
        </button>
      </div>

      <div className="projects-toolbar">
        <div className="projects-search">
          <Search size={14} className="projects-search-icon" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="projects-search-input"
          />
        </div>

        <div className="projects-view-toggle">
          <button
            className={`projects-view-btn ${view === 'grid' ? 'projects-view-btn--active' : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`projects-view-btn ${view === 'list' ? 'projects-view-btn--active' : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {renderContent()}

      <AnimatePresence>
        {showModal && (
          <CreateModal
            userId={user?.id ?? ''}
            onClose={() => setShowModal(false)}
            onCreate={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectsPage;
