/**
 * GlobalAIAssistant — Floating, omnipresent AI mentor panel.
 *
 * - Collapsed: A premium glowing orb on the right edge.
 * - Expanded: Shows current mission, quick actions, knowledge gaps, and chat.
 * - Context-aware: Changes suggestions based on current route.
 * - Proactive: Pulses/interrupts when user is struggling or inactive.
 *
 * DOES NOT replace the existing /ai-coach page — it supplements it.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRoadmap } from '@/context/RoadmapContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Bot, X, ArrowRight, Sparkles, Target, BookOpen,
  Code2, Briefcase, Trophy, Zap, Send, ChevronRight,
  Brain, AlertTriangle, Flame,
} from 'lucide-react';
import { api } from '@/services/api.svc';
import { getAccessToken } from '@/lib/authSession';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type QuickAction = {
  label: string;
  icon: React.ElementType;
  action: () => void;
  variant?: 'primary' | 'default' | 'warning';
};

// ─── Route Context Mapping ──────────────────────────────────────────────────

function getRouteContext(pathname: string): {
  pageName: string;
  hint: string;
  icon: React.ElementType;
} {
  if (pathname.includes('/dashboard')) return { pageName: 'Mission Control', hint: 'Guide your progress', icon: Target };
  if (pathname.includes('/course') || pathname.includes('/chapter')) return { pageName: 'Learn', hint: 'Recommend lessons', icon: BookOpen };
  if (pathname.includes('/project') || pathname.includes('/build')) return { pageName: 'Challenges', hint: 'Provide hints', icon: Code2 };
  if (pathname.includes('/ai-coach')) return { pageName: 'AI Mentor', hint: 'Deep conversation', icon: Bot };
  if (pathname.includes('/profile')) return { pageName: 'Achievements', hint: 'Suggest next badge', icon: Trophy };
  if (pathname.includes('/resume')) return { pageName: 'Resume', hint: 'Suggest improvements', icon: Briefcase };
  if (pathname.includes('/jobs')) return { pageName: 'Jobs', hint: 'Suggest opportunities', icon: Briefcase };
  if (pathname.includes('/referral')) return { pageName: 'Referrals', hint: 'Growth tips', icon: Zap };
  if (pathname.includes('/topics')) return { pageName: 'Learning Tracks', hint: 'Practice guidance', icon: Brain };
  return { pageName: 'DSA OS', hint: 'How can I help?', icon: Sparkles };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GlobalAIAssistant() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const roadmap = useRoadmap();

  const routeCtx = getRouteContext(location.pathname);

  // Auto-collapse on route change
  useEffect(() => {
    if (chatMode) return; // keep open if chatting
    setIsExpanded(false);
  }, [location.pathname]);

  // Proactive pulse based on momentum
  useEffect(() => {
    if (roadmap.momentum?.churnRisk === 'high' || roadmap.momentum?.daysInactive >= 3) {
      setShouldPulse(true);
    } else {
      setShouldPulse(false);
    }
  }, [roadmap.momentum]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Quick Actions (context-aware) ──────────────────────────────────────

  const quickActions = useCallback((): QuickAction[] => {
    const actions: QuickAction[] = [];

    // Always: continue mission
    if (roadmap.mission) {
      actions.push({
        label: 'Continue Mission',
        icon: ArrowRight,
        action: () => {
          navigate(roadmap.mission!.continueUrl);
          setIsExpanded(false);
        },
        variant: 'primary',
      });
    }

    // Weak areas warning
    if (roadmap.weakAreas.length > 0) {
      const weakest = roadmap.weakAreas[0];
      actions.push({
        label: `Review ${weakest.topic}`,
        icon: AlertTriangle,
        action: () => {
          navigate('/topics');
          setIsExpanded(false);
        },
        variant: 'warning',
      });
    }

    // Page-specific actions
    if (location.pathname.includes('/dashboard')) {
      actions.push({
        label: 'Start Daily Quest',
        icon: Flame,
        action: () => {
          navigate(roadmap.mission?.continueUrl || '/courses');
          setIsExpanded(false);
        },
      });
    }

    if (location.pathname.includes('/course') || location.pathname.includes('/chapter')) {
      actions.push({
        label: 'Ask about this topic',
        icon: Brain,
        action: () => {
          setChatMode(true);
          setChatInput('Help me understand this concept better');
          setTimeout(() => inputRef.current?.focus(), 100);
        },
      });
    }

    if (location.pathname.includes('/project') || location.pathname.includes('/build')) {
      actions.push({
        label: 'Get a hint',
        icon: Sparkles,
        action: () => {
          setChatMode(true);
          setChatInput('Give me a hint for this challenge');
          setTimeout(() => inputRef.current?.focus(), 100);
        },
      });
    }

    // Always offer mentor chat
    actions.push({
      label: 'Ask Mentor',
      icon: Bot,
      action: () => {
        setChatMode(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    });

    return actions.slice(0, 4);
  }, [roadmap, location.pathname, navigate]);

  // ─── Chat Handler ─────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text || isTyping) return;

    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const token = getAccessToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      abortRef.current = new AbortController();

      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error('Chat failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;
              if (dataStr.startsWith('[ERROR:')) continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                  setChatMessages((prev) => {
                    const msgs = [...prev];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === 'assistant') {
                      last.content += data.content;
                    } else {
                      msgs.push({ role: 'assistant', content: data.content });
                    }
                    return msgs;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' },
        ]);
      }
    } finally {
      setIsTyping(false);
      abortRef.current = null;
    }
  };

  // ─── Render: Hide on certain routes ───────────────────────────────────

  if (location.pathname.includes('/ai-coach')) return null; // don't show on full AI page
  if (location.pathname.includes('/workspace')) return null; // don't show in code workspaces
  if (location.pathname.includes('/test-editor')) return null;

  // ─── Collapsed State ──────────────────────────────────────────────────

  if (!isExpanded) {
    return (
      <motion.button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'fixed z-50 flex items-center justify-center transition-all',
          isMobile
            ? 'bottom-20 right-4 w-12 h-12 rounded-full'
            : 'right-4 bottom-8 w-12 h-12 rounded-full',
        )}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
        aria-label="Open AI Assistant"
      >
        {/* Glow ring */}
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            shouldPulse
              ? 'animate-ping bg-purple-500/30'
              : 'bg-purple-500/10'
          )}
        />
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 shadow-[0_0_24px_rgba(139,92,246,0.4)]" />
        {/* Inner glow */}
        <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-purple-500/90 via-violet-600 to-indigo-700 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {/* Notification dot */}
        {shouldPulse && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-background" />
        )}
      </motion.button>
    );
  }

  // ─── Expanded State ───────────────────────────────────────────────────

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'fixed z-50 flex flex-col border border-border/60 shadow-2xl',
          isMobile
            ? 'inset-x-3 bottom-20 top-16 rounded-2xl'
            : 'right-4 bottom-8 w-[380px] max-h-[calc(100vh-6rem)] rounded-2xl',
          'bg-background/95 backdrop-blur-xl',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground">AI Mentor</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {routeCtx.pageName} — {routeCtx.hint}
            </p>
          </div>
          <button
            onClick={() => {
              setIsExpanded(false);
              setChatMode(false);
            }}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Close AI assistant"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {chatMode ? (
            /* ── Chat Mode ── */
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8 opacity-50">
                    <Bot className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Ask me anything about your learning journey</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-2',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-purple-400" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-secondary/60 text-foreground rounded-bl-md border border-border/30'
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1 [&_p]:mt-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Bot className="w-3 h-3 text-purple-400" />
                    </div>
                    <motion.span
                      className="text-xs text-muted-foreground bg-secondary/60 px-3 py-2 rounded-xl rounded-bl-md"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Thinking...
                    </motion.span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Back button */}
              <button
                onClick={() => setChatMode(false)}
                className="px-4 py-2 text-[11px] text-primary font-semibold hover:underline text-left"
              >
                ← Back to overview
              </button>
            </div>
          ) : (
            /* ── Overview Mode ── */
            <div className="px-4 py-4 space-y-4">
              {/* Current Mission Card */}
              {roadmap.mission && (
                <div className="rounded-xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1.5">
                    Current Mission
                  </p>
                  <p className="text-sm font-bold text-foreground mb-1">{roadmap.mission.pathTitle}</p>
                  <p className="text-[11px] text-muted-foreground mb-3">{roadmap.mission.nextTask}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${roadmap.mission.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-purple-400">{roadmap.mission.progress}%</span>
                  </div>
                </div>
              )}

              {/* Career Readiness Snapshot */}
              {roadmap.careerReadiness && (
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Career Readiness
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-display font-bold text-foreground">
                      {roadmap.careerReadiness.readinessPercent}%
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold text-foreground">{roadmap.careerReadiness.targetRole}</p>
                      <p className="text-[10px] text-muted-foreground">{roadmap.careerReadiness.salaryBand}</p>
                    </div>
                  </div>
                  {roadmap.careerReadiness.skillsMissing.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {roadmap.careerReadiness.skillsMissing.slice(0, 3).map((s) => (
                        <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Knowledge Gaps */}
              {roadmap.weakAreas.length > 0 && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Weak Areas
                  </p>
                  <div className="space-y-1.5">
                    {roadmap.weakAreas.slice(0, 3).map((area) => (
                      <div key={area.topic} className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-foreground flex-1 truncate">{area.topic}</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${area.proficiency}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-orange-500 w-8 text-right">{area.proficiency}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Suggested Actions
                </p>
                {quickActions().map((action, i) => (
                  <motion.button
                    key={action.label}
                    onClick={action.action}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group',
                      action.variant === 'primary'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/15'
                        : action.variant === 'warning'
                          ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/15'
                          : 'bg-secondary/40 text-foreground border border-border/30 hover:bg-secondary/60'
                    )}
                  >
                    <action.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{action.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                ))}
              </div>

              {/* Momentum indicator */}
              {roadmap.momentum && roadmap.momentum.churnRisk !== 'low' && (
                <div className={cn(
                  'rounded-xl p-3 text-[11px] font-medium',
                  roadmap.momentum.churnRisk === 'high'
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
                )}>
                  {roadmap.momentum.churnRisk === 'high'
                    ? `⚠️ You haven't been active for ${roadmap.momentum.daysInactive} days. Your streak is at risk!`
                    : `💡 Keep your momentum — practice today to maintain your streak!`
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input (always visible at bottom) */}
        <div className="border-t border-border/40 px-4 py-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!chatMode) setChatMode(true);
                  handleSend();
                }
              }}
              onFocus={() => { if (!chatMode) setChatMode(true); }}
              placeholder="Ask your mentor anything..."
              className="w-full px-3 py-2.5 pr-10 rounded-xl bg-secondary/40 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 border border-border/30 transition-all"
              disabled={isTyping}
            />
            <button
              onClick={() => {
                if (!chatMode) setChatMode(true);
                handleSend();
              }}
              disabled={!chatInput.trim() || isTyping}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center disabled:opacity-30 hover:bg-purple-600 transition-colors"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
