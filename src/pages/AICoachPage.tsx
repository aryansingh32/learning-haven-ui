import { useState } from "react";
import { Send, Mic, Bot, User, Lightbulb, Bug, HelpCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: "Explain", icon: Lightbulb },
  { label: "Debug", icon: Bug },
  { label: "Hint", icon: HelpCircle },
  { label: "Summarize", icon: FileText },
];

const AICoachPage = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "That's a great question! Let me think about the best approach for this problem..." },
      ]);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)] animate-fade-in">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground">AI Coach</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal DSA mentor</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => setInput(`${action.label} this concept`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors shadow-card"
          >
            <action.icon className="h-3.5 w-3.5 text-primary" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full gradient-golden flex-shrink-0 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border text-foreground rounded-bl-md shadow-card"
            )}>
              {msg.isCode ? (
                <pre className="bg-foreground/5 rounded-xl p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                  {msg.content.replace(/```typescript\n?/, "").replace(/```/, "")}
                </pre>
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
              <div className="h-8 w-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <button className="h-11 w-11 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors flex-shrink-0">
          <Mic className="h-5 w-5" />
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything about DSA..."
            className="w-full px-4 py-3 pr-12 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;
