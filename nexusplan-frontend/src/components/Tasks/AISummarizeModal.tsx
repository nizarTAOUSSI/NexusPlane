import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, X, Zap,
} from 'lucide-react';
import { aiService, type SummarizeProjectResponse } from '../../services/aiService';
import { type Task } from '../../types/task';

interface AISummarizeModalProps {
  projectId: string;
  projectName?: string;
  tasks: Task[];
  userId: string;
  onClose: () => void;
}

type Step = 'loading' | 'view' | 'error';

const AISummarizeModal: React.FC<AISummarizeModalProps> = ({
  projectId,
  projectName,
  tasks,
  userId,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [summary, setSummary] = useState<string>('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [modelUsed, setModelUsed] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      setStep('loading');
      setErrorMsg('');
      try {
        const payload = {
          projectId,
          projectName: projectName || 'Unnamed Project',
          tasks: tasks.map(t => ({
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
          })),
        };
        const result: SummarizeProjectResponse = await aiService.summarizeProject(payload, userId);
        setSummary(result.summary);
        setTokensUsed(result.tokensUsed);
        setModelUsed(result.modelUsed);
        setStep('view');
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ?? 'AI summarization failed. Please try again.';
        setErrorMsg(msg);
        setStep('error');
      }
    };

    fetchSummary();
  }, [projectId, projectName, tasks, userId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
            <div className="ai-modal-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
              <FileText size={18} />
            </div>
            <div>
              <h2 className="ai-modal-title">Project Summary</h2>
              {projectName && (
                <p className="ai-modal-sub">
                  Executive overview for <strong>{projectName}</strong>
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
            {step === 'loading' && (
              <motion.div
                key="loading"
                className="ai-step ai-step--center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
                style={{ minHeight: 300 }}
              >
                <div className="ai-generating-orb" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                  <Sparkles size={32} />
                </div>
                <p className="ai-generating-title">Analysing project progress…</p>
                <p className="ai-generating-sub">
                  Reviewing {tasks.length} tasks and synthesizing an executive summary.
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

            {step === 'view' && (
              <motion.div
                key="view"
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
                      AI Analysis Complete
                    </p>
                  </div>
                  <div className="ai-review-meta">
                    {tokensUsed > 0 && (
                      <span className="ai-tokens-badge">{tokensUsed} tokens • {modelUsed.split('/').pop()}</span>
                    )}
                  </div>
                </div>

                <div className="ai-summary-content">
                  {summary.split('\n\n').map((para, i) => (
                    <p key={i} className="ai-summary-para">{para}</p>
                  ))}
                </div>

                <div className="ai-step-actions">
                  <button className="ai-btn ai-btn--primary" onClick={onClose}>
                    <CheckCircle2 size={15} />
                    Done
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div
                key="error"
                className="ai-step ai-step--center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
                style={{ minHeight: 300 }}
              >
                <div className="ai-error-icon">
                  <AlertCircle size={36} />
                </div>
                <p className="ai-generating-title">Summarization failed</p>
                <p className="ai-generating-sub">{errorMsg}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="ai-btn ai-btn--ghost" onClick={onClose}>
                    Close
                  </button>
                  <button
                    className="ai-btn ai-btn--primary"
                    onClick={() => setStep('loading')}
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

export default AISummarizeModal;
