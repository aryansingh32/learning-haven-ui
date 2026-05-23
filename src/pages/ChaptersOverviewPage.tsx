import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Clock, Flame, Lock,
  Brain, Timer, Grid, Type, LayoutGrid, GitMerge, Maximize2, RefreshCw, Search, ArrowDownUp, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLearnRoadmap } from "@/hooks/useLearnRoadmap";

const difficultyStyles: Record<string, string> = {
  easy: "bg-success/10 text-success border border-success/20",
  medium: "bg-primary/10 text-primary border border-primary/20",
  hard: "bg-destructive/10 text-destructive border border-destructive/20",
  beginner: "bg-success/10 text-success border border-success/20",
  intermediate: "bg-primary/10 text-primary border border-primary/20",
  advanced: "bg-destructive/10 text-destructive border border-destructive/20",
};

const iconMap: Record<string, typeof Grid> = {
  Brain, Timer, Grid, Type, LayoutGrid, GitMerge, Maximize2, RefreshCw, Search, ArrowDownUp,
  variables: Brain, loops: RefreshCw, functions: LayoutGrid, arrays: Grid,
};

function normalizeDifficulty(d?: string) {
  if (!d) return "medium";
  return d.toLowerCase();
}

export default function ChaptersOverviewPage() {
  const navigate = useNavigate();
  const { roadmap, chapters, isLoading, completedCount, progressPercent, activeChapter } = useLearnRoadmap();

  const missions = useMemo(
    () =>
      chapters.map((ch) => ({
        id: ch.id,
        order: ch.chapter_number,
        title: ch.title,
        concept: ch.topic_tag || ch.story_hook || "Master this topic step by step",
        locked: ch.status === "LOCKED",
        completedSteps: ch.completed_steps,
        totalSteps: ch.total_steps || 1,
        timeMinutes: ch.est_minutes ? Math.round(ch.est_minutes / 60) : 30,
        difficulty: normalizeDifficulty(ch.difficulty),
        icon: ch.topic_tag || "Grid",
        status: ch.status,
        reward: { xp: 100 + ch.chapter_number * 25 },
      })),
    [chapters]
  );

  const activeIndex = useMemo(
    () => missions.findIndex((m) => !m.locked && m.completedSteps < m.totalSteps && m.status !== "COMPLETED"),
    [missions]
  );
  const safeActiveIndex = activeIndex === -1 ? missions.length : activeIndex;
  const nextMission = missions[safeActiveIndex];

  if (isLoading) {
    return (
      <motion.div
        className="flex min-h-[40vh] items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </motion.div>
    );
  }

  const phaseTitle = roadmap?.title || "Learning Path";
  const phaseDescription = roadmap?.description || "Complete chapters in order to unlock the next.";

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <section className="rounded-2xl card-layer-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground font-bold">Learn</p>
            <h1 className="font-display text-2xl font-extrabold text-foreground">{phaseTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{phaseDescription}</p>
          </div>
          {nextMission && (
            <button
              type="button"
              onClick={() => navigate(`/chapter/${nextMission.id}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 shadow-md text-white px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5"
            >
              Continue Chapter <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-5">
          <motion.div
            className="flex items-center justify-between text-xs font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span>{completedCount} of {missions.length} chapters completed</span>
            <span className="text-orange-500">{progressPercent}%</span>
          </motion.div>
          <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>
      </section>

      {missions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No chapters published for this roadmap yet. Add them from the admin Chapters panel.
        </div>
      ) : (
        <section className="relative rounded-2xl card-layer-2 p-4 sm:p-8">
          <motion.div className="space-y-6 relative">
            <div className="absolute left-[22px] top-10 bottom-24 w-1 bg-border/60 rounded-full hidden sm:block" />
            <motion.div
              className="absolute left-[22px] top-10 w-1 bg-orange-500 origin-top rounded-full z-[5] hidden sm:block"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: safeActiveIndex / Math.max(1, missions.length - 1) }}
              transition={{ duration: 1, delay: 0.2 }}
            />

            {missions.map((mission, index) => {
              const isComplete = mission.status === "COMPLETED" || index < safeActiveIndex;
              const isActuallyActive = index === safeActiveIndex && !mission.locked;
              const statusLabel = isComplete ? "Completed" : mission.locked ? "Locked" : "Active";
              const IconComponent = iconMap[mission.icon] || Grid;

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex gap-4 sm:gap-6 relative z-10 group"
                >
                  <motion.div className="w-12 shrink-0 hidden sm:flex items-start justify-center pt-8">
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 z-10 transition-all duration-300",
                        isComplete
                          ? "bg-orange-500 border-orange-500"
                          : isActuallyActive
                            ? "bg-orange-500 border-background shadow-[0_0_0_4px_rgba(249,115,22,0.3)] ring-2 ring-orange-500 scale-125"
                            : "bg-background border-border/80"
                      )}
                    />
                  </motion.div>

                  <div
                    role="button"
                    tabIndex={mission.locked ? -1 : 0}
                    onClick={() => !mission.locked && navigate(`/chapter/${mission.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && !mission.locked && navigate(`/chapter/${mission.id}`)}
                    className={cn(
                      "flex-1 rounded-2xl border p-5 sm:p-6 transition-all duration-300 relative overflow-hidden",
                      isActuallyActive
                        ? "bg-[#111111] border-orange-500/40 shadow-xl scale-[1.02] cursor-pointer hover:-translate-y-1 hover:shadow-2xl ring-1 ring-orange-500/20"
                        : mission.locked
                          ? "bg-background/20 backdrop-blur-sm border-border/20 text-muted-foreground opacity-60 cursor-not-allowed grayscale-[0.3]"
                          : "bg-background/80 border-border/60 cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:bg-background"
                    )}
                  >
                    {mission.locked && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                        <Lock className="w-32 h-32" />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                      <div className="flex gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
                            isComplete ? "bg-orange-500/10 text-orange-500" :
                            isActuallyActive ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]" :
                            "bg-secondary/80 text-muted-foreground"
                          )}
                        >
                          <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                            Chapter {mission.order}
                          </p>
                          <h3 className={cn(
                            "text-lg sm:text-xl font-display font-extrabold tracking-tight",
                            isActuallyActive ? "text-white" : mission.locked ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {mission.title}
                          </h3>
                          <p className={cn(
                            "text-sm mt-1 max-w-xl",
                            isActuallyActive ? "text-white/70" : mission.locked ? "text-muted-foreground/60" : "text-muted-foreground"
                          )}>
                            {mission.concept}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={cn(
                          "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider",
                          isComplete ? "bg-success/10 text-success" :
                          isActuallyActive ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {statusLabel}
                        </span>
                        {!mission.locked && (
                          <span className={cn(
                            "text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase border",
                            difficultyStyles[mission.difficulty] || difficultyStyles.medium
                          )}>
                            {mission.difficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    {!mission.locked && (
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 relative z-10">
                        <motion.div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
                            isActuallyActive ? "bg-white/5 border-white/10 text-white/90" : "bg-background border-border text-foreground"
                          )}>
                            <CheckCircle2 className="h-4 w-4" /> {mission.completedSteps}/{mission.totalSteps} steps
                          </span>
                          <span className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 px-3 py-1.5 rounded-lg">
                            <Flame className="h-4 w-4" /> +{mission.reward.xp} XP
                          </span>
                          <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
                            isActuallyActive ? "bg-white/5 border-white/10 text-white/90" : "bg-background border-border text-foreground"
                          )}>
                            <Clock className="h-4 w-4" /> ~{mission.timeMinutes} min
                          </span>
                        </motion.div>

                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-sm",
                            isComplete
                              ? "bg-secondary hover:bg-secondary/80 text-foreground"
                              : "bg-orange-500 hover:bg-orange-600 text-white hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(249,115,22,0.3)]"
                          )}
                        >
                          {isComplete ? "Review Chapter" : "Start"} <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {mission.locked && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest relative z-10">
                        <Lock className="w-3.5 h-3.5" /> Finish previous chapters to unlock
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {activeChapter && (
        <p className="text-xs text-muted-foreground text-center">
          Current: {activeChapter.title} ({activeChapter.status})
        </p>
      )}
    </motion.div>
  );
}
