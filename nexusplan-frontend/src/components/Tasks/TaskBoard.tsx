import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, ChevronDown, Eye, FolderOpen,
  GitPullRequest, Loader2, Plus, RefreshCw, Sparkles,
} from 'lucide-react';
import { taskService } from '../../services/taskService';
import { projectsApi, type Project } from '../../projectsApi';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { type CreateTaskPayload, type Task, TaskStatus, type UserMeta } from '../../types/task';
import { useProjectWebSocket, type WSEvent } from '../../hooks/useProjectWebSocket';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';
import EditTaskModal from './EditTaskModal';
import OnlinePresence from './OnlinePresence';
import AIGenerateModal from './AIGenerateModal';
import AISummarizeModal from './AISummarizeModal';
import { FileText } from 'lucide-react';

interface ColumnDef {
  id: TaskStatus;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const COLUMNS: ColumnDef[] = [
  { id: TaskStatus.TODO, label: 'To Do', icon: <Circle size={15} />, accent: '#6366F1' },
  { id: TaskStatus.IN_PROGRESS, label: 'In Progress', icon: <GitPullRequest size={15} />, accent: '#F59E0B' },
  { id: TaskStatus.REVIEW, label: 'Review', icon: <Eye size={15} />, accent: '#8B5CF6' },
  { id: TaskStatus.DONE, label: 'Done', icon: <CheckCircle2 size={15} />, accent: '#10B981' },
];


interface TaskBoardProps {
  userMap?: Record<string, UserMeta>;
}


const TaskBoard: React.FC<TaskBoardProps> = ({ userMap: externalUserMap = {} }) => {
  const { user, token } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projLoading, setProjLoading] = useState(true);
  const [selectOpen, setSelectOpen] = useState(false);

  const [members, setMembers] = useState<UserMeta[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserMeta>>(externalUserMap);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [showAI,     setShowAI]     = useState(false);
  const [showSummarize, setShowSummarize] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const realtime = useRealtime();

  const handleWsEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'task_moved':
        if (event.taskId && event.status) {
          setTasks(prev =>
            prev.map(t => t.id === event.taskId ? { ...t, status: event.status! } : t)
          );
        }
        break;

      case 'task_created': {
        const incoming = event.payload?.task as Task | undefined;
        if (incoming?.id) {
          setTasks(prev => prev.find(t => t.id === incoming.id) ? prev : [incoming, ...prev]);
        }
        break;
      }

      case 'task_updated': {
        const incoming = event.payload?.task as Task | undefined;
        if (incoming?.id) {
          setTasks(prev => prev.map(t => t.id === incoming.id ? incoming : t));
        }
        break;
      }

      case 'task_deleted':
        if (event.taskId) {
          setTasks(prev => prev.filter(t => t.id !== event.taskId));
        }
        break;

      case 'cursor_move':
        if (event.userId && event.payload) {
          const { x, y } = event.payload as { x: number; y: number };
          realtime._updateCursor(event.userId, { x, y, ts: Date.now() });
        }
        break;

      case 'user_disconnected':
        if (event.userId) realtime._removeCursor(event.userId);
        break;
    }
  }, [realtime]);

  const { isConnected, onlineUserIds, send } = useProjectWebSocket({
    projectId,
    token,
    currentUserId: user?.id ?? null,
    onEvent: handleWsEvent,
  });

  useEffect(() => {
    const others = new Set([...onlineUserIds].filter(id => id !== user?.id));
    realtime._publish({ isConnected, onlineUserIds: others });
  }, [isConnected, onlineUserIds, user?.id]);

  useEffect(() => {
    realtime._publish({ userMap });
  }, [userMap]);

  useEffect(() => {
    realtime._registerSend(send);
  }, [send]);

  const lastCursorSend = useRef(0);
  useEffect(() => {
    const THROTTLE_MS = 50;
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorSend.current < THROTTLE_MS) return;
      lastCursorSend.current = now;
      send({
        type: 'cursor_move',
        payload: {
          x: parseFloat(((e.clientX / window.innerWidth) * 100).toFixed(2)),
          y: parseFloat(((e.clientY / window.innerHeight) * 100).toFixed(2)),
        },
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [send]);

  useEffect(() => {
    const fetchProjects = async () => {
      setProjLoading(true);
      try {
        const params = user?.id ? { userId: user.id } : undefined;
        const data = await projectsApi.list(params);
        const active = data.filter(p => p.status === 'ACTIVE');
        setProjects(active);
        if (active.length > 0) setProjectId(active[0].id);
      } catch { }
      finally { setProjLoading(false); }
    };
    fetchProjects();
  }, [user?.id]);

  useEffect(() => {
    if (!projectId) return;
    projectsApi.getMembers(projectId).then(memberships => {
      const meta: UserMeta[] = memberships.map(m => ({
        id: m.userId,
        username: m.username,
        email: m.email,
        avatar: m.avatar,
      }));
      setMembers(meta);
      const map: Record<string, UserMeta> = { ...externalUserMap };
      meta.forEach(m => { map[m.id] = m; });
      setUserMap(map);
      const userRole = memberships.find(m => m.userId === user?.id)?.role || null;
      setCurrentUserRole(userRole);
    }).catch(() => { });
  }, [projectId, user?.id]);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await taskService.getTasksByProject(projectId);
      setTasks(data);
    } catch {
      setError('Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setTasks([]);
    loadTasks();
  }, [loadTasks]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TaskStatus;
    const prevTasks = tasks;

    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));

    try {
      await taskService.updateTaskStatus(draggableId, newStatus);
      send({ type: 'task_moved', taskId: draggableId, status: newStatus });
    } catch {
      setTasks(prevTasks);
    }
  };

  const handleCreate = async (payload: Parameters<typeof taskService.createTask>[0]) => {
    if (!user?.id) return;
    const created = await taskService.createTask(payload, user.id);
    setTasks(prev => [created, ...prev]);
    send({ type: 'task_created', payload: { task: created } });
  };

  const handleEdit = (task: Task) => setEditingTask(task);

  const handleUpdate = async (payload: Parameters<typeof taskService.updateTask>[1]) => {
    if (!editingTask) return;
    const updated = await taskService.updateTask(editingTask.id, payload);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    send({ type: 'task_updated', taskId: updated.id, payload: { task: updated } });
  };

  const handleDelete = async (taskId: string) => {
    await taskService.deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    send({ type: 'task_deleted', taskId });
  };

  const byStatus = (colId: TaskStatus) => tasks.filter(t => t.status === colId);
  const selectedProject = projects.find(p => p.id === projectId);

  if (projLoading) {
    return (
      <div className="kb-loading">
        <Loader2 size={28} className="kb-spin" />
        <span>Loading projects…</span>
      </div>
    );
  }

  if (!projLoading && projects.length === 0) {
    return (
      <div className="kb-loading">
        <FolderOpen size={36} style={{ opacity: 0.3 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 14 }}>
          No active projects found. Create a project first.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="kb-toolbar">
        <div className="kb-proj-select" onClick={() => setSelectOpen(o => !o)}>
          <FolderOpen size={15} className="kb-proj-icon" />
          <span className="kb-proj-name">{selectedProject?.name ?? 'Select project'}</span>
          <ChevronDown
            size={14}
            className={`kb-proj-chevron ${selectOpen ? 'kb-proj-chevron--open' : ''}`}
          />

          <AnimatePresence>
            {selectOpen && (
              <motion.div
                className="kb-proj-dropdown"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                onClick={e => e.stopPropagation()}
              >
                {projects.map(p => (
                  <button
                    key={p.id}
                    className={`kb-proj-option ${p.id === projectId ? 'kb-proj-option--active' : ''}`}
                    onClick={() => { setProjectId(p.id); setSelectOpen(false); }}
                  >
                    <FolderOpen size={13} />
                    {p.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {projectId && (
          <button className="kb-refresh-btn" onClick={loadTasks} title="Refresh">
            <RefreshCw size={14} />
          </button>
        )}

        {projectId && (
          <button
            className="kb-ai-btn"
            onClick={() => setShowAI(true)}
            disabled={currentUserRole === 'VIEWER'}
            title={currentUserRole === 'VIEWER' ? 'Viewers can only view or summarize tasks' : 'Generate tasks with AI'}
          >
            <Sparkles size={14} />
            <span>Generate with AI</span>
          </button>
        )}

        {projectId && (
          <button
            className="kb-summarize-btn"
            onClick={() => setShowSummarize(true)}
            title="Summarize project with AI"
          >
            <FileText size={14} />
            <span>Summarize</span>
          </button>
        )}

        <div className="kb-toolbar-right">
          <OnlinePresence
            isConnected={isConnected}
            onlineUserIds={onlineUserIds}
            userMap={userMap}
            currentUserId={user?.id ?? null}
          />
        </div>
      </div>

      {loading ? (
        <div className="kb-loading" style={{ minHeight: 200 }}>
          <Loader2 size={24} className="kb-spin" />
          <span>Loading tasks…</span>
        </div>
      ) : error ? (
        <div className="kb-error">
          <p>{error}</p>
          <button className="kb-retry" onClick={loadTasks}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="kb-board">
            {COLUMNS.map(col => {
              const colTasks = byStatus(col.id);
              return (
                <motion.div
                  key={col.id}
                  className="kb-column"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: COLUMNS.indexOf(col) * 0.07 }}
                >
                  <div className="kb-col-header">
                    <div className="kb-col-title-row">
                      <span className="kb-col-icon" style={{ color: col.accent }}>{col.icon}</span>
                      <span className="kb-col-label">{col.label}</span>
                      <span className="kb-col-count" style={{ background: col.accent + '22', color: col.accent }}>
                        {colTasks.length}
                      </span>
                    </div>
                    {col.id === TaskStatus.TODO && projectId && (
                      <button
                        className="kb-add-btn"
                        onClick={() => setShowModal(true)}
                        disabled={currentUserRole === 'VIEWER'}
                        title={currentUserRole === 'VIEWER' ? 'Viewers can only view or summarize tasks' : 'Add task'}
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>

                  <div className="kb-col-bar" style={{ background: col.accent }} />

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`kb-cards ${snapshot.isDraggingOver ? 'kb-cards--over' : ''}`}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="kb-empty"><span>No tasks</span></div>
                        )}
                        {colTasks.map((task, idx) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            index={idx}
                            userMap={userMap}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            isViewerRole={currentUserRole === 'VIEWER'}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </motion.div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {showModal && projectId && (
        <CreateTaskModal
          projectId={projectId}
          members={members}
          onClose={() => setShowModal(false)}
          onCreated={handleCreate}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          members={members}
          onClose={() => setEditingTask(null)}
          onUpdated={handleUpdate}
        />
      )}

      <AnimatePresence>
        {showAI && projectId && user?.id && (
          <AIGenerateModal
            projectId={projectId}
            projectName={selectedProject?.name}
            userId={user.id}
            onClose={() => setShowAI(false)}
            onImport={async (aiTasks: CreateTaskPayload[]) => {
              const createdTasks = await Promise.all(
                aiTasks.map(payload => taskService.createTask(payload, user.id)),
              );
              createdTasks.forEach(created => {
                send({ type: 'task_created', payload: { task: created } });
              });
              await loadTasks();
            }}
          />
        )}

        {showSummarize && projectId && user?.id && (
          <AISummarizeModal
            projectId={projectId}
            projectName={selectedProject?.name}
            tasks={tasks}
            userId={user.id}
            onClose={() => setShowSummarize(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default TaskBoard;
