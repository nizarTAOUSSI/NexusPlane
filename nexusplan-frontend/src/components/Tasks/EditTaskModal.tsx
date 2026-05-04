import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon, ArrowDown, ArrowUp, Calendar,
  Check, Loader2, Minus, User, X,
} from 'lucide-react';
import { type Task, TaskPriority, type CreateTaskPayload, type UserMeta } from '../../types/task';


const PRIORITIES: { value: TaskPriority; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: TaskPriority.LOW,    label: 'Low',    icon: <ArrowDown size={13} />,    cls: 'ctm-dot ctm-dot--low'    },
  { value: TaskPriority.MEDIUM, label: 'Medium', icon: <Minus size={13} />,        cls: 'ctm-dot ctm-dot--medium' },
  { value: TaskPriority.HIGH,   label: 'High',   icon: <ArrowUp size={13} />,      cls: 'ctm-dot ctm-dot--high'   },
  { value: TaskPriority.URGENT, label: 'Urgent', icon: <AlertOctagon size={13} />, cls: 'ctm-dot ctm-dot--urgent' },
];

function avatarInitials(m: UserMeta) {
  return (m.username || m.email || '?').slice(0, 2).toUpperCase();
}


interface EditTaskModalProps {
  task:      Task;
  members?:  UserMeta[];
  onClose:   () => void;
  onUpdated: (payload: Partial<CreateTaskPayload>) => Promise<void>;
}


const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task, members = [], onClose, onUpdated,
}) => {
  const [title,       setTitle]       = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority,    setPriority]    = useState<TaskPriority>(task.priority);
  const [dueDate,     setDueDate]     = useState(
    task.dueDate ? task.dueDate.split('T')[0] : ''
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds ?? []);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      titleRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onUpdated({
        title:       title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeIds,
        dueDate: dueDate || null,
      });
      onClose();
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="ctm-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="ctm-panel"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        >
          <div className="ctm-header">
            <h2 className="ctm-title">Edit Task</h2>
            <button className="ctm-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="ctm-form">
            <div className="ctm-field">
              <label className="ctm-label" htmlFor="etm-title">Title *</label>
              <input
                id="etm-title" ref={titleRef} className="ctm-input"
                value={title} onChange={e => setTitle(e.target.value)} autoFocus
              />
            </div>

            <div className="ctm-field">
              <label className="ctm-label" htmlFor="etm-desc">Description</label>
              <textarea
                id="etm-desc" className="ctm-textarea" rows={3}
                value={description} onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="ctm-row">
              <div className="ctm-field ctm-field--half">
                <label className="ctm-label">Priority</label>
                <div className="ctm-priority-group">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value} type="button"
                      className={`ctm-priority-btn ${priority === p.value ? 'ctm-priority-btn--active' : ''} ${p.cls}`}
                      onClick={() => setPriority(p.value)}
                    >
                      {p.icon}<span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ctm-field ctm-field--half">
                <label className="ctm-label" htmlFor="etm-due">
                  <Calendar size={13} style={{ display: 'inline', marginRight: 4 }} />
                  Due date
                </label>
                <input
                  id="etm-due" type="date" className="ctm-input"
                  value={dueDate} onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {members.length > 0 && (
              <div className="ctm-field">
                <label className="ctm-label">
                  <User size={13} style={{ display: 'inline', marginRight: 4 }} />
                  Assign to
                  {assigneeIds.length > 0 && (
                    <span className="ctm-assignee-count">{assigneeIds.length} selected</span>
                  )}
                </label>
                <div className="ctm-members-list">
                  {members.map(m => {
                    const selected = assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id} type="button"
                        className={`ctm-member-btn ${selected ? 'ctm-member-btn--selected' : ''}`}
                        onClick={() => toggleAssignee(m.id)}
                      >
                        <div className="ctm-member-av">
                          {m.avatar
                            ? <img src={m.avatar} alt="" className="ctm-member-av-img" />
                            : <span className="ctm-member-av-init">{avatarInitials(m)}</span>
                          }
                        </div>
                        <span className="ctm-member-name">{m.username || m.email || m.id}</span>
                        {selected && <Check size={14} className="ctm-member-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <p className="ctm-error">{error}</p>}

            <div className="ctm-actions">
              <button type="button" className="ctm-btn ctm-btn--cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ctm-btn ctm-btn--submit" disabled={loading}>
                {loading && <Loader2 size={15} className="ctm-spin" />}
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditTaskModal;
