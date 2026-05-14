import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { aiService } from '../../services/aiService';
import type { DashboardTaskContext } from '../../services/aiService';
import WidgetShell from './WidgetShell';

interface DashboardAISummaryCardProps {
  userId: string;
  username: string;
  activeTasks: number;
  overdueTasks: number;
  activeProjects: number;
  taskSample?: DashboardTaskContext[];
  dataKey?: string;
}

interface SummaryCache {
  summary: string;
  modelLabel: string;
}

const CACHE_KEY_PREFIX = 'nexusplan-dash-ai-summary-';

function readCache(userId: string): SummaryCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as SummaryCache) : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: SummaryCache): void {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — silently skip
  }
}

const DashboardAISummaryCard: React.FC<DashboardAISummaryCardProps> = ({
  userId,
  username,
  activeTasks,
  overdueTasks,
  activeProjects,
  taskSample = [],
}) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>('');

  const fetchSummary = useCallback(async (bypassCache = false) => {
    if (!bypassCache) {
      const cached = readCache(userId);
      if (cached) {
        setSummary(cached.summary);
        setModelLabel(cached.modelLabel);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await aiService.summarizeDashboard(
        {
          username,
          activeTasks,
          overdueTasks,
          activeProjects,
          tasks: taskSample.slice(0, 20),
        },
        userId,
      );
      const raw = res.modelUsed ?? '';
      const short = raw.includes('llama') ? 'Llama 3.3' : raw.includes('gemini') ? 'Gemini' : raw.split('/').pop() ?? 'AI';
      setSummary(res.summary);
      setModelLabel(short);
      writeCache(userId, { summary: res.summary, modelLabel: short });
    } catch {
      setError("Unable to load AI summary. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [userId, username, activeTasks, overdueTasks, activeProjects, taskSample]);

  useEffect(() => {
    fetchSummary(false);
  }, []);

  return (
    <WidgetShell title="AI Summary" icon={<Sparkles size={14} style={{ color: '#8b5cf6' }} />}>
      <div className="dash-widget-accent" style={{ background: 'linear-gradient(90deg, #8b5cf6, #6366f1bb)' }} />

      <div className="dash-ai-body">
        {loading && (
          <div className="dash-ai-skeleton-wrap">
            <div className="dash-ai-skeleton dash-ai-skeleton--lg" />
            <div className="dash-ai-skeleton dash-ai-skeleton--md" />
            <div className="dash-ai-skeleton dash-ai-skeleton--sm" />
          </div>
        )}

        {!loading && error && (
          <p className="dash-ai-error">{error}</p>
        )}

        {!loading && !error && summary && (
          <p className="dash-ai-text">{summary}</p>
        )}

        {!loading && !error && !summary && (
          <p className="dash-widget-muted">No summary available.</p>
        )}
      </div>

      <div className="dash-widget-stat-row dash-ai-footer">
        <span className="dash-widget-stat-label">
          NexusAI&nbsp;·&nbsp;{modelLabel || 'Groq / Gemini'}
        </span>
        <button
          type="button"
          className="dash-ai-refresh-btn"
          onClick={() => fetchSummary(true)}
          disabled={loading}
          title="Regenerate summary"
          aria-label="Regenerate AI summary"
        >
          <RefreshCw size={12} className={loading ? 'dash-ai-spin' : ''} />
          Regenerate
        </button>
      </div>
    </WidgetShell>
  );
};

export default DashboardAISummaryCard;
