import { useState, useEffect } from "react";
import { Search, ChevronRight, Check, ExternalLink, Star, PlusCircle, Shuffle, Filter, TrendingDown, Clock, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ProgressRing";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

const difficultyColor: Record<string, string> = {
  easy: "bg-success/15 text-success border border-success/20",
  medium: "bg-primary/15 text-primary border border-primary/20",
  hard: "bg-destructive/15 text-destructive border border-destructive/20",
};

import { NotesModal } from "@/components/NotesModal";
import { useApiMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import { CheckCircle, HelpCircle, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TopicsPage = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<{ id: string; title: string } | null>(null);

  const openNotes = (problemId: string, problemTitle: string) => {
    setSelectedProblem({ id: problemId, title: problemTitle });
    setNotesOpen(true);
  };

  // 1. Fetch Topic Progress
  const { data: topicProgress, isLoading: progressLoading } = useApiQuery<any[]>(
    ['topic-progress'],
    '/users/me/progress'
  );

  // 2. Fetch Overall Stats for Sidebar
  const { data: stats, isLoading: statsLoading } = useApiQuery<any>(
    ['user-stats'],
    '/users/me/stats'
  );

  const filteredTopics = topicProgress?.filter((t) =>
    t.topic.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalProblems = stats?.total_problems || topicProgress?.reduce((s, t) => s + t.total, 0) || 0;
  const totalSolved = stats?.total_solved || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Learning Tracks</h1>
        <p className="text-sm text-muted-foreground mt-1">Master Data Structures and Algorithms with structured topic-wise problems.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-4">
          {/* Sticky Filter Bar */}
          <div className="sticky top-0 z-20 card-glass rounded-2xl p-3 -mx-1 px-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-1.5 font-sans">
                <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {(["all", "easy", "medium", "hard"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all duration-200",
                      filter === f
                        ? "gradient-golden text-primary-foreground shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search topics..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border border-border/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {progressLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Progress */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-layer-2 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ProgressRing value={totalSolved} max={totalProblems} size={52} strokeWidth={6} label={`${totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0}%`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Overall Progress</p>
                    <p className="text-xs text-muted-foreground">{totalSolved}/{totalProblems} problems</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-auto">
                  {[
                    { label: "Easy", color: "bg-success", done: stats?.easy_solved || 0, total: stats?.easy_total || 0 },
                    { label: "Medium", color: "bg-primary", done: stats?.medium_solved || 0, total: stats?.medium_total || 0 },
                    { label: "Hard", color: "bg-destructive", done: stats?.hard_solved || 0, total: stats?.hard_total || 0 },
                  ].map((d) => (
                    <span key={d.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("w-2.5 h-2.5 rounded-full", d.color)} /> {d.label} <strong className="text-foreground">{d.done}</strong>/{d.total}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Topics List */}
              <div className="space-y-2.5">
                {filteredTopics.map((topic, ti) => (
                  <TopicRow
                    key={topic.topic}
                    topic={topic}
                    ti={ti}
                    expanded={expanded === topic.topic}
                    onToggle={() => setExpanded(expanded === topic.topic ? null : topic.topic)}
                    onOpenNotes={openNotes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar — Analytics */}
        <div className="space-y-4">
          <div className="card-layer-2 rounded-2xl p-5 sticky top-6">
            <p className="text-sm font-semibold text-foreground mb-4">📊 Progress</p>
            <div className="flex flex-col items-center mb-4">
              <ProgressRing value={totalSolved} max={totalProblems} size={100} strokeWidth={8} label={`${totalSolved}`} sublabel={`/ ${totalProblems}`} />
            </div>
            <div className="space-y-3 mt-4">
              {[
                { label: "Easy", color: "bg-success", done: stats?.easy_solved || 0, total: stats?.easy_total || 0 },
                { label: "Medium", color: "bg-primary", done: stats?.medium_solved || 0, total: stats?.medium_total || 0 },
                { label: "Hard", color: "bg-destructive", done: stats?.hard_solved || 0, total: stats?.hard_total || 0 },
              ].map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("w-2.5 h-2.5 rounded-full", d.color)} /> {d.label}
                    </span>
                    <span className="text-xs font-bold text-foreground tabular-nums">{d.done}/{d.total}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", d.color)}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.total > 0 ? (d.done / d.total) * 100 : 0}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glass rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-3">📈 Topic Mastery</p>
            <div className="space-y-2.5">
              {topicProgress?.slice(0, 5).map((t) => (
                <div key={t.topic} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">{t.topic}</span>
                    <span className="text-[10px] font-bold text-foreground tabular-nums">{t.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${t.progress}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedProblem && (
        <NotesModal
          open={notesOpen}
          onOpenChange={setNotesOpen}
          problemId={selectedProblem.id}
          problemTitle={selectedProblem.title}
        />
      )}
    </div>
  );
};

function TopicRow({ topic, ti, expanded, onToggle, onOpenNotes }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: ti * 0.03 }}
      className="card-glass rounded-2xl overflow-hidden card-hover"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors"
      >
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </motion.div>
        <div className="flex-1 flex items-center gap-3 text-left">
          <span className="text-sm font-semibold text-foreground">{topic.topic}</span>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
            topic.progress >= 70 ? "bg-success/15 text-success" : topic.progress >= 40 ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {topic.progress}%
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-32 h-2.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
            <motion.div
              className="h-full rounded-full"
              style={{ background: topic.progress >= 70 ? "hsl(152,60%,45%)" : topic.progress >= 40 ? "hsl(38,92%,50%)" : "hsl(var(--muted-foreground))" }}
              initial={{ width: 0 }}
              animate={{ width: `${topic.progress}%` }}
              transition={{ duration: 0.8, delay: ti * 0.05 }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-14 text-right font-medium tabular-nums">{topic.solved}/{topic.total}</span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && <TopicProblems topicName={topic.topic} onOpenNotes={onOpenNotes} />}
      </AnimatePresence>
    </motion.div>
  );
}

function TopicProblems({ topicName, onOpenNotes }: { topicName: string; onOpenNotes: (id: string, title: string) => void }) {
  const { data, isLoading, refetch } = useApiQuery<any>(
    ['problems', topicName],
    `/problems?topic=${encodeURIComponent(topicName)}&limit=100`
  );

  const { mutate: updateStatus } = useApiMutation(
    '/status',
    'POST',
    {
      onSuccess: () => {
        refetch();
        toast.success("Status updated");
      },
      onError: () => toast.error("Failed to update status")
    }
  );

  const handleStatusChange = (problemId: string, status: 'solved' | 'tried' | 'revision') => {
    updateStatus({ problem_id: problemId, status });
  };

  const problems = data?.problems || [];

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="border-t border-border/40">
        <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/20">
          <div className="col-span-1">Status</div>
          <div className="col-span-5">Problem</div>
          <div className="col-span-2">Resource</div>
          <div className="col-span-2 text-center">Practice</div>
          <div className="col-span-2 text-right">Difficulty</div>
        </div>
        {problems.length > 0 ? (
          problems.map((problem: any, pi: number) => (
            <div
              key={problem.id}
              className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center border-t border-border/20 hover:bg-secondary/15 transition-all duration-200 group"
            >
              <div className="col-span-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
                      problem.status === 'solved' ? "bg-success border-success shadow-sm" :
                        problem.status === 'tried' ? "bg-orange-500 border-orange-500" :
                          problem.status === 'revision' ? "bg-purple-500 border-purple-500" :
                            "border-border hover:border-primary/50"
                    )}>
                      {problem.status === 'solved' && <Check className="h-3 w-3 text-white" />}
                      {problem.status === 'tried' && <HelpCircle className="h-3 w-3 text-white" />}
                      {problem.status === 'revision' && <RotateCcw className="h-3 w-3 text-white" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleStatusChange(problem.id, 'solved')}>
                      <CheckCircle className="mr-2 h-4 w-4 text-success" /> Solved
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(problem.id, 'tried')}>
                      <HelpCircle className="mr-2 h-4 w-4 text-orange-500" /> Tried
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(problem.id, 'revision')}>
                      <RotateCcw className="mr-2 h-4 w-4 text-purple-500" /> Revision
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
              <div className="col-span-5">
                <p className={cn("text-sm", problem.status === 'solved' ? "text-muted-foreground line-through" : "text-foreground font-medium group-hover:text-primary transition-colors")}>
                  {problem.title}
                </p>
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1 rounded-md bg-secondary hover:bg-muted transition-colors">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Open Resource</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onOpenNotes(problem.id, problem.title)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        problem.has_notes ? "bg-primary/20 text-primary" : "bg-secondary hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{problem.has_notes ? "Edit Notes" : "Add Notes"}</TooltipContent>
                </Tooltip>
              </div>
              <div className="col-span-2 flex justify-center">
                {/* Replaced 'Solve' button with status behavior, but keeping a CTA if needed or removing it as Status covers it. 
                     The user requested "Solve button" so I keep it but maybe it links to the problem? 
                     Actually, the ExternalLink is the resource. The 'Solve' button was just a CTA.
                     I'll keep it as a link to the external resource as well.
                 */}
                <a
                  href={problem.link || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg gradient-golden text-primary-foreground text-[10px] font-semibold transition-all shadow-sm hover:shadow-md block text-center"
                >
                  Solve
                </a>
              </div>
              <div className="col-span-2 text-right">
                <span className={cn("text-[10px] px-2.5 py-1 rounded-lg font-semibold", difficultyColor[problem.difficulty?.toLowerCase()] || "bg-secondary")}>
                  {problem.difficulty}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
            <p className="text-xs text-muted-foreground">No problems found for this topic</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default TopicsPage;
