import React from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  ListTodo,
  Users,
  MessageCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { Project } from '../../projectsApi';
import { TaskStatus } from '../../types/task';
import type { Task } from '../../types/task';
import WidgetShell from './WidgetShell';

export interface DashboardWidgetData {
  projectCount: number;
  activeProjectCount: number;
  recentProjects: Project[];
  teamCount: number;
  tasksByStatus: Record<string, number>;
  tasks?: Task[];
  projectsLoading: boolean;
  teamsLoading: boolean;
  tasksLoading: boolean;
  // Computed fields used by the stats-grid and ai-summary widgets
  activeTasks?: number;
  overdueTasks?: number;
  taskSample?: { title: string; status: string; priority: string; dueDate: string | null }[];
  aiDataKey?: string;
}

/* ── Colored top-edge accent strip ── */
const accent = (hex: string) => (
  <div className="dash-widget-accent" style={{ background: `linear-gradient(90deg, ${hex}, ${hex}bb)` }} />
);

/* ── Stat row at the bottom of KPI cards ── */
const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="dash-widget-stat-row">
    <span className="dash-widget-stat-label">{label}</span>
    <span className="dash-widget-stat-val">{value}</span>
  </div>
);

/* ── Thin circular arc progress ring ── */
const MiniArc: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
  const size = 52;
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct / 100)) * circ;
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.75s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
};

/* ── Project color palette ── */
const PROJ_PALETTE = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#06B6D4'];
function projColor(id: string | number): string {
  const s = String(id);
  let h = 5381;
  for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return PROJ_PALETTE[h % PROJ_PALETTE.length];
}

/* ══════════════════════════════════════
   KPI Widgets
══════════════════════════════════════ */

export const KpiProjectsWidget: React.FC<{ data: DashboardWidgetData }> = ({ data }) => {
  const pct = data.projectsLoading ? 0 : Math.round((data.activeProjectCount / Math.max(data.projectCount, 1)) * 100);
  return (
    <WidgetShell title="Projects" icon={<FolderKanban size={14} />}>
      {accent('#6366f1')}
      <div className="dash-kpi-main">
        <div>
          <p className="dash-widget-kpi-label">Active projects</p>
          <p className="dash-widget-kpi-value">
            {data.projectsLoading ? '—' : data.activeProjectCount}
          </p>
        </div>
        {!data.projectsLoading && <MiniArc pct={pct} color="#6366f1" />}
      </div>
      <StatRow label="Total" value={data.projectsLoading ? '—' : data.projectCount} />
    </WidgetShell>
  );
};

export const KpiTasksWidget: React.FC<{ data: DashboardWidgetData }> = ({ data }) => {
  const done = data.tasksByStatus[TaskStatus.DONE] ?? 0;
  const total = Object.values(data.tasksByStatus).reduce((a, b) => a + b, 0);
  const pct = data.tasksLoading ? 0 : Math.round((done / Math.max(total, 1)) * 100);
  return (
    <WidgetShell title="Tasks" icon={<ListTodo size={14} />}>
      {accent('#10b981')}
      <div className="dash-kpi-main">
        <div>
          <p className="dash-widget-kpi-label">Completed</p>
          <p className="dash-widget-kpi-value" style={{ color: '#059669' }}>
            {data.tasksLoading ? '—' : done}
          </p>
        </div>
        {!data.tasksLoading && <MiniArc pct={pct} color="#10b981" />}
      </div>
      <StatRow label="Assigned" value={data.tasksLoading ? '—' : total} />
    </WidgetShell>
  );
};

export const KpiTeamsWidget: React.FC<{ data: DashboardWidgetData }> = ({ data }) => (
  <WidgetShell title="Teams" icon={<Users size={14} />}>
    {accent('#f59e0b')}
    <div className="dash-kpi-main">
      <div>
        <p className="dash-widget-kpi-label">My teams</p>
        <p className="dash-widget-kpi-value" style={{ color: '#d97706' }}>
          {data.teamsLoading ? '—' : data.teamCount}
        </p>
      </div>
      {!data.teamsLoading && (
        <MiniArc pct={data.teamCount > 0 ? Math.min(100, data.teamCount * 20) : 0} color="#f59e0b" />
      )}
    </div>
    <StatRow label="Type" value="Collaborative" />
  </WidgetShell>
);

export const KpiChatWidget: React.FC = () => (
  <WidgetShell title="Messages" icon={<MessageCircle size={14} />}>
    {accent('#3b82f6')}
    <div className="dash-kpi-main">
      <div>
        <p className="dash-widget-kpi-label">Active rooms</p>
        <p className="dash-widget-kpi-value" style={{ color: '#2563eb' }}>—</p>
      </div>
      <MiniArc pct={0} color="#3b82f6" />
    </div>
    <StatRow label="Status" value={<span style={{ color: '#f59e0b', fontWeight: 700 }}>Coming soon</span>} />
  </WidgetShell>
);

/* ══════════════════════════════════════
   Recent Projects
══════════════════════════════════════ */

export const RecentProjectsWidget: React.FC<{ data: DashboardWidgetData }> = ({ data }) => (
  <WidgetShell title="Recent projects" icon={<FolderKanban size={14} />}>
    {accent('#6366f1')}
    {data.projectsLoading && <p className="dash-widget-muted">Loading…</p>}
    {!data.projectsLoading && data.recentProjects.length === 0 && (
      <div className="dash-widget-empty">
        <FolderKanban size={28} className="dash-empty-icon" />
        <p>No projects found</p>
        <Link to="/projects" className="dash-widget-link">
          Create a project <ArrowRight size={12} />
        </Link>
      </div>
    )}
    {!data.projectsLoading && data.recentProjects.length > 0 && (
      <ul className="dash-widget-list">
        {data.recentProjects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="dash-widget-list-row">
              <span
                className="dash-proj-init"
                style={{ background: projColor(p.id) }}
                aria-hidden
              >
                {(p.name || '?')[0].toUpperCase()}
              </span>
              <span className="dash-widget-list-name">{p.name}</span>
              <span className="dash-widget-list-meta">
                {p.status === 'ACTIVE' ? 'Active' : p.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </WidgetShell>
);

/* ══════════════════════════════════════
   Task Pipeline
══════════════════════════════════════ */

const STATUS_ORDER = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE];
const STATUS_LABEL: Record<string, string> = {
  [TaskStatus.TODO]:        'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.REVIEW]:      'Review',
  [TaskStatus.DONE]:        'Done',
};
const STATUS_COLOR: Record<string, string> = {
  [TaskStatus.TODO]:        '#9898b8',
  [TaskStatus.IN_PROGRESS]: '#6366f1',
  [TaskStatus.REVIEW]:      '#a855f7',
  [TaskStatus.DONE]:        '#10b981',
};

export const TaskPipelineWidget: React.FC<{ data: DashboardWidgetData }> = ({ data }) => (
  <WidgetShell title="Task pipeline" icon={<TrendingUp size={14} />}>
    {accent('#a855f7')}
    {data.tasksLoading && <p className="dash-widget-muted">Loading…</p>}
    {!data.tasksLoading && (
      <div className="dash-widget-bars">
        {STATUS_ORDER.map((st) => {
          const n = data.tasksByStatus[st] ?? 0;
          const max = Math.max(1, ...STATUS_ORDER.map((s) => data.tasksByStatus[s] ?? 0));
          const pct = Math.round((n / max) * 100);
          const c = STATUS_COLOR[st];
          return (
            <div key={st} className="dash-widget-bar-row">
              <span className="dash-widget-bar-label" style={{ color: c }}>{STATUS_LABEL[st]}</span>
              <div className="dash-widget-bar-track">
                <div
                  className="dash-widget-bar-fill"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}88, ${c})` }}
                />
              </div>
              <span className="dash-widget-bar-count" style={{ color: c }}>{n}</span>
            </div>
          );
        })}
      </div>
    )}
  </WidgetShell>
);

/* ══════════════════════════════════════
   Activity Feed
══════════════════════════════════════ */

const ACTIVITY_EVENTS = [
  { t: 'Team invitation received',  d: 'Pending acceptance',              time: '2 min ago',  color: '#6366f1' },
  { t: 'Project update',            d: 'Real-time sync active',           time: '8 min ago',  color: '#10b981' },
  { t: 'New task assigned',         d: 'WebSocket connection established', time: '15 min ago', color: '#f59e0b' },
];

export const ActivityFeedWidget: React.FC = () => (
  <WidgetShell title="Recent activity" icon={<TrendingUp size={14} />}>
    {accent('#6366f1')}
    <ul className="dash-widget-activity">
      {ACTIVITY_EVENTS.map((row, i) => (
        <li
          key={i}
          className="dash-widget-activity-row"
          style={{ '--dot-color': row.color } as React.CSSProperties}
        >
          <span className="dash-widget-activity-title">{row.t}</span>
          <span className="dash-widget-activity-desc">{row.d}</span>
          <span className="dash-widget-activity-time">{row.time}</span>
        </li>
      ))}
    </ul>
  </WidgetShell>
);

/* ══════════════════════════════════════
   Quick Links
══════════════════════════════════════ */

const QUICK_LINKS = [
  { to: '/projects', label: 'Projects', icon: <FolderKanban size={13} /> },
  { to: '/tasks',    label: 'Tasks',    icon: <ListTodo size={13} /> },
  { to: '/teams',    label: 'Teams',    icon: <Users size={13} /> },
  { to: '/chat',     label: 'Chat',     icon: <MessageCircle size={13} /> },
];

export const QuickLinksWidget: React.FC = () => (
  <WidgetShell title="Quick links" icon={<Sparkles size={14} />}>
    {accent('#f59e0b')}
    <div className="dash-widget-links">
      {QUICK_LINKS.map(({ to, label, icon }) => (
        <Link key={to} to={to} className="dash-widget-pill">
          {icon}
          {label}
        </Link>
      ))}
    </div>
  </WidgetShell>
);


