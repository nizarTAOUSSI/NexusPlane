import React, { useEffect, useRef } from 'react';
import { useGlobalSearch } from '../context/GlobalSearchContext';

const kindLabel: Record<string, string> = {
  project: 'Project',
  team: 'Team',
  task: 'Task',
};

const GlobalSearchOverlay: React.FC = () => {
  const { open, setOpen, query, results, loading, navigateToHit, focusSource } = useGlobalSearch();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node;
      if (rootRef.current?.contains(el)) return;
      if ((e.target as HTMLElement)?.closest?.('[data-gs-trigger]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  if (!open || !query.trim()) return null;

  return (
    <div
      ref={rootRef}
      className={`gs-overlay${focusSource === 'sidebar' ? ' gs-overlay--sidebar' : ''}`}
      role="listbox"
      aria-label="Search results"
    >
      <div className="gs-panel">
        {loading && <p className="gs-muted">Searching…</p>}
        {!loading && results.length === 0 && (
          <p className="gs-muted">No matches for &ldquo;{query.trim()}&rdquo;</p>
        )}
        {!loading &&
          results.map(hit => (
            <button
              key={`${hit.kind}-${hit.id}`}
              type="button"
              className="gs-hit"
              onClick={() => navigateToHit(hit)}
            >
              <span className="gs-hit-kind">{kindLabel[hit.kind] ?? hit.kind}</span>
              <span className="gs-hit-title">{hit.title}</span>
              <span className="gs-hit-sub">{hit.subtitle}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default GlobalSearchOverlay;
