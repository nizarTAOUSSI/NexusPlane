import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';
import { useAuth } from '../context/AuthContext';

const STALE_MS      = 4_000; 
const SWEEP_MS      = 1_000; 

const PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
];

function cursorColor(userId: string): string {
  let h = 5381;
  for (const c of userId) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}



function CursorSVG({ color }: { color: string }) {
  return (
    <svg
      width="18" height="24"
      viewBox="0 0 18 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="cursor-svg"
    >
      <path
        d="M1 1L1 19.5L5.5 14.5L8.5 22L10.5 21L7.5 13.5H14L1 1Z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}



const CursorOverlay: React.FC = () => {
  const { cursors, userMap } = useRealtime();
  const { user }             = useAuth();
  const location             = useLocation();
  const [, setTick]          = useState(0);
  const [selfPos, setSelfPos] = useState<{ x: number; y: number } | null>(null);

  const isTasksPage = location.pathname === '/tasks';

  useEffect(() => {
    if (isTasksPage) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [isTasksPage]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), SWEEP_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setSelfPos({
        x: parseFloat(((e.clientX / window.innerWidth)  * 100).toFixed(2)),
        y: parseFloat(((e.clientY / window.innerHeight) * 100).toFixed(2)),
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!isTasksPage) return null;

  const now    = Date.now();
  const active = [...cursors.entries()].filter(
    ([uid, pos]) => uid !== user?.id && now - pos.ts < STALE_MS
  );

  if (active.length === 0 && !selfPos) return null;

  const selfColor = user?.id ? cursorColor(user.id) : PALETTE[0];
  const selfName  ='You';

  return (
    <div className="cursor-overlay" aria-hidden>

      {selfPos && user && (
        <div
          className="cursor-entity"
          style={{ left: `${selfPos.x}%`, top: `${selfPos.y}%` }}
        >
          <CursorSVG color={selfColor} />
          <span className="cursor-label" style={{ background: selfColor }}>
            {selfName} 
          </span>
        </div>
      )}

      {active.map(([uid, pos]) => {
        const meta  = userMap[uid];
        const color = cursorColor(uid);
        const name  = meta?.username || meta?.email?.split('@')[0] || uid.slice(0, 6);
        const age   = now - pos.ts;
        const opacity = age > STALE_MS * 0.6 ? Math.max(0, 1 - (age - STALE_MS * 0.6) / (STALE_MS * 0.4)) : 1;

        return (
          <div
            key={uid}
            className="cursor-entity"
            style={{
              left:    `${pos.x}%`,
              top:     `${pos.y}%`,
              opacity,
            }}
          >
            <CursorSVG color={color} />
            <span
              className="cursor-label"
              style={{ background: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default CursorOverlay;