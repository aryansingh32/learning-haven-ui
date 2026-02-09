import { useState } from "react";
import { Search, Filter, ChevronDown, ChevronRight, Check, ExternalLink, StickyNote, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const topics = [
  {
    name: "Arrays & Hashing",
    progress: 75,
    total: 20,
    solved: 15,
    problems: [
      { name: "Two Sum", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Contains Duplicate", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Valid Anagram", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Group Anagrams", difficulty: "Medium", solved: false, hasNotes: false },
      { name: "Top K Frequent Elements", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Two Pointers",
    progress: 60,
    total: 12,
    solved: 7,
    problems: [
      { name: "Valid Palindrome", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "3Sum", difficulty: "Medium", solved: true, hasNotes: true },
      { name: "Container With Most Water", difficulty: "Medium", solved: false, hasNotes: false },
      { name: "Trapping Rain Water", difficulty: "Hard", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Sliding Window",
    progress: 40,
    total: 10,
    solved: 4,
    problems: [
      { name: "Best Time to Buy & Sell Stock", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Longest Substring Without Repeating", difficulty: "Medium", solved: true, hasNotes: false },
      { name: "Minimum Window Substring", difficulty: "Hard", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Stack",
    progress: 30,
    total: 8,
    solved: 2,
    problems: [
      { name: "Valid Parentheses", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Min Stack", difficulty: "Medium", solved: true, hasNotes: false },
      { name: "Largest Rectangle in Histogram", difficulty: "Hard", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Binary Search",
    progress: 50,
    total: 10,
    solved: 5,
    problems: [
      { name: "Binary Search", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Search in Rotated Sorted Array", difficulty: "Medium", solved: true, hasNotes: true },
      { name: "Median of Two Sorted Arrays", difficulty: "Hard", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Trees",
    progress: 25,
    total: 16,
    solved: 4,
    problems: [
      { name: "Invert Binary Tree", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Maximum Depth of Binary Tree", difficulty: "Easy", solved: true, hasNotes: false },
      { name: "Validate BST", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
  {
    name: "Dynamic Programming",
    progress: 15,
    total: 20,
    solved: 3,
    problems: [
      { name: "Climbing Stairs", difficulty: "Easy", solved: true, hasNotes: true },
      { name: "Coin Change", difficulty: "Medium", solved: false, hasNotes: false },
      { name: "Longest Increasing Subsequence", difficulty: "Medium", solved: false, hasNotes: false },
    ],
  },
];

const difficultyColor: Record<string, string> = {
  Easy: "bg-success/10 text-success",
  Medium: "bg-primary/10 text-primary",
  Hard: "bg-destructive/10 text-destructive",
};

const TopicsPage = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "revision" | "easy" | "medium" | "hard">("all");
  const [expanded, setExpanded] = useState<string | null>(topics[0].name);

  const filteredTopics = topics.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">DSA Topics</h1>
        <p className="text-sm text-muted-foreground mt-1">Striver's A2Z DSA Sheet</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "revision", "easy", "medium", "hard"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-medium capitalize transition-all",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {f === "all" ? "All Problems" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Topics List */}
      <div className="space-y-3">
        {filteredTopics.map((topic) => (
          <div key={topic.name} className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === topic.name ? null : topic.name)}
              className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors"
            >
              {expanded === topic.name ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 text-left">
                <p className="font-medium text-sm text-foreground">{topic.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{topic.solved}/{topic.total} solved</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${topic.progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground w-10 text-right">{topic.progress}%</span>
              </div>
            </button>

            {expanded === topic.name && (
              <div className="border-t border-border">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-secondary/50">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-5">Problem</div>
                  <div className="col-span-2">Difficulty</div>
                  <div className="col-span-4 text-right">Actions</div>
                </div>
                {topic.problems.map((problem) => (
                  <div
                    key={problem.name}
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="col-span-1">
                      <div className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors",
                        problem.solved ? "bg-success border-success" : "border-border"
                      )}>
                        {problem.solved && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    <div className="col-span-5">
                      <p className={cn("text-sm", problem.solved ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
                        {problem.name}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", difficultyColor[problem.difficulty])}>
                        {problem.difficulty}
                      </span>
                    </div>
                    <div className="col-span-4 flex items-center justify-end gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                        Solve
                      </button>
                      <button className="p-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors">
                        <StickyNote className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopicsPage;
