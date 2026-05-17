import React, { useState } from 'react';
import { AlertOctagon, ArrowDown, ArrowUp, Calendar, Loader2, Minus, Pencil, Trash2, User } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { type Task, TaskPriority, type UserMeta } from '../../types/task';


const PRIORITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  [TaskPriority.URGENT]: { label: 'Urgent', icon: <AlertOctagon size={11} />, className: 'tc-priority tc-priority--urgent' },
  [TaskPriority.HIGH]: { label: 'High', icon: <ArrowUp size={11} />, className: 'tc-priority tc-priority--high' },
  [TaskPriority.MEDIUM]: { label: 'Medium', icon: <Minus size={11} />, className: 'tc-priority tc-priority--medium' },
  [TaskPriority.LOW]: { label: 'Low', icon: <ArrowDown size={11} />, className: 'tc-priority tc-priority--low' },
};


const MAX_VISIBLE = 3;

function AvatarStack({ ids, userMap }: { ids: string[]; userMap: Record<string, UserMeta> }) {
  if (!ids?.length) return null;
  const visible = ids.slice(0, MAX_VISIBLE);
  const extra = ids.length - MAX_VISIBLE;
  function initials(m: UserMeta) { return (m.username || m.email || '?').slice(0, 2).toUpperCase(); }

  return (
    <div className="tc-avatar-stack">
      {visible.map((uid, i) => {
        const meta = userMap[uid];
        return (
          <div key={uid} className="tc-av" style={{ zIndex: MAX_VISIBLE - i }} title={meta?.username || meta?.email || uid}>
            {meta?.avatar ? (
              <img src={meta.avatar} alt="" className="tc-av-img" />
            ) : meta ? (
              <span className="tc-av-initials">{initials(meta)}</span>
            ) : (
              <User size={10} />
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <div className="tc-av tc-av--extra" title={`${extra} more`}>+{extra}</div>
      )}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function isOverdue(iso: string) { return new Date(iso) < new Date(); }


interface TaskCardProps {
  task: Task;
  index: number;
  userMap?: Record<string, UserMeta>;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => Promise<void>;
  isViewerRole?: boolean;
}


const TaskCard: React.FC<TaskCardProps> = ({ task, index, userMap = {}, onEdit, onDelete, isViewerRole = false }) => {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.MEDIUM];
  const overdue = task.dueDate && isOverdue(task.dueDate);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete?.(task.id);
    } finally {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={confirmDel || isViewerRole}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`tc-card ${snapshot.isDragging ? 'tc-card--dragging' : ''} ${confirmDel ? 'tc-card--confirming' : ''}`}
        >
          <AnimatePresence>
            {confirmDel && (
              <motion.div
                className="tc-del-confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <p className="tc-del-msg">Delete this task?</p>
                <div className="tc-del-actions">
                  <button
                    className="tc-del-btn tc-del-btn--cancel"
                    onClick={e => { e.stopPropagation(); setConfirmDel(false); }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="tc-del-btn tc-del-btn--confirm"
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 size={12} className="kb-spin" /> : <Trash2 size={12} />}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="tc-card-header">
            <span className={priority.className}>
              {priority.icon}
              {priority.label}
            </span>

            <div className="tc-card-header-right">
              <div className="tc-actions">
                <button
                  className="tc-action-btn tc-action-btn--edit"
                  title="Edit task"
                  onClick={e => { e.stopPropagation(); onEdit?.(task); }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="tc-action-btn tc-action-btn--delete"
                  title="Delete task"
                  onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>

          <p className="tc-card-title">{task.title}</p>

          {task.description && (
            <p className="tc-card-desc">{task.description}</p>
          )}

          {task.dueDate && (
            <div className="tc-card-footer">
              <span className={`tc-due ${overdue ? 'tc-due--overdue' : ''}`}>
                <Calendar size={11} />
                {fmtDate(task.dueDate)}
              </span>
            </div>
          )}
          <div className='flex justify-end'>
            <AvatarStack ids={task.assigneeIds ?? []} userMap={userMap} />
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;
