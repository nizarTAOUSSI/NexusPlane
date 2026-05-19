import React, { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, StickyNote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectsApi, type Project } from '../projectsApi';
import { teamsApi } from '../teamsApi';
import { taskService } from '../services/taskService';
import { TaskStatus, type Task } from '../types/task';
import type { UserInfo } from '../context/AuthContext';
import DashboardGrid from '../components/Dashboard/DashboardGrid';
import type { DashboardWidgetData } from '../components/Dashboard/widgetContents';
import { resetDashboardLayout, addWidget } from '../store/dashboardLayoutSlice';
import { setNote } from '../store/notesSlice';
import { setImage } from '../store/imagesSlice';
import { persistor, type RootState, type AppDispatch } from '../store';


function aggregateByStatus(tasks: Task[]): Record<string, number> {
  const acc: Record<string, number> = {
    [TaskStatus.TODO]: 0,
    [TaskStatus.IN_PROGRESS]: 0,
    [TaskStatus.REVIEW]: 0,
    [TaskStatus.DONE]: 0,
  };
  for (const t of tasks) {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
  }
  return acc;
}

interface DashboardPageContentProps {
  user: UserInfo;
}

const DashboardPageContent: React.FC<DashboardPageContentProps> = ({ user }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const userId = user.id;
  const layout = useSelector((s: RootState) => s.dashboardLayout.layout);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [teamsCount, setTeamsCount] = useState(0);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setProjectsLoading(true);
      setTeamsLoading(true);
      setTasksLoading(true);
    });

    (async () => {
      try {
        const list = await projectsApi.list({ userId });
        if (!cancelled) setProjects(list);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();

    (async () => {
      try {
        const teams = await teamsApi.list(userId);
        if (!cancelled) setTeamsCount(teams.length);
      } catch {
        if (!cancelled) setTeamsCount(0);
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    })();

    (async () => {
      try {
        const list = await taskService.getTasksByAssignee(userId);
        if (!cancelled) setTasks(list);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeProjectCount = useMemo(
    () => projects.filter((p) => p.status === 'ACTIVE').length,
    [projects],
  );

  const recentProjects = useMemo(() => {
    const sorted = [...projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted.slice(0, 6);
  }, [projects]);

  const tasksByStatus = useMemo(() => aggregateByStatus(tasks), [tasks]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== TaskStatus.DONE).length,
    [tasks],
  );

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(
      (t) => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now,
    ).length;
  }, [tasks]);

  const taskSample = useMemo(
    () =>
      tasks.slice(0, 20).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
      })),
    [tasks],
  );

  const aiDataKey = `${activeTasks}-${overdueTasks}-${activeProjectCount}`;

  const widgetData: DashboardWidgetData = useMemo(
    () => ({
      projectCount: projects.length,
      activeProjectCount,
      recentProjects,
      teamCount: teamsCount,
      tasksByStatus,
      tasks,
      projectsLoading,
      teamsLoading,
      tasksLoading,
      activeTasks,
      overdueTasks,
      taskSample,
      aiDataKey,
    }),
    [
      projects.length,
      activeProjectCount,
      recentProjects,
      teamsCount,
      tasksByStatus,
      tasks,
      projectsLoading,
      teamsLoading,
      tasksLoading,
      activeTasks,
      overdueTasks,
      taskSample,
      aiDataKey,
    ],
  );

  const handleResetLayout = useCallback(() => {
    dispatch(resetDashboardLayout());
  }, [dispatch]);

  const getBottomY = useCallback(
    () => layout.reduce((max, item) => Math.max(max, item.y + item.h), 0),
    [layout],
  );

  const genId = useCallback(
    () =>
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const scrollToNewWidget = useCallback(() => {
    setTimeout(() => {
      const main = document.querySelector('.app-main');
      if (main) main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);

  const handleAddNote = useCallback(() => {
    const id = `note-${genId()}`;
    dispatch(addWidget({ i: id, x: 0, y: getBottomY(), w: 4, h: 3, minW: 2, minH: 2 }));
    dispatch(setNote({ id, data: { content: '', color: 'yellow' } }));
    void persistor.flush();
    scrollToNewWidget();
  }, [dispatch, getBottomY, genId, scrollToNewWidget]);

  const handleImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const MAX_SIDE = 1400;
      const src = await new Promise<string>((resolve) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = url;
      });
      const id = `image-${genId()}`;
      dispatch(addWidget({ i: id, x: 0, y: getBottomY(), w: 4, h: 4, minW: 2, minH: 3 }));
      dispatch(setImage({ id, data: { src } }));
      void persistor.flush();
      e.target.value = '';
      scrollToNewWidget();
    },
    [dispatch, getBottomY, genId, scrollToNewWidget],
  );

  return (
    <div className="dash-page dash-page--wide dash-page--orbit">
      <div className="dash-orbit-bg" aria-hidden />

      <div className="dash-header">
        <div>
          <div className="dash-orbit-kicker">
            <span className="dash-orbit-kicker-dot" />
            Dashboard
          </div>
          <h1 className="dash-title dash-title--orbit">
            Hello, {user.username ?? 'Operator'}
          </h1>
          <p className="dash-subtitle dash-subtitle--orbit">
            Drag widgets to reorganize your workspace. Layout is saved automatically.
          </p>
          <div className="dash-header-chips">
            <span className="dash-header-chip">
              <span className="dash-header-chip-dot" style={{ background: '#6366f1' }} />
              {widgetData.projectsLoading
                ? '…'
                : `${widgetData.activeProjectCount} active project${widgetData.activeProjectCount !== 1 ? 's' : ''}`}
            </span>
            <span className="dash-header-chip">
              <span className="dash-header-chip-dot" style={{ background: '#10b981' }} />
              {widgetData.tasksLoading
                ? '…'
                : (() => {
                    const t = Object.values(widgetData.tasksByStatus).reduce((a, b) => a + b, 0);
                    return `${t} task${t !== 1 ? 's' : ''}`;
                  })()}
            </span>
            <span className="dash-header-chip">
              <span className="dash-header-chip-dot" style={{ background: '#f59e0b' }} />
              {widgetData.teamsLoading
                ? '…'
                : `${widgetData.teamCount} team${widgetData.teamCount !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div className="dash-header-actions">
          <button type="button" className="dash-vb-btn" onClick={handleAddNote}>
            <StickyNote size={14} />
            Note
          </button>
          <button type="button" className="dash-vb-btn" onClick={() => imageFileRef.current?.click()}>
            <ImageIcon size={14} />
            Image
          </button>
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            onChange={handleImageFileChange}
          />
          <button type="button" className="dash-reset-btn dash-reset-btn--orbit" onClick={handleResetLayout}>
            Reset layout
          </button>
          <button type="button" className="dash-new-btn dash-new-btn--orbit" onClick={() => navigate('/projects')}>
            + New project
          </button>
        </div>
      </div>

      <DashboardGrid data={widgetData} userId={userId} username={user.username ?? 'Opérateur'} />
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  if (!user?.id) return null;
  return <DashboardPageContent key={user.id} user={user} />;
};

export default DashboardPage;