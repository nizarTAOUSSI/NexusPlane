import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, Pencil } from 'lucide-react';
import { persistor, type AppDispatch, type RootState } from '../../store';
import { setNote, type NoteColor } from '../../store/notesSlice';
import WidgetShell from './WidgetShell';

interface ColorMeta {
  value: NoteColor;
  bg: string;
  ink: string;
  ring: string;
}

const NOTE_COLORS: ColorMeta[] = [
  { value: 'yellow',   bg: '#fef9c3', ink: '#78350f', ring: '#fbbf24' },
  { value: 'pink',     bg: '#fce7f3', ink: '#831843', ring: '#f472b6' },
  { value: 'mint',     bg: '#d1fae5', ink: '#064e3b', ring: '#34d399' },
  { value: 'blue',     bg: '#dbeafe', ink: '#1e3a8a', ring: '#60a5fa' },
  { value: 'lavender', bg: '#ede9fe', ink: '#3b0764', ring: '#a78bfa' },
  { value: 'peach',    bg: '#ffedd5', ink: '#7c2d12', ring: '#fb923c' },
];

interface StickyNoteWidgetProps {
  widgetId: string;
}

const StickyNoteWidget: React.FC<StickyNoteWidgetProps> = ({ widgetId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const noteData = useSelector((s: RootState) => s.notes.notes[widgetId]);

  const content = noteData?.content ?? '';
  const color: NoteColor = noteData?.color ?? 'yellow';
  const colorMeta = NOTE_COLORS.find((c) => c.value === color) ?? NOTE_COLORS[0];

  const [editing, setEditing] = useState(!content);
  const [draft, setDraft] = useState(content);
  const [draftColor, setDraftColor] = useState<NoteColor>(color);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  const confirm = () => {
    dispatch(setNote({ id: widgetId, data: { content: draft, color: draftColor } }));
    void persistor.flush();
    setEditing(false);
  };

  const startEdit = () => {
    setDraft(content);
    setDraftColor(color);
    setEditing(true);
  };

  const draftMeta = NOTE_COLORS.find((c) => c.value === draftColor) ?? NOTE_COLORS[0];

  return (
    <WidgetShell title="Note" icon={<Pencil size={14} />}>
      {editing ? (
        <div className="dash-sticky-edit">
          {/* Color palette */}
          <div className="dash-sticky-palette">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`dash-sticky-dot${draftColor === c.value ? ' active' : ''}`}
                style={{ background: c.bg, boxShadow: draftColor === c.value ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.ring}` : undefined }}
                onClick={() => setDraftColor(c.value)}
                aria-label={c.value}
                title={c.value}
              />
            ))}
            <span className="dash-widget-muted" style={{ fontSize: 10.5, marginLeft: 'auto' }}>
              Ctrl+↩ to confirm
            </span>
          </div>

          <textarea
            ref={textareaRef}
            className="dash-sticky-textarea"
            style={{ background: draftMeta.bg, color: draftMeta.ink }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your note here..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirm();
            }}
          />

          <div className="dash-sticky-edit-footer">
            <button type="button" className="dash-sticky-confirm" onClick={confirm}>
              <Check size={12} />
              Confirmer
            </button>
          </div>
        </div>
      ) : (
        <div
          className="dash-sticky-view"
          style={{ background: colorMeta.bg, color: colorMeta.ink }}
          onDoubleClick={startEdit}
        >
          {content ? (
            <p className="dash-sticky-handwriting">{content}</p>
          ) : (
            <p className="dash-sticky-placeholder">Double-click to write…</p>
          )}
          <button
            type="button"
            className="dash-sticky-edit-btn"
            onClick={(e) => { e.stopPropagation(); startEdit(); }}
            title="Edit"
            aria-label="Edit note"
          >
            <Pencil size={11} />
          </button>
        </div>
      )}
    </WidgetShell>
  );
};

export default StickyNoteWidget;
