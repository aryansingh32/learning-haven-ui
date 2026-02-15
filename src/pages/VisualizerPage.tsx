import { Play, Pause, SkipForward, RotateCcw, Code2, BookOpen, Link2, Gauge, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const linkedProblems = [
  { name: "Bubble Sort", difficulty: "Easy" },
  { name: "Merge Sort", difficulty: "Medium" },
  { name: "Quick Sort", difficulty: "Medium" },
  { name: "Heap Sort", difficulty: "Hard" },
];

const codeTabs = [
  { lang: "JavaScript", code: `function bubbleSort(arr) {\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];\n      }\n    }\n  }\n  return arr;\n}` },
  { lang: "Python", code: `def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr` },
  { lang: "Java", code: `void bubbleSort(int[] arr) {\n    int n = arr.length;\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1]) {\n                int temp = arr[j];\n                arr[j] = arr[j + 1];\n                arr[j + 1] = temp;\n            }\n}` },
  { lang: "C++", code: `void bubbleSort(vector<int>& arr) {\n    int n = arr.size();\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1])\n                swap(arr[j], arr[j + 1]);\n}` },
];

const VisualizerPage = () => {
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [bars] = useState([35, 65, 20, 80, 45, 55, 25, 70, 40, 60, 30, 75, 50, 15, 85]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeTabs[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Pattern Visualizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize sorting & searching algorithms step by step</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visualization Area — Bigger Canvas */}
        <div className="lg:col-span-2 card-layer-2 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <p className="text-lg font-bold font-display text-foreground">Bubble Sort</p>
              <p className="text-xs text-muted-foreground">Step 0 of 14 • Comparisons: 0</p>
            </div>
            <div className="flex gap-2">
              <select className="text-xs bg-secondary/60 border border-border/50 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option>Bubble Sort</option>
                <option>Merge Sort</option>
                <option>Quick Sort</option>
                <option>Binary Search</option>
              </select>
              <select className="text-xs bg-secondary/60 border border-border/50 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option>Normal</option>
                <option>Slow</option>
                <option>Fast</option>
              </select>
            </div>
          </div>

          {/* Bars — Larger area */}
          <div className="bg-secondary/20 rounded-2xl p-6 flex items-end justify-center gap-2 h-80 border border-border/30">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className={cn(
                  "rounded-t-lg w-full max-w-[36px] relative group cursor-pointer",
                  i < 2 ? "shadow-lg" : ""
                )}
                style={{
                  height: `${h}%`,
                  background: i < 2
                    ? "linear-gradient(to top, hsl(38,92%,50%), hsl(28,90%,55%))"
                    : i < 4
                    ? "hsl(35,100%,62%)"
                    : "hsl(var(--primary) / 0.15)"
                }}
                whileHover={{ scale: 1.12 }}
                transition={{ duration: 0.15 }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round(h)}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <motion.button whileTap={{ scale: 0.85 }} className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all">
              <RotateCcw className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setPlaying(!playing)}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-lg btn-ripple",
                playing ? "bg-destructive text-destructive-foreground" : "gradient-golden text-primary-foreground hover:shadow-xl"
              )}
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all">
              <SkipForward className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Code Panel with Tabs + Copy */}
          <div className="card-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Code Template</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/60 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                {copied ? <><Check className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
              </motion.button>
            </div>
            <div className="flex gap-1 mb-3">
              {codeTabs.map((tab, i) => (
                <button
                  key={tab.lang}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                    activeTab === i ? "gradient-golden text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {tab.lang}
                </button>
              ))}
            </div>
            <pre className="bg-secondary/30 rounded-xl p-4 text-[11px] text-foreground font-mono overflow-x-auto leading-relaxed border border-border/30">
              {codeTabs[activeTab].code}
            </pre>
          </div>

          {/* Explanation */}
          <div className="card-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">How it Works</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bubble Sort repeatedly swaps adjacent elements if they are in the wrong order.
              The algorithm passes through the list until no swaps are needed.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="card-layer-2 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Time</p>
                </div>
                <p className="text-lg font-bold font-display text-foreground">O(n²)</p>
              </div>
              <div className="card-layer-2 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Space</p>
                </div>
                <p className="text-lg font-bold font-display text-foreground">O(1)</p>
              </div>
            </div>
          </div>

          {/* Linked Problems */}
          <div className="card-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Related Problems</p>
            </div>
            <div className="space-y-1.5">
              {linkedProblems.map((p) => (
                <motion.div
                  key={p.name}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className={cn(
                    "text-[10px] px-2.5 py-0.5 rounded-lg font-semibold",
                    p.difficulty === "Easy" ? "bg-success/15 text-success border border-success/20" : p.difficulty === "Medium" ? "bg-primary/15 text-primary border border-primary/20" : "bg-destructive/15 text-destructive border border-destructive/20"
                  )}>
                    {p.difficulty}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizerPage;
