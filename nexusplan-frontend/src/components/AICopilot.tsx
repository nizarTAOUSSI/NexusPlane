import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Loader2, Bot, User, Minimize2, Maximize2, RefreshCw, Copy, Check, CornerDownLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiService, type CopilotPayload, type CopilotResponse } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { type Task } from '../types/task';

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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    const currentReply = replyingTo;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setReplyingTo(null);

    if (_GREETING_RE.test(userMsg.content)) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: _greetingReply(user?.username || user?.email),
        timestamp: Date.now(),
      }]);
      return;
    }

    setLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const payload: CopilotPayload = {
        message: userMsg.content,
        context: {
          projectId,
          projectName,
          ...(conversationHistory.length > 0 && { history: conversationHistory }),
          ...(currentReply && {
            referencedMessage: {
              role: currentReply.role,
              content: currentReply.content.slice(0, 800),
            },
          }),
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

  const handleCopy = useCallback((msg: Message) => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

  const clearChat = () => {
    setReplyingTo(null);
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
                      <div className="copilot-msg-bubble-wrap">
                        <div className="copilot-msg-bubble">
                          {msg.role === 'assistant' ? (
                            <div className="copilot-msg-content copilot-msg-content--md">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="copilot-msg-content">{msg.content}</div>
                          )}
                        </div>
                        {msg.role === 'assistant' && (
                          <div className="copilot-msg-actions">
                            <button
                              className="copilot-msg-action-btn"
                              title="Copy response"
                              onClick={() => handleCopy(msg)}
                            >
                              {copiedId === msg.id
                                ? <Check size={12} />
                                : <Copy size={12} />}
                              <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                            </button>
                            <button
                              className="copilot-msg-action-btn"
                              title="Use this response as context"
                              onClick={() => handleReply(msg)}
                            >
                              <CornerDownLeft size={12} />
                              <span>Reply</span>
                            </button>
                          </div>
                        )}
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

                {replyingTo && (
                  <div className="copilot-reply-banner">
                    <div className="copilot-reply-banner-content">
                      <CornerDownLeft size={12} className="copilot-reply-banner-icon" />
                      <span className="copilot-reply-banner-text">
                        {replyingTo.content.slice(0, 80)}{replyingTo.content.length > 80 ? '…' : ''}
                      </span>
                    </div>
                    <button
                      className="copilot-reply-banner-close"
                      onClick={() => setReplyingTo(null)}
                      title="Cancel reply"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                <form className="copilot-input-area" onSubmit={handleSend}>
                  <input
                    ref={inputRef}
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
