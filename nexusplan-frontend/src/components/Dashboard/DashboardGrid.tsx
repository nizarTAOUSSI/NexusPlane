import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { X } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { AppDispatch, RootState } from '../../store';
import {
  reconcileDashboardLayout,
  setDashboardLayout,
  removeWidget,
} from '../../store/dashboardLayoutSlice';
import { deleteNote } from '../../store/notesSlice';
import { deleteImage } from '../../store/imagesSlice';
import type { DashboardWidgetData } from './widgetContents';
import {
  ActivityFeedWidget,
  KpiChatWidget,
  KpiProjectsWidget,
  KpiTasksWidget,
  KpiTeamsWidget,
  QuickLinksWidget,
  RecentProjectsWidget,
  TaskPipelineWidget,
} from './widgetContents';
import DashboardStatsGrid from './DashboardStatsGrid';
import DashboardAISummaryCard from './DashboardAISummaryCard';
import StickyNoteWidget from './StickyNoteWidget';
import ImageWidget from './ImageWidget';

const GridWithWidth = WidthProvider(GridLayout);

function useGridCols() {
  const getConfig = (w: number) => {
    if (w < 640) return { cols: 2, rowHeight: 56, canInteract: false };
    if (w < 1024) return { cols: 6, rowHeight: 64, canInteract: true };
    return { cols: 12, rowHeight: 72, canInteract: true };
  };
  const [config, setConfig] = useState(() => getConfig(window.innerWidth));
  useEffect(() => {
    const handler = () => setConfig(getConfig(window.innerWidth));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return config;
}

interface DashboardGridProps {
  data: DashboardWidgetData;
  userId: string;
  username: string;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({ data, userId, username }) => {
  const dispatch = useDispatch<AppDispatch>();
  const persistedLayout = useSelector((s: RootState) => s.dashboardLayout.layout);
  const hiddenWidgets = useSelector((s: RootState) => s.dashboardLayout.hiddenWidgets);
  const safeLayout = React.useMemo(
    () => reconcileDashboardLayout(persistedLayout as unknown, hiddenWidgets),
    [persistedLayout, hiddenWidgets],
  );
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>(safeLayout);
  const { cols, rowHeight, canInteract } = useGridCols();

  const displayLayout = useMemo(() => {
    if (cols === 12) return gridLayout;
    return gridLayout.map(item => ({
      ...item,
      w: Math.min(cols, Math.max(1, Math.round(item.w * cols / 12))),
      x: Math.min(cols - 1, Math.floor(item.x * cols / 12)),
    }));
  }, [gridLayout, cols]);

  useEffect(() => {
    setGridLayout(safeLayout);
  }, [safeLayout]);

  const persist = useCallback(
    (layout: LayoutItem[]) => {
      dispatch(setDashboardLayout(layout));
    },
    [dispatch],
  );

  const cloneLayout = useCallback((layout: Layout) => {
    const list = Array.isArray(layout) ? [...layout] : [];
    return list.map((x) => ({ ...x }));
  }, []);

  const onLayoutChange = useCallback(
    (layout: Layout) => {
      setGridLayout(cloneLayout(layout));
    },
    [cloneLayout],
  );

  const onDragStop = useCallback(
    (layout: Layout) => {
      const next = cloneLayout(layout);
      setGridLayout(next);
      persist(next);
    },
    [cloneLayout, persist],
  );

  const onResizeStop = useCallback(
    (layout: Layout) => {
      const next = cloneLayout(layout);
      setGridLayout(next);
      persist(next);
    },
    [cloneLayout, persist],
  );

  const handleDelete = useCallback(
    (id: string) => {
      // Update local layout immediately so onLayoutChange can't re-add the widget
      setGridLayout((prev) => prev.filter((item) => item.i !== id));
      dispatch(removeWidget(id));
      if (id.startsWith('note-')) dispatch(deleteNote(id));
      else if (id.startsWith('image-')) dispatch(deleteImage(id));
    },
    [dispatch],
  );

  const renderWidgetContent = (id: string): React.ReactNode => {
    switch (id) {
      case 'stats-grid':
        return (
          <DashboardStatsGrid
            activeTasks={data.tasksLoading ? 0 : (data.activeTasks ?? 0)}
            overdueTasks={data.tasksLoading ? 0 : (data.overdueTasks ?? 0)}
            activeProjects={data.projectsLoading ? 0 : data.activeProjectCount}
            projectCount={data.projectsLoading ? 0 : data.projectCount}
            loading={data.tasksLoading || data.projectsLoading}
          />
        );
      case 'ai-summary':
        return (
          <DashboardAISummaryCard
            userId={userId}
            username={username}
            activeTasks={data.activeTasks ?? 0}
            overdueTasks={data.overdueTasks ?? 0}
            activeProjects={data.activeProjectCount}
            taskSample={data.taskSample}
            dataKey={data.aiDataKey}
          />
        );
      case 'kpi-projects': return <KpiProjectsWidget data={data} />;
      case 'kpi-tasks':    return <KpiTasksWidget data={data} />;
      case 'kpi-teams':    return <KpiTeamsWidget data={data} />;
      case 'kpi-chat':     return <KpiChatWidget />;
      case 'recent-projects': return <RecentProjectsWidget data={data} />;
      case 'task-pipeline':   return <TaskPipelineWidget data={data} />;
      case 'activity-feed':   return <ActivityFeedWidget />;
      case 'quick-links':     return <QuickLinksWidget />;
      default:
        if (id.startsWith('note-'))  return <StickyNoteWidget widgetId={id} />;
        if (id.startsWith('image-')) return <ImageWidget widgetId={id} />;
        return null;
    }
  };

  return (
    <div className="dash-grid-host">
      {!canInteract ? (
        <div className="dash-grid-mobile-stack">
          {gridLayout.map((item) => {
            const content = renderWidgetContent(item.i);
            if (!content) return null;
            return (
              <div key={item.i} className="dash-grid-cell dash-grid-cell--mobile">
                <button
                  type="button"
                  className="dash-cell-delete"
                  onClick={() => handleDelete(item.i)}
                  aria-label="Remove widget"
                  title="Remove"
                >
                  <X size={11} />
                </button>
                <div className="dash-widget-anim">{content}</div>
              </div>
            );
          })}
        </div>
      ) : (
      <GridWithWidth
        className="dash-grid"
        layout={displayLayout as Layout}
        cols={cols}
        rowHeight={rowHeight}
        margin={[14, 14]}
        containerPadding={[0, 0]}
        onLayoutChange={onLayoutChange}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        draggableHandle=".dash-widget-drag"
        isDraggable={canInteract}
        isResizable={canInteract}
        compactType="vertical"
        useCSSTransforms
      >
        {displayLayout.map((item) => {
          const content = renderWidgetContent(item.i);
          if (!content) return <div key={item.i} />;
          return (
            <div key={item.i} className="dash-grid-cell">
              <button
                type="button"
                className="dash-cell-delete"
                onClick={() => handleDelete(item.i)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Supprimer le widget"
                title="Supprimer"
              >
                <X size={11} />
              </button>
              <div className="dash-widget-anim">{content}</div>
            </div>
          );
        })}
      </GridWithWidth>
      )}
    </div>
  );
};

export default DashboardGrid;
