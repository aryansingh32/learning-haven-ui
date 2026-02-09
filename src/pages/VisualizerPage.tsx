import { Play, Pause, SkipForward, RotateCcw, Code2, BookOpen, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const linkedProblems = [
  { name: "Bubble Sort", difficulty: "Easy" },
  { name: "Merge Sort", difficulty: "Medium" },
  { name: "Quick Sort", difficulty: "Medium" },
  { name: "Heap Sort", difficulty: "Hard" },
];

const codeTemplate = `function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}`;

const VisualizerPage = () => {
  const [playing, setPlaying] = useState(false);
  const [bars] = useState([35, 65, 20, 80, 45, 55, 25, 70, 40, 60, 30, 75, 50, 15, 85]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pattern Visualizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize sorting & searching algorithms</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visualization Area */}
        <div className="lg:col-span-2 bg-card rounded-2xl shadow-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">Bubble Sort</p>
            <div className="flex gap-2">
              <select className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
                <option>Bubble Sort</option>
                <option>Merge Sort</option>
                <option>Quick Sort</option>
                <option>Binary Search</option>
              </select>
              <select className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
                <option>Speed: Normal</option>
                <option>Speed: Slow</option>
                <option>Speed: Fast</option>
              </select>
            </div>
          </div>

          {/* Bars */}
          <div className="bg-secondary/50 rounded-xl p-6 flex items-end justify-center gap-1.5 h-64">
            {bars.map((h, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-t-md transition-all duration-300 w-full max-w-[32px]",
                  i < 3 ? "bg-primary" : i < 5 ? "bg-accent" : "bg-primary/40"
                )}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => {}}
              className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-colors">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Code Panel */}
          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code Template</p>
            </div>
            <pre className="bg-foreground/5 rounded-xl p-4 text-xs text-foreground font-mono overflow-x-auto leading-relaxed">
              {codeTemplate}
            </pre>
          </div>

          {/* Explanation */}
          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Explanation</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Bubble Sort repeatedly swaps adjacent elements if they are in the wrong order. 
              The algorithm passes through the list until no swaps are needed.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-secondary rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Time</p>
                <p className="text-sm font-bold font-display text-foreground">O(n²)</p>
              </div>
              <div className="bg-secondary rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Space</p>
                <p className="text-sm font-bold font-display text-foreground">O(1)</p>
              </div>
            </div>
          </div>

          {/* Linked Problems */}
          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related Problems</p>
            </div>
            <div className="space-y-2">
              {linkedProblems.map((p) => (
                <div key={p.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary">
                  <span className="text-sm text-foreground">{p.name}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                    p.difficulty === "Easy" ? "bg-success/10 text-success" : p.difficulty === "Medium" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  )}>
                    {p.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizerPage;
