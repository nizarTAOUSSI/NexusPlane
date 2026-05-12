import React from 'react';
import { AlertCircle, FolderKanban, ListTodo } from 'lucide-react';
import WidgetShell from './WidgetShell';

interface DashboardStatsGridProps {
  activeTasks: number;
  overdueTasks: number;
  activeProjects: number;
  projectCount: number;
  loading?: boolean;
}

interface KpiChipProps {
  label: string;
  subtext: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
}

const KpiChip: React.FC<KpiChipProps> = ({ label, subtext, value, icon, accent, loading }) => (
  <div className="dash-stat-chip">
    <div
      className="dash-stat-chip-icon"
      style={{ color: accent, background: `${accent}12`, borderColor: `${accent}28` }}
    >
      {icon}
    </div>
    <div className="dash-stat-chip-body">
      <span className="dash-stat-chip-value" style={{ color: accent }}>
        {loading ? '—' : value}
      </span>
      <span className="dash-stat-chip-label">{label}</span>
      <span className="dash-stat-chip-sub">{subtext}</span>
    </div>
  </div>
);

const DashboardStatsGrid: React.FC<DashboardStatsGridProps> = ({
  activeTasks,
  overdueTasks,
  activeProjects,
  projectCount,
  loading = false,
}) => (
  <WidgetShell title="Vue d'ensemble" icon={<FolderKanban size={14} />}>
    <div className="dash-widget-accent" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6bb)' }} />
    <div className="dash-stat-chips-row">
      <KpiChip
        label="Tâches actives"
        subtext="assignées & en cours"
        value={activeTasks}
        icon={<ListTodo size={18} />}
        accent="#6366f1"
        loading={loading}
      />
      <div className="dash-stat-chip-divider" />
      <KpiChip
        label="En retard"
        subtext={overdueTasks > 0 ? 'Attention requise' : 'Tout à jour ✓'}
        value={overdueTasks}
        icon={<AlertCircle size={18} />}
        accent={overdueTasks > 0 ? '#ef4444' : '#10b981'}
        loading={loading}
      />
      <div className="dash-stat-chip-divider" />
      <KpiChip
        label="Projets actifs"
        subtext={loading ? '…' : `sur ${projectCount} au total`}
        value={activeProjects}
        icon={<FolderKanban size={18} />}
        accent="#10b981"
        loading={loading}
      />
    </div>
  </WidgetShell>
);

export default DashboardStatsGrid;
