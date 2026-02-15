import { useState, useEffect, useRef } from "react";
import { Send, Mic, Bot, User, Lightbulb, Bug, HelpCircle, FileText, Sparkles, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
  isCode?: boolean;
}

const initialMessages: Message[] = [
  { role: "assistant", content: "Hi! I'm your AI DSA Coach. Ask me anything about data structures, algorithms, or coding problems. I can explain concepts, debug code, give hints, or summarize solutions. 🚀" },
  { role: "user", content: "Can you explain the two pointer technique?" },
  { role: "assistant", content: "The **Two Pointer** technique uses two references (pointers) that move through a data structure — typically an array — to solve problems efficiently.\n\n**Key patterns:**\n• Opposite ends (start & end move inward)\n• Same direction (slow & fast pointer)\n\n**Common use cases:**\n• Finding pairs that sum to a target\n• Removing duplicates in sorted arrays\n• Palindrome checking\n\nTime complexity typically improves from O(n²) to O(n)." },
  { role: "user", content: "Show me a code example for two sum with sorted array" },
  { role: "assistant", content: "```typescript\nfunction twoSum(nums: number[], target: number): number[] {\n  let left = 0;\n  let right = nums.length - 1;\n  \n  while (left < right) {\n    const sum = nums[left] + nums[right];\n    if (sum === target) return [left, right];\n    if (sum < target) left++;\n    else right--;\n  }\n  return [];\n}\n```", isCode: true },
];

const quickActions = [
  { label: "Explain", icon: Lightbulb, color: "text-primary" },
  { label: "Debug", icon: Bug, color: "text-destructive" },
  { label: "Hint", icon: HelpCircle, color: "text-info" },
  { label: "Summarize", icon: FileText, color: "text-success" },
];

const AICoachPage = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "That's a great question! Let me think about the best approach for this problem..." },
      ]);
    }, 1500);
  };

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl gradient-golden flex items-center justify-center shadow-lg animate-glow-pulse">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">AI Coach</h1>
            <p className="text-xs text-muted-foreground">Your personal DSA mentor — always online</p>
          </div>
        </div>
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
            onClick={() => setInput(`${action.label} this concept`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl card-glass text-xs font-semibold text-foreground hover:bg-secondary/60 transition-all border border-border/50"
          >
            <action.icon className={cn("h-3.5 w-3.5", action.color)} />
            {action.label}
          </motion.button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-xl gradient-golden flex-shrink-0 flex items-center justify-center shadow-md">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative group",
                msg.role === "user"
                  ? "gradient-golden text-primary-foreground rounded-br-lg shadow-lg"
                  : "card-glass text-foreground rounded-bl-lg"
              )}>
                {msg.isCode ? (
                  <div className="relative">
                    <pre className="bg-secondary/50 rounded-xl p-3 text-[11px] font-mono overflow-x-auto whitespace-pre border border-border/30">
                      {msg.content.replace(/```typescript\n?/, "").replace(/```/, "")}
                    </pre>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCopyCode(msg.content.replace(/```typescript\n?/, "").replace(/```/, ""), i)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-secondary/80 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
                    >
                      {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </motion.button>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>
                      ) : (
                        <span key={pi}>{part}</span>
                      )
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-xl bg-secondary flex-shrink-0 flex items-center justify-center">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-start"
          >
            <div className="h-8 w-8 rounded-xl gradient-golden flex-shrink-0 flex items-center justify-center shadow-md">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="card-glass rounded-2xl rounded-bl-lg px-4 py-3">
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
            placeholder="Ask anything about DSA..."
            className="w-full px-4 py-3 pr-12 rounded-xl card-glass text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border border-border/50"
          />
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg gradient-golden text-primary-foreground flex items-center justify-center transition-all shadow-md hover:shadow-lg"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;
