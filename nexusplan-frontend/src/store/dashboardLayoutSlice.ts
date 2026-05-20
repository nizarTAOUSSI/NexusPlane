import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Layout, LayoutItem } from 'react-grid-layout';

export const DASHBOARD_WIDGET_IDS = [
  'stats-grid',
  'ai-summary',
  'kpi-projects',
  'kpi-tasks',
  'kpi-teams',
  'kpi-chat',
  'recent-projects',
  'task-pipeline',
  'activity-feed',
  'quick-links',
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DEFAULT_DASHBOARD_LAYOUT: LayoutItem[] = [
  { i: 'stats-grid',      x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'ai-summary',      x: 0, y: 2, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'kpi-projects',    x: 0, y: 4, w: 3,  h: 2, minW: 2, minH: 2 },
  { i: 'kpi-tasks',       x: 3, y: 4, w: 3,  h: 2, minW: 2, minH: 2 },
  { i: 'kpi-teams',       x: 6, y: 4, w: 3,  h: 2, minW: 2, minH: 2 },
  { i: 'kpi-chat',        x: 9, y: 4, w: 3,  h: 2, minW: 2, minH: 2 },
  { i: 'recent-projects', x: 0, y: 6, w: 7,  h: 4, minW: 4, minH: 3 },
  { i: 'task-pipeline',   x: 7, y: 6, w: 5,  h: 4, minW: 3, minH: 3 },
  { i: 'activity-feed',   x: 0, y: 10, w: 5, h: 3, minW: 3, minH: 2 },
  { i: 'quick-links',     x: 5, y: 10, w: 7, h: 3, minW: 3, minH: 2 },
];

const defaultById = new Map(DEFAULT_DASHBOARD_LAYOUT.map((item) => [item.i, item]));

function isLayoutItemShape(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function pickNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}


export function coerceToLayoutItems(raw: unknown): LayoutItem[] {
  if (raw == null) return [];

  if (typeof raw === 'string') {
    try {
      return coerceToLayoutItems(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    const out: LayoutItem[] = [];
    for (const cell of raw) {
      if (!isLayoutItemShape(cell)) continue;
      const id = cell.i;
      if (typeof id !== 'string' || !id.trim()) continue;
      out.push({
        i: id,
        x: pickNum(cell.x, 0),
        y: pickNum(cell.y, 0),
        w: pickNum(cell.w, 1),
        h: pickNum(cell.h, 1),
        minW: cell.minW != null ? pickNum(cell.minW, 1) : undefined,
        minH: cell.minH != null ? pickNum(cell.minH, 1) : undefined,
        maxW: cell.maxW != null ? pickNum(cell.maxW, 1) : undefined,
        maxH: cell.maxH != null ? pickNum(cell.maxH, 1) : undefined,
        static: typeof cell.static === 'boolean' ? cell.static : undefined,
        isDraggable: typeof cell.isDraggable === 'boolean' ? cell.isDraggable : undefined,
        isResizable: typeof cell.isResizable === 'boolean' ? cell.isResizable : undefined,
      });
    }
    return out;
  }

  if (typeof raw === 'object') {
    return coerceToLayoutItems(Object.values(raw as Record<string, unknown>));
  }

  return [];
}

export function isDynamicId(id: string): boolean {
  return id.startsWith('note-') || id.startsWith('image-');
}


export function reconcileDashboardLayout(saved: unknown, hidden?: unknown): LayoutItem[] {
  const hiddenSet = new Set(Array.isArray(hidden) ? hidden : []);
  const parsed = coerceToLayoutItems(saved);
  if (!parsed.length) return DEFAULT_DASHBOARD_LAYOUT.filter((x) => !hiddenSet.has(x.i)).map((x) => ({ ...x }));

  const used = new Set<string>();
  const merged: LayoutItem[] = [];
  for (const item of parsed) {
    if (isDynamicId(item.i)) {
      merged.push({ ...item });
      continue;
    }
    if (hiddenSet.has(item.i)) continue;
    const def = defaultById.get(item.i);
    if (!def) continue;
    used.add(item.i);
    merged.push({
      ...def,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: def.minW,
      minH: def.minH,
      maxW: def.maxW,
      maxH: def.maxH,
    });
  }
  for (const def of DEFAULT_DASHBOARD_LAYOUT) {
    if (!used.has(def.i) && !hiddenSet.has(def.i)) merged.push({ ...def });
  }
  return merged;
}

export interface DashboardLayoutState {
  layout: LayoutItem[];
  hiddenWidgets: string[];
}

const initialState: DashboardLayoutState = {
  layout: DEFAULT_DASHBOARD_LAYOUT.map((x) => ({ ...x })),
  hiddenWidgets: [],
};

const dashboardLayoutSlice = createSlice({
  name: 'dashboardLayout',
  initialState,
  reducers: {
    setDashboardLayout(state, action: PayloadAction<Layout | LayoutItem[] | unknown>) {
      state.layout = reconcileDashboardLayout(action.payload, state.hiddenWidgets);
    },
    resetDashboardLayout(state) {
      const currentLayout = coerceToLayoutItems(state.layout);
      state.hiddenWidgets = [];
      const dynamic = currentLayout.filter((item) => isDynamicId(item.i));
      state.layout = [...DEFAULT_DASHBOARD_LAYOUT.map((x) => ({ ...x })), ...dynamic];
    },
    addWidget(state, action: PayloadAction<LayoutItem>) {
      const currentLayout = coerceToLayoutItems(state.layout);
      state.layout = [...currentLayout, action.payload];
    },
    removeWidget(state, action: PayloadAction<string>) {
      const currentLayout = coerceToLayoutItems(state.layout);
      state.layout = currentLayout.filter((item) => item.i !== action.payload);
      if (!isDynamicId(action.payload)) {
        const hidden = Array.isArray(state.hiddenWidgets) ? state.hiddenWidgets : [];
        if (!hidden.includes(action.payload)) {
          state.hiddenWidgets = [...hidden, action.payload];
        }
      }
    },
  },
});

export const { setDashboardLayout, resetDashboardLayout, addWidget, removeWidget } = dashboardLayoutSlice.actions;
export default dashboardLayoutSlice.reducer;
