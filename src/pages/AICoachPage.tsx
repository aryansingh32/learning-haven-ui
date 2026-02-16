import { useState, useEffect, useRef } from "react";
import { Send, Mic, Bot, User, Lightbulb, Bug, HelpCircle, FileText, Sparkles, Copy, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
  isCode?: boolean;
}

const quickActions = [
  { label: "Explain", icon: Lightbulb, color: "text-primary" },
  { label: "Debug", icon: Bug, color: "text-destructive" },
  { label: "Hint", icon: HelpCircle, color: "text-info" },
  { label: "Summarize", icon: FileText, color: "text-success" },
];

const AICoachPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // 3. Clear History Mutation
  const clearMutation = useApiMutation<any, void>(
    '/ai/history',
    'delete'
  );

  // 4. Send Message Mutation
  const chatMutation = useApiMutation<any, { message: string }>(
    '/ai/chat',
    'post'
  );

  useEffect(() => {
    if (history) {
      setMessages(history.map(m => ({
        role: m.role,
        content: m.content,
        isCode: m.content.includes('```')
      })));
    }
  }, [history]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || chatMutation.isPending) return;

    // Optimistic UI update
    const newUserMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, newUserMsg]);
    if (!messageText) setInput("");

    try {
      const response = await chatMutation.mutateAsync({ message: text });
      const assistantMsg: Message = {
        role: "assistant",
        content: response.content,
        isCode: response.content.includes('```')
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI Error:", error);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      await clearMutation.mutateAsync();
      setMessages([]);
      refetchHistory();
    }
  };

  const handleCopyCode = (code: string, index: number) => {
    const cleanCode = code.replace(/```[a-z]*\n?/g, "").replace(/```/g, "");
    navigator.clipboard.writeText(cleanCode.trim());
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl gradient-golden flex items-center justify-center shadow-lg animate-glow-pulse">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">AI Coach</h1>
            <p className="text-xs text-muted-foreground">
              {usage ? `${usage.remaining || 0} queries remaining today` : "Your personal DSA mentor"}
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

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSend(`${action.label} this: `)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl card-glass text-xs font-semibold text-foreground hover:bg-secondary/60 transition-all border border-border/50"
          >
            <action.icon className={cn("h-3.5 w-3.5", action.color)} />
            {action.label}
          </motion.button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {historyLoading && messages.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-none" />
            <Skeleton className="h-12 w-1/2 ml-auto rounded-2xl rounded-br-none" />
            <Skeleton className="h-24 w-3/4 rounded-2xl rounded-bl-none" />
          </div>
        ) : (
          <AnimatePresence>
            {messages.length === 0 && (
              <div className="text-center py-10 opacity-40">
                <Bot className="h-12 w-12 mx-auto mb-3" />
                <p className="text-sm">No messages yet. Start a conversation!</p>
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
                  <div className="h-8 w-8 rounded-xl gradient-golden flex-shrink-0 flex items-center justify-center shadow-md">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative group shadow-sm",
                  msg.role === "user"
                    ? "gradient-golden text-primary-foreground rounded-br-lg"
                    : "card-glass text-foreground rounded-bl-lg border border-border/50"
                )}>
                  {msg.isCode ? (
                    <div className="relative mt-1">
                      <pre className="bg-background/50 rounded-xl p-3 text-[11px] font-mono overflow-x-auto whitespace-pre border border-border/20">
                        {msg.content.replace(/```[a-z]*\n?/g, "").replace(/```/g, "")}
                      </pre>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleCopyCode(msg.content, i)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-secondary/80 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
                      >
                        {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </motion.button>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {msg.content}
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
        {chatMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-start"
          >
            <div className="h-8 w-8 rounded-xl gradient-golden flex-shrink-0 flex items-center justify-center shadow-md">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="card-glass rounded-2xl rounded-bl-lg px-4 py-3 border border-border/50">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary/50"
                    animate={{ y: [0, -8, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
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
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={chatMutation.isPending}
            placeholder={chatMutation.isPending ? "Tutor is thinking..." : "Ask anything about DSA..."}
            className="w-full px-4 py-3 pr-12 rounded-xl card-glass text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border border-border/50 disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSend()}
            disabled={chatMutation.isPending}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg gradient-golden text-primary-foreground flex items-center justify-center transition-all shadow-md hover:shadow-lg disabled:grayscale disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;
