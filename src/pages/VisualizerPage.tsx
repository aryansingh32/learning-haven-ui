import { Play, Pause, SkipForward, RotateCcw, Code2, BookOpen, Link2, Gauge } from "lucide-react";
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
  const [bars] = useState([35, 65, 20, 80, 45, 55, 25, 70, 40, 60, 30, 75, 50, 15, 85]);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Pattern Visualizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize sorting & searching algorithms step by step</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visualization Area */}
        <div className="lg:col-span-2 card-glass rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <p className="text-lg font-semibold font-display text-foreground">Bubble Sort</p>
              <p className="text-xs text-muted-foreground">Step 0 of 14</p>
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

          {/* Bars */}
          <div className="bg-secondary/30 rounded-2xl p-6 flex items-end justify-center gap-2 h-72">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className={cn(
                  "rounded-t-lg w-full max-w-[36px] relative group cursor-pointer",
                  i < 2 ? "bg-primary shadow-md" : i < 4 ? "bg-accent" : "bg-primary/20"
                )}
                style={{ height: `${h}%` }}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.15 }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round(h)}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all active:scale-95">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </button>
            <button className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all active:scale-95">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Code Panel with Tabs */}
          <div className="card-glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Code Template</p>
            </div>
            <div className="flex gap-1 mb-3">
              {codeTabs.map((tab, i) => (
                <button
                  key={tab.lang}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                    activeTab === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {tab.lang}
                </button>
              ))}
            </div>
            <pre className="bg-secondary/40 rounded-xl p-4 text-[11px] text-foreground font-mono overflow-x-auto leading-relaxed border border-border/30">
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
              <div className="bg-secondary/40 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Time</p>
                </div>
                <p className="text-base font-bold font-display text-foreground">O(n²)</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="h-3 w-3 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Space</p>
                </div>
                <p className="text-base font-bold font-display text-foreground">O(1)</p>
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
                  className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-all cursor-pointer"
                >
                  <span className="text-sm text-foreground">{p.name}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                    p.difficulty === "Easy" ? "bg-success/15 text-success" : p.difficulty === "Medium" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
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
