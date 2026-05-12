import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Send, Sparkles, Loader2, Bot, User,
  ChevronDown, Minimize2, Maximize2, RefreshCw
} from 'lucide-react';
import { aiService, type CopilotPayload, type CopilotResponse } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { type Task } from '../types/task';

// ── Greeting detection ──────────────────────────────────────────────────────
const _GREETING_RE = /^\s*(hi+|hey+|hello+|howdy|sup|yo+|salut|bonjour|bonsoir|bonne\s*journ[ée]e?|coucou|salam|مرحبا|hola|ciao|ola|greetings|good\s*(morning|afternoon|evening|day))\W*\s*$/i;

function _greetingReply(userName?: string): string {
  const name = userName ? `, ${userName.split(' ')[0]}` : '';
  const replies = [
    `Hey${name}! 👋 I'm your NexusPlan Copilot. Ask me anything about your project — priorities, blockers, sprint planning, you name it.`,
    `Hello${name}! 😊 Ready to help with your project. What's on your mind?`,
    `Hi${name}! How can I help you with your project today?`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}
// ───────────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AICopilotProps {
  projectId?: string;
  projectName?: string;
  currentTask?: Task;
  recentTasks?: Task[];
}

const AICopilot: React.FC<AICopilotProps> = ({
  projectId,
  projectName,
  currentTask,
  recentTasks,
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your NexusPlan Copilot. How can I help you with your project today?",
      timestamp: Date.now(),
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading || !user?.id) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // ── Local greeting intercept — no API call, no token consumption ──────
    if (_GREETING_RE.test(userMsg.content)) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: _greetingReply(user?.username || user?.email),
        timestamp: Date.now(),
      }]);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    setLoading(true);

    try {
      const payload: CopilotPayload = {
        message: userMsg.content,
        context: {
          projectId,
          projectName,
          task: currentTask ? {
            title: currentTask.title,
            description: currentTask.description,
            status: currentTask.status,
            priority: currentTask.priority,
          } : undefined,
          recentTasks: recentTasks?.map(t => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
        }
      };

      const result: CopilotResponse = await aiService.copilot(payload, user.id);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again later.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm your NexusPlan Copilot. How can I help you with your project today?",
        timestamp: Date.now(),
      }
    ]);
  };

  return (
    <div className="copilot-container">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            className="copilot-trigger"
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles size={24} />
            <span className="copilot-trigger-badge">Copilot</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`copilot-window ${isMinimized ? 'copilot-window--minimized' : ''}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            <div className="copilot-header">
              <div className="copilot-header-left">
                <div className="copilot-bot-icon">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="copilot-title">NexusPlan Copilot</h3>
                  <span className="copilot-status">Online</span>
                </div>
              </div>
              <div className="copilot-header-actions">
                <button onClick={clearChat} title="Clear chat"><RefreshCw size={14} /></button>
                <button onClick={() => setIsMinimized(!isMinimized)}>
                  {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button onClick={() => setIsOpen(false)}><X size={16} /></button>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div className="copilot-messages" ref={scrollRef}>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`copilot-msg-row copilot-msg-row--${msg.role}`}>
                      <div className="copilot-msg-avatar">
                        {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                      </div>
                      <div className="copilot-msg-bubble">
                        <div className="copilot-msg-content">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="copilot-msg-row copilot-msg-row--assistant">
                      <div className="copilot-msg-avatar">
                        <Bot size={14} />
                      </div>
                      <div className="copilot-msg-bubble copilot-msg-bubble--loading">
                        <Loader2 size={16} className="copilot-spin" />
                        <span>Thinking…</span>
                      </div>
                    </div>
                  )}
                </div>

                <form className="copilot-input-area" onSubmit={handleSend}>
                  <input
                    type="text"
                    className="copilot-input"
                    placeholder="Ask anything about your project…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    className="copilot-send-btn"
                    disabled={!input.trim() || loading}
                  >
                    {loading ? <Loader2 size={16} className="copilot-spin" /> : <Send size={16} />}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AICopilot;
