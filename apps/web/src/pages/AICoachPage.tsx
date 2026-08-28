import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Mic, Bot, User, Lightbulb, Bug, HelpCircle, FileText, Sparkles, Trash2, ArrowRight, Brain, AlertTriangle, Briefcase, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import { api } from "@/services/api.svc";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MentorContext } from "@/lib/gamification";
import { useRoadmap } from "@/context/RoadmapContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  isCode?: boolean;
}

// quickActions are fetched dynamically from settings API

const AICoachPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mentorInitiated, setMentorInitiated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch Chat History
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useApiQuery<any[]>(
    ['ai-history'],
    '/ai/history'
  );

  // 2. Fetch Usage Info
  const { data: usage } = useApiQuery<any>(
    ['ai-usage'],
    '/ai/usage'
  );

  // 3. Fetch System Settings for Quick Actions
  const { data: settings } = useApiQuery<any>(
    ['public-settings'],
    '/settings/public'
  );

  const dynamicQuickActions = (() => {
    const raw = settings?.ai_quick_actions;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  })();

  // 4. Fetch real mentor context from user progress
  const { data: mentorContext, isLoading: mentorLoading } = useApiQuery<MentorContext>(
    ['mentor-context'],
    '/users/me/mentor-context'
  );

  // 5. Clear History Mutation
  const clearMutation = useApiMutation<any, void>(
    () => api.delete('/ai/history')
  );

  // 4. Removed chatMutation in favor of native fetch for SSE

  useEffect(() => {
    if (history && history.length > 0) {
      setMessages(history.map(m => ({
        role: m.role,
        content: m.content,
        isCode: m.content.includes('```')
      })));
      setMentorInitiated(true);
    }
  }, [history]);

  // Proactive mentor message based on REAL progress (only when no chat history)
  useEffect(() => {
    if (mentorContext && !mentorInitiated && messages.length === 0 && !historyLoading) {
      setMessages([{
        role: 'assistant',
        content: mentorContext.message,
      }]);
      setMentorInitiated(true);
    }
  }, [mentorContext, mentorInitiated, messages.length, historyLoading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isTyping) return;

    // Optimistic UI update
    const newUserMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, newUserMsg]);
    if (!messageText) setInput("");
    setIsTyping(true);

    try {
      const { getAccessToken } = await import('@/lib/authSession');
      const token = getAccessToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat response');
      }

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
              if (dataStr.startsWith('[ERROR:')) {
                console.error(dataStr);
                continue;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last.role === 'assistant') {
                      last.content += data.content;
                      last.isCode = last.content.includes('```');
                    } else {
                      newMsgs.push({ role: 'assistant', content: data.content, isCode: data.content.includes('```') });
                    }
                    return newMsgs;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User-initiated cancellation — nothing to report.
      } else {
        console.error("AI Error:", error);
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
    }
  };

  const handleMentorAction = (action: MentorContext['actions'][0]) => {
    if (action.action === 'navigate' && action.url) {
      navigate(action.url);
    } else if (action.action === 'prompt' && action.prompt) {
      void handleSend(action.prompt);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      await clearMutation.mutateAsync();
      setMessages([]);
      setMentorInitiated(false);
      refetchHistory();
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-section-title font-bold text-foreground">AI Mentor</h1>
            <p className="text-meta text-muted-foreground">
              {mentorContext?.context.activeChapter
                ? `Focused on: ${mentorContext.context.activeChapter}`
                : usage ? `${usage.remaining || 0} queries remaining today` : "Contextual guidance from your progress"}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors border border-border/40"
          title="Clear History"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Contextual action buttons from real progress */}
      {mentorContext && mentorContext.actions.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mentorContext.actions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleMentorAction(action)}
              className={cn(
                "flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all border",
                i === 0
                  ? "bg-reward text-reward-foreground border-reward/30 shadow-[0_0_16px_hsl(32_100%_50%/0.25)] hover:bg-reward/90"
                  : "card-glass text-foreground border-border/50 hover:bg-secondary/60"
              )}
            >
              {action.label}
              <ArrowRight className="w-4 h-4 shrink-0" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Knowledge Context Panel */}
      <KnowledgeContextPanel onAskTopic={(topic) => handleSend(`Help me understand ${topic}. I'm struggling with this topic.`)} />

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {dynamicQuickActions.length > 0 && dynamicQuickActions.map((action: any, i: number) => {
          let IconElement = Lightbulb;
          if (action.icon === "Bug") IconElement = Bug;
          if (action.icon === "HelpCircle") IconElement = HelpCircle;
          if (action.icon === "FileText") IconElement = FileText;

          return (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setInput(`${action.label} this: `);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl card-glass text-xs font-semibold text-foreground hover:bg-secondary/60 transition-all border border-border/50"
            >
              <IconElement className={cn("h-3.5 w-3.5", action.color)} />
              {action.label}
            </motion.button>
          )
        })}
      </div>

      {/* Chat Area — fills available space */}
      <div className="flex-1 min-h-[320px] overflow-y-auto space-y-4 pr-1 pb-2">
        {(historyLoading || mentorLoading) && messages.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-none" />
            <Skeleton className="h-12 w-1/2 ml-auto rounded-2xl rounded-br-none" />
            <Skeleton className="h-24 w-3/4 rounded-2xl rounded-bl-none" />
          </div>
        ) : (
          <AnimatePresence>
            {messages.length === 0 && !mentorLoading && (
              <div className="text-center py-10 opacity-60">
                <Bot className="h-12 w-12 mx-auto mb-3" aria-hidden="true" />
                <p className="text-body">Loading your mentor context...</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-xl bg-primary flex-shrink-0 flex items-center justify-center shadow-md">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-body leading-relaxed relative group shadow-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-lg"
                    : "card-glass text-foreground rounded-bl-lg border border-border/50"
                )}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-xl bg-secondary flex-shrink-0 flex items-center justify-center border border-border/40 shadow-sm">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-start"
          >
            <div className="h-8 w-8 rounded-xl bg-primary flex-shrink-0 flex items-center justify-center shadow-md">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="card-glass rounded-2xl rounded-bl-lg px-5 py-3 border border-border/50 flex items-center h-[44px]">
              <motion.span
                className="text-sm font-medium text-muted-foreground"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                Thinking...
              </motion.span>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="h-11 w-11 rounded-xl card-glass flex items-center justify-center text-muted-foreground hover:text-primary transition-all flex-shrink-0 border border-border/50"
        >
          <Mic className="h-5 w-5" />
        </motion.button>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isTyping}
            placeholder={isTyping ? "Mentor is thinking..." : "Ask about your current topic..."}
            aria-label="Message AI mentor"
            className="w-full px-4 py-3 pr-12 rounded-xl card-glass text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all border border-border/50 disabled:opacity-50"
          />
          {isTyping ? (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleStop}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-destructive/90 text-destructive-foreground flex items-center justify-center transition-all shadow-md hover:shadow-lg"
            >
              <div className="h-3 w-3 rounded-sm bg-current" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-reward text-reward-foreground flex items-center justify-center transition-all shadow-md hover:shadow-lg hover:bg-reward/90 disabled:opacity-40 disabled:grayscale focus-visible:ring-2 focus-visible:ring-reward"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;

// ─── Knowledge Context Panel ─────────────────────────────────────────────────
function KnowledgeContextPanel({ onAskTopic }: { onAskTopic: (topic: string) => void }) {
  const { weakAreas, careerReadiness, knowledgeGraph, isLoading } = useRoadmap();

  if (isLoading || knowledgeGraph.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 grid gap-3 sm:grid-cols-2"
    >
      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Topics to Review
          </p>
          <div className="space-y-2">
            {weakAreas.slice(0, 3).map((area) => (
              <button
                key={area.topic}
                onClick={() => onAskTopic(area.topic)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 hover:bg-background border border-border/30 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{area.topic}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${area.proficiency}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-orange-500">{area.proficiency}%</span>
                  </div>
                </div>
                <span className="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Ask →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Career Readiness */}
      {careerReadiness && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2.5 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Career Context
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl font-display font-bold text-foreground">
              {careerReadiness.readinessPercent}%
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{careerReadiness.targetRole}</p>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-reward" />
                <span className="text-[10px] font-bold text-reward">{careerReadiness.salaryBand}</span>
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${careerReadiness.readinessPercent}%` }} />
          </div>
          {careerReadiness.skillsMissing.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {careerReadiness.skillsMissing.slice(0, 3).map(s => (
                <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
