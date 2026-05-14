import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { projectsApi, type Project } from '../projectsApi';
import { teamsApi, type Team } from '../teamsApi';
import { taskService } from '../services/taskService';
import type { Task } from '../types/task';

export type SearchHitKind = 'project' | 'team' | 'task';

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

interface GlobalSearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  results: SearchHit[];
  loading: boolean;
  focusSource: 'toolbar' | 'sidebar' | null;
  setFocusSource: (s: 'toolbar' | 'sidebar' | null) => void;
  toolbarInputRef: React.RefObject<HTMLInputElement | null>;
  sidebarInputRef: React.RefObject<HTMLInputElement | null>;
  navigateToHit: (hit: SearchHit) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

function buildHits(q: string, projects: Project[], teams: Team[], tasks: Task[]): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const hits: SearchHit[] = [];

  for (const p of projects) {
    const hay = `${p.name} ${p.description ?? ''}`.toLowerCase();
    if (hay.includes(needle)) {
      hits.push({
        kind: 'project',
        id: p.id,
        title: p.name,
        subtitle: p.description?.slice(0, 80) || 'Project',
        path: `/projects/${p.id}`,
      });
    }
  }

  for (const t of teams) {
    const hay = `${t.name} ${t.description ?? ''}`.toLowerCase();
    if (hay.includes(needle)) {
      hits.push({
        kind: 'team',
        id: t.id,
        title: t.name,
        subtitle: t.description?.slice(0, 80) || 'Team',
        path: '/teams',
      });
    }
  }

  for (const task of tasks) {
    const hay = `${task.title} ${task.description ?? ''}`.toLowerCase();
    if (hay.includes(needle)) {
      hits.push({
        kind: 'task',
        id: task.id,
        title: task.title,
        subtitle: `Task · project ${task.projectId.slice(0, 8)}…`,
        path: `/projects/${task.projectId}`,
      });
    }
  }

  const kindOrder: Record<SearchHitKind, number> = { project: 0, team: 1, task: 2 };
  hits.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title));
  return hits.slice(0, 24);
}

export const GlobalSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth() as { user?: { id: string } };
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focusSource, setFocusSource] = useState<'toolbar' | 'sidebar' | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const toolbarInputRef = useRef<HTMLInputElement>(null);
  const sidebarInputRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<{
    userId: string | null;
    projects: Project[];
    teams: Team[];
    tasks: Task[];
  }>({ userId: null, projects: [], teams: [], tasks: [] });

  const navigateToHit = useCallback(
    (hit: SearchHit) => {
      navigate(hit.path);
      setOpen(false);
      setQuery('');
      setResults([]);
    },
    [navigate],
  );

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setLoading(false);
        return;
      }
      const uid = user?.id;
      if (!uid) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (catalogRef.current.userId !== uid) {
          const [pList, tList, taskList] = await Promise.all([
            projectsApi.list({ userId: uid }).catch(() => [] as Project[]),
            teamsApi.list(uid).catch(() => [] as Team[]),
            taskService.getTasksByAssignee(uid).catch(() => [] as Task[]),
          ]);
          catalogRef.current = {
            userId: uid,
            projects: pList,
            teams: tList,
            tasks: taskList,
          };
        }
        const { projects, teams, tasks } = catalogRef.current;
        setResults(buildHits(trimmed, projects, teams, tasks));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = window.setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setOpen(true);
        setFocusSource('toolbar');
        window.setTimeout(() => toolbarInputRef.current?.focus(), 0);
      }
      if (e.key === 's' || e.key === 'S') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setOpen(true);
        setFocusSource('sidebar');
        window.setTimeout(() => sidebarInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      open,
      setOpen,
      results,
      loading,
      focusSource,
      setFocusSource,
      toolbarInputRef,
      sidebarInputRef,
      navigateToHit,
    }),
    [query, open, results, loading, focusSource, navigateToHit],
  );

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
};

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  return ctx;
}
