import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, ArrowDown, ArrowUp, Check, CheckCircle2,
  ChevronRight, Loader2, Minus, Plus, Sparkles, Wand2, X, Zap,
} from 'lucide-react';
import { aiService, type AIGeneratedTask } from '../../services/aiService';
import { type CreateTaskPayload, TaskPriority } from '../../types/task';

const PRIORITY_META: Record<
  AIGeneratedTask['priority'],
  { label: string; icon: React.ReactNode; cls: string; taskPriority: TaskPriority }
> = {
  HIGH:   { label: 'High',   icon: <ArrowUp size={11} />,   cls: 'ai-pill ai-pill--high',   taskPriority: TaskPriority.HIGH   },
  MEDIUM: { label: 'Medium', icon: <Minus size={11} />,      cls: 'ai-pill ai-pill--medium', taskPriority: TaskPriority.MEDIUM },
  LOW:    { label: 'Low',    icon: <ArrowDown size={11} />,  cls: 'ai-pill ai-pill--low',    taskPriority: TaskPriority.LOW    },
};


interface TaskRowProps {
  task: AIGeneratedTask;
  selected: boolean;
  onToggle: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, selected, onToggle }) => {
  const p = PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIUM;
  return (
    <motion.div
      layout
      className={`ai-task-row ${selected ? 'ai-task-row--selected' : ''}`}
      onClick={onToggle}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`ai-task-checkbox ${selected ? 'ai-task-checkbox--checked' : ''}`}>
        {selected && <Check size={11} strokeWidth={3} />}
      </div>

      <div className="ai-task-body">
        <div className="ai-task-title-row">
          <span className="ai-task-title">{task.title}</span>
          <span className={p.cls}>
            {p.icon}
            {p.label}
          </span>
        </div>
        {task.description && (
          <p className="ai-task-desc">{task.description}</p>
        )}
      </div>
    </motion.div>
  );
};



type Step = 'compose' | 'generating' | 'review' | 'importing' | 'done' | 'error';

interface AIGenerateModalProps {
  projectId: string;
  projectName?: string;
  userId: string;
  onClose: () => void;
  onImport: (tasks: CreateTaskPayload[]) => Promise<void>;
}

const PLACEHOLDER_EXAMPLES = [
  'A SaaS dashboard for tracking team productivity with authentication, analytics charts, and export features.',
  'An e-commerce checkout flow with cart management, promo codes, payment integration, and order confirmation.',
  'A REST API for a blog platform with posts, comments, tags, search, and admin moderation tools.',
];

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  projectId,
  projectName,
  userId,
  onClose,
  onImport,
}) => {
  const [step,        setStep]        = useState<Step>('compose');
  const [description, setDescription] = useState('');
  const [generated,   setGenerated]   = useState<AIGeneratedTask[]>([]);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [tokensUsed,  setTokensUsed]  = useState(0);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PLACEHOLDER_EXAMPLES.length;
      setPlaceholder(PLACEHOLDER_EXAMPLES[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (generated.length > 0) {
      setSelected(new Set(generated.map((_, i) => i)));
    }
  }, [generated]);

  const handleGenerate = async () => {
    if (description.trim().length < 10) return;
    setStep('generating');
    setErrorMsg('');
    try {
      const result = await aiService.generateTasks(
        { description: description.trim(), projectId },
        userId,
      );
      setGenerated(result.tasks);
      setTokensUsed(result.tokensUsed);
      setStep('review');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? 'AI generation failed. Please try again.';
      setErrorMsg(msg);
      setStep('error');
    }
  };

  const handleImport = async () => {
    const toImport = generated
      .filter((_, i) => selected.has(i))
      .map((t) => ({
        projectId,
        title:       t.title,
        description: t.description || undefined,
        priority:    PRIORITY_META[t.priority]?.taskPriority ?? TaskPriority.MEDIUM,
      }));

    if (toImport.length === 0) return;

    setStep('importing');
    try {
      await onImport(toImport);
      setStep('done');
    } catch {
      setErrorMsg('Some tasks could not be created. Please try again.');
      setStep('error');
    }
  };

  const toggleAll = () => {
    if (selected.size === generated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(generated.map((_, i) => i)));
    }
  };

  const toggleOne = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div
      className="ai-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="ai-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.95, y: 20  }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="ai-modal-header">
          <div className="ai-modal-header-left">
            <div className="ai-modal-icon-wrap">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="ai-modal-title">AI Task Generator</h2>
              {projectName && (
                <p className="ai-modal-sub">
                  for <strong>{projectName}</strong>
                </p>
              )}
            </div>
          </div>
          <button className="ai-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ai-modal-body">
          <AnimatePresence mode="wait">

            {step === 'compose' && (
              <motion.div
                key="compose"
                className="ai-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <p className="ai-step-label">
                  <Wand2 size={14} />
                  Describe your project or feature
                </p>
                <textarea
                  ref={textareaRef}
                  className="ai-textarea"
                  placeholder={placeholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  autoFocus
                />
                <p className="ai-hint">
                  The AI will break it down into actionable tasks with priorities.
                  You'll review them before adding to your board.
                </p>

                <div className="ai-step-actions">
                  <button className="ai-btn ai-btn--ghost" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    className="ai-btn ai-btn--primary"
                    onClick={handleGenerate}
                    disabled={description.trim().length < 10}
                  >
                    <Sparkles size={15} />
                    Generate Tasks
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'generating' && (
              <motion.div
                key="generating"
                className="ai-step ai-step--center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
              >
                <div className="ai-generating-orb">
                  <Sparkles size={32} />
                </div>
                <p className="ai-generating-title">Generating tasks…</p>
                <p className="ai-generating-sub">
                  Analysing your description and decomposing into actionable tasks.
                </p>
                <div className="ai-generating-dots">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="ai-dot"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div
                key="review"
                className="ai-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="ai-review-header">
                  <div>
                    <p className="ai-step-label">
                      <Zap size={14} />
                      {generated.length} tasks generated
                    </p>
                    <p className="ai-hint" style={{ marginTop: 2 }}>
                      Select the tasks you want to add to your board.
                    </p>
                  </div>
                  <div className="ai-review-meta">
                    {tokensUsed > 0 && (
                      <span className="ai-tokens-badge">{tokensUsed} tokens</span>
                    )}
                    <button className="ai-select-all-btn" onClick={toggleAll}>
                      {selected.size === generated.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                </div>

                <div className="ai-tasks-list">
                  {generated.map((task, i) => (
                    <TaskRow
                      key={i}
                      task={task}
                      selected={selected.has(i)}
                      onToggle={() => toggleOne(i)}
                    />
                  ))}
                </div>

                <div className="ai-step-actions">
                  <button
                    className="ai-btn ai-btn--ghost"
                    onClick={() => { setStep('compose'); setGenerated([]); }}
                  >
                    <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                    Back
                  </button>
                  <button
                    className="ai-btn ai-btn--primary"
                    onClick={handleImport}
                    disabled={selected.size === 0}
                  >
                    <Plus size={15} />
                    Add {selected.size} Task{selected.size !== 1 ? 's' : ''} to Board
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'importing' && (
              <motion.div
                key="importing"
                className="ai-step ai-step--center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
              >
                <Loader2 size={36} className="ai-spin" />
                <p className="ai-generating-title">Adding tasks to board…</p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                className="ai-step ai-step--center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1  }}
                exit={{   opacity: 0 }}
              >
                <motion.div
                  className="ai-success-icon"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
                >
                  <CheckCircle2 size={40} />
                </motion.div>
                <p className="ai-generating-title">Tasks added!</p>
                <p className="ai-generating-sub">
                  {selected.size} task{selected.size !== 1 ? 's' : ''} have been added to your board.
                </p>
                <button className="ai-btn ai-btn--primary" onClick={onClose}>
                  Done
                </button>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div
                key="error"
                className="ai-step ai-step--center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
              >
                <div className="ai-error-icon">
                  <AlertCircle size={36} />
                </div>
                <p className="ai-generating-title">Something went wrong</p>
                <p className="ai-generating-sub">{errorMsg}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="ai-btn ai-btn--ghost" onClick={onClose}>
                    Close
                  </button>
                  <button
                    className="ai-btn ai-btn--primary"
                    onClick={() => setStep('compose')}
                  >
                    Try again
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default AIGenerateModal;
