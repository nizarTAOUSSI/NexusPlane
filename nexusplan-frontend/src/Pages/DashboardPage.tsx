import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, TrendingUp, FolderKanban } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const stats = [
    { label: 'Projets actifs',     value: '12',    delta: '+2 ce mois',  color: '#6366f1' },
    { label: 'Tâches complétées',  value: '84',    delta: '+18%',        color: '#10b981' },
    { label: 'Membres d\'équipe',  value: '7',     delta: 'Stable',      color: '#f59e0b' },
    { label: 'Revenus estimés',    value: '€24k',  delta: '+5.2%',       color: '#3b82f6' },
  ];

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            Bonjour, {user?.username ?? 'Utilisateur'} 👋
          </h1>
          <p className="dash-subtitle">Voici un aperçu de votre espace de travail.</p>
        </div>
        <button className="dash-new-btn">
          <span>+ Nouveau projet</span>
        </button>
      </div>

      <div className="dash-stats">
        {stats.map((s, i) => (
          <div key={i} className="dash-card">
            <div className="dash-card-accent" style={{ background: s.color }} />
            <p className="dash-card-label">{s.label}</p>
            <p className="dash-card-value">{s.value}</p>
            <p className="dash-card-delta">{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="dash-content-row">
        <div className="dash-panel dash-panel--wide">
          <div className="dash-panel-head">
            <FolderKanban size={18} />
            <span>Projets récents</span>
          </div>
          <div className="dash-empty">
            <LayoutDashboard size={32} className="dash-empty-icon" />
            <p>Aucun projet pour l'instant.</p>
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-head">
            <TrendingUp size={18} />
            <span>Activité</span>
          </div>
          <div className="dash-empty">
            <TrendingUp size={32} className="dash-empty-icon" />
            <p>Aucune activité récente.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
