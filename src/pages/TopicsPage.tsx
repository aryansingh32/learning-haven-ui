import { useState } from "react";
import { Search, ChevronDown, ChevronRight, Check, ExternalLink, StickyNote, Shuffle, Star, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ProgressRing";

const topics = [
  {
    name: "Learn the Basics",
    progress: 75,
    total: 31,
    solved: 23,
    problems: [
      { name: "Input Output", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Cpp Basics", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "If ElseIf", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Switch Case", difficulty: "Easy", solved: false, hasNotes: false },
      { name: "What are arrays, strings?", difficulty: "Easy", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Learn Important Sorting Techniques",
    progress: 60,
    total: 7,
    solved: 4,
    problems: [
      { name: "Selection Sort", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Bubble Sort", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Merge Sort", difficulty: "Medium", solved: false, hasNotes: false },
      { name: "Quick Sort", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Solve Problems on Arrays [Easy → Medium → Hard]",
    progress: 40,
    total: 40,
    solved: 16,
    problems: [
      { name: "Two Sum", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Best Time to Buy & Sell Stock", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Kadane's Algorithm", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Binary Search [1D, 2D Arrays, Search Space]",
    progress: 50,
    total: 32,
    solved: 16,
    problems: [
      { name: "Binary Search", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Search in Rotated Sorted Array", difficulty: "Medium", solved: true, hasNotes: true },
      { name: "Median of Two Sorted Arrays", difficulty: "Hard", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Strings [Basic and Medium]",
    progress: 25,
    total: 15,
    solved: 4,
    problems: [
      { name: "Reverse Words", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Longest Palindromic Substring", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Learn LinkedList [Single LL, Double LL, Medium, Hard Problems]",
    progress: 20,
    total: 31,
    solved: 6,
    problems: [
      { name: "Reverse Linked List", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Merge Two Sorted Lists", difficulty: "Easy", solved: true, hasNotes: false },
    ],
  },
  {
    name: "Recursion [PatternWise]",
    progress: 15,
    total: 25,
    solved: 4,
    problems: [
      { name: "Climbing Stairs", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Subsets", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Dynamic Programming [Patterns]",
    progress: 10,
    total: 56,
    solved: 6,
    problems: [
      { name: "Fibonacci Number", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Coin Change", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
];

const difficultyColor: Record<string, string> = {
  Easy: "bg-success/15 text-success",
  Medium: "bg-primary/15 text-primary",
  Hard: "bg-destructive/15 text-destructive",
};

const totalProblems = topics.reduce((s, t) => s + t.total, 0);
const totalSolved = topics.reduce((s, t) => s + t.solved, 0);
const easyTotal = 132; const easyDone = 0;
const medTotal = 150; const medDone = 0;
const hardTotal = 137; const hardDone = 0;

const TopicsPage = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "revision" | "easy" | "medium" | "hard">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredTopics = topics.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Striver's A2Z Sheet</h1>
        <p className="text-sm text-muted-foreground mt-1">Learn DSA from A to Z in a well-organised and structured manner.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex gap-2">
              {(["all", "revision"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-medium capitalize transition-all border",
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {f === "all" ? "All Problems" : "Revision"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <select className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground">
                <option>All problems</option>
              </select>
              <select className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground">
                <option>Difficulty</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-secondary transition-colors">
                <Shuffle className="h-3.5 w-3.5" /> Random
              </button>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="bg-card rounded-2xl shadow-card border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <ProgressRing value={totalSolved} max={totalProblems} size={52} strokeWidth={6} label={`${Math.round((totalSolved / totalProblems) * 100)}%`} />
              <div>
                <p className="text-sm font-semibold text-foreground">Overall Progress</p>
                <p className="text-xs text-muted-foreground">{totalSolved}/{totalProblems}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 ml-auto">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-success" /> Easy {easyDone}/{easyTotal}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary" /> Medium {medDone}/{medTotal}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-destructive" /> Hard {hardDone}/{hardTotal}
              </span>
            </div>
          </div>

          {/* Topics List */}
          <div className="space-y-2">
            {filteredTopics.map((topic) => (
              <div key={topic.name} className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === topic.name ? null : topic.name)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors"
                >
                  {expanded === topic.name ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <p className="flex-1 text-left text-sm font-medium text-foreground">{topic.name}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-28 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${topic.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{topic.solved} / {topic.total}</span>
                  </div>
                </button>

                {expanded === topic.name && (
                  <div className="border-t border-border">
                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/40">
                      <div className="col-span-1">Status</div>
                      <div className="col-span-4">Problem</div>
                      <div className="col-span-2">Resource</div>
                      <div className="col-span-1 text-center">Practice</div>
                      <div className="col-span-1 text-center">Note</div>
                      <div className="col-span-1 text-center">Revision</div>
                      <div className="col-span-2 text-right">Difficulty</div>
                    </div>
                    {topic.problems.map((problem) => (
                      <div
                        key={problem.name}
                        className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center border-t border-border/40 hover:bg-secondary/20 transition-colors"
                      >
                        <div className="col-span-1">
                          <div className={cn(
                            "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer",
                            problem.solved ? "bg-success border-success" : "border-border hover:border-primary/50"
                          )}>
                            {problem.solved && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                        <div className="col-span-4">
                          <p className={cn("text-sm", problem.solved ? "text-muted-foreground" : "text-foreground font-medium")}>
                            {problem.name}
                          </p>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <button className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-opacity">
                            Solve
                          </button>
                          <button className="p-1 rounded-md bg-secondary hover:bg-muted transition-colors">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="col-span-1 text-center text-muted-foreground">---</div>
                        <div className="col-span-1 flex justify-center">
                          <button className="p-1 rounded-md hover:bg-secondary transition-colors">
                            <PlusCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                          </button>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button className="p-1 rounded-md hover:bg-secondary transition-colors">
                            <Star className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                          </button>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-semibold", difficultyColor[problem.difficulty])}>
                            {problem.difficulty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Progress Panel */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl shadow-card border border-border p-5 sticky top-6">
            <p className="text-sm font-semibold text-foreground mb-4">Progress</p>
            <div className="flex flex-col items-center mb-4">
              <ProgressRing value={totalSolved} max={totalProblems} size={100} strokeWidth={8} label={`${totalSolved}`} sublabel={`/ ${totalProblems}`} />
            </div>
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-success" /> Easy
                </span>
                <span className="text-xs font-semibold text-foreground">{easyDone}/{easyTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Medium
                </span>
                <span className="text-xs font-semibold text-foreground">{medDone}/{medTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-destructive" /> Hard
                </span>
                <span className="text-xs font-semibold text-foreground">{hardDone}/{hardTotal}</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Calendar + Roadmap</p>
            <div className="h-20 rounded-xl bg-secondary flex items-center justify-center text-xs text-muted-foreground">Coming Soon</div>
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Sessions</p>
            <div className="h-20 rounded-xl bg-secondary flex items-center justify-center text-xs text-muted-foreground">Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicsPage;
