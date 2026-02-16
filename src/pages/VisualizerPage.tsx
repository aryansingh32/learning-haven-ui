import { Play, Pause, SkipForward, RotateCcw, Code2, BookOpen, Link2, Gauge, Copy, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

const VisualizerPage = () => {
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("Arrays & Hashing");
  const [bars] = useState([35, 65, 20, 80, 45, 55, 25, 70, 40, 60, 30, 75, 50, 15, 85]);

  // 1. Fetch Problems for the selected topic to show as "Related Problems"
  const { data: problems, isLoading: problemsLoading } = useApiQuery<any[]>(
    ['problems', selectedTopic],
    `/problems?topic=${encodeURIComponent(selectedTopic)}&limit=5`
  );

  const activeProblem = problems?.[0] || {
    title: "Bubble Sort",
    difficulty: "Easy",
    description: "Bubble Sort repeatedly swaps adjacent elements if they are in the wrong order.",
    time_complexity: "O(n²)",
    space_complexity: "O(1)",
    templates: {
      javascript: `function bubbleSort(arr) {\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];\n      }\n    }\n  }\n  return arr;\n}`,
      python: `def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr`,
      java: `void bubbleSort(int[] arr) {\n    int n = arr.length;\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1]) {\n                int temp = arr[j];\n                arr[j] = arr[j + 1];\n                arr[j + 1] = temp;\n            }\n}`,
      cpp: `void bubbleSort(vector<int>& arr) {\n    int n = arr.size();\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1])\n                swap(arr[j], arr[j + 1]);\n}`
    }
  };

  const codeEntries = Object.entries(activeProblem.templates || {}).map(([lang, code]) => ({ lang, code: code as string }));
  const currentCode = codeEntries[activeTab]?.code || "// No template available";

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (problemsLoading && !problems) {
    return (
      <div className="max-w-7xl mx-auto space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-[500px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Pattern Visualizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize patterns & algorithms step by step</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visualization Area */}
        <div className="lg:col-span-2 card-layer-2 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <p className="text-lg font-bold font-display text-foreground">{activeProblem.title}</p>
              <p className="text-xs text-muted-foreground">Pattern Visualization • Step 0 • Comparisons: 0</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="text-xs bg-secondary/60 border border-border/50 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>Arrays & Hashing</option>
                <option>Two Pointers</option>
                <option>Sliding Window</option>
                <option>Stack</option>
                <option>Binary Search</option>
              </select>
              <select className="text-xs bg-secondary/60 border border-border/50 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option>Speed: Normal</option>
                <option>Speed: Slow</option>
                <option>Speed: Fast</option>
              </select>
            </div>
          </div>

          {/* Bars */}
          <div className="bg-secondary/20 rounded-2xl p-6 flex items-end justify-center gap-2 h-80 border border-border/30 relative overflow-hidden group">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className={cn(
                  "rounded-t-lg w-full max-w-[36px] relative cursor-pointer",
                  i < 2 ? "shadow-lg shadow-primary/20" : ""
                )}
                style={{
                  height: `${h}%`,
                  background: i < 2
                    ? "linear-gradient(to top, hsl(38,92%,50%), hsl(28,90%,55%))"
                    : i < 4
                      ? "hsl(35,100%,62%)"
                      : "hsl(var(--primary) / 0.15)"
                }}
                whileHover={{ scale: 1.1, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
                  {Math.round(h)}
                </span>
              </motion.div>
            ))}
            {playing && (
              <div className="absolute inset-0 bg-primary/2 flex items-center justify-center pointer-events-none">
                {/* Visualizer running indicator could go here */}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <motion.button whileTap={{ scale: 0.85 }} className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all border border-border/40">
              <RotateCcw className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setPlaying(!playing)}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-lg btn-ripple",
                playing ? "bg-destructive text-destructive-foreground shadow-destructive/20" : "gradient-golden text-primary-foreground hover:shadow-xl"
              )}
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all border border-border/40">
              <SkipForward className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Code Panel */}
          <div className="card-glass rounded-2xl p-5 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Reference Code</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/60 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                {copied ? <><Check className="h-3.5 w-3.5 text-success" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </motion.button>
            </div>
            <div className="flex gap-1 mb-3 overflow-x-auto pb-1 no-scrollbar">
              {codeEntries.length > 0 ? codeEntries.map((tab, i) => (
                <button
                  key={tab.lang}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap",
                    activeTab === i ? "gradient-golden text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {tab.lang.toUpperCase()}
                </button>
              )) : (
                <div className="text-[10px] text-muted-foreground italic">No templates available</div>
              )}
            </div>
            <pre className="bg-background/40 rounded-xl p-4 text-[11px] text-foreground font-mono overflow-x-auto leading-relaxed border border-border/20 max-h-[200px]">
              {currentCode}
            </pre>
          </div>

          {/* Explanation */}
          <div className="card-glass rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Complexity Analysis</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {activeProblem.description || "Learn how this pattern works through step-by-step visualization and complexity analysis."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="card-layer-2 rounded-xl p-3 text-center border border-border/40">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Time</p>
                </div>
                <p className="text-sm font-bold font-display text-foreground">{activeProblem.time_complexity || "O(N)"}</p>
              </div>
              <div className="card-layer-2 rounded-xl p-3 text-center border border-border/40">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Space</p>
                </div>
                <p className="text-sm font-bold font-display text-foreground">{activeProblem.space_complexity || "O(1)"}</p>
              </div>
            </div>
          </div>

          {/* Linked Problems */}
          <div className="card-glass rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Practice Problems</p>
            </div>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
              {problems?.map((p) => (
                <motion.div
                  key={p.id}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all cursor-pointer border border-border/10"
                >
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{p.title}</span>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase",
                    p.difficulty.toLowerCase() === "easy" ? "bg-success/15 text-success border border-success/20" :
                      p.difficulty.toLowerCase() === "medium" ? "bg-primary/15 text-primary border border-primary/20" :
                        "bg-destructive/15 text-destructive border border-destructive/20"
                  )}>
                    {p.difficulty}
                  </span>
                </motion.div>
              ))}
              {(!problems || problems.length === 0) && (
                <div className="text-[10px] text-muted-foreground italic text-center py-4">No related problems found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizerPage;
