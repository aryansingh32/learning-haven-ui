import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { phaseOne } from "@/data/chapters";

const difficultyStyles: Record<string, string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  hard: "bg-destructive/15 text-destructive",
};

export default function ChaptersOverviewPage() {
  const navigate = useNavigate();

  const nextMission = useMemo(
    () =>
      phaseOne.missions.find(
        (mission) => !mission.locked && mission.completedSteps < mission.totalSteps
      ),
    []
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <section className="rounded-2xl bg-foreground text-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-background/10 text-background/70">
              <Sparkles className="h-3.5 w-3.5" /> Phase 1
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-background">{phaseOne.title}</h1>
            <p className="text-xs text-background/70 mt-1">{phaseOne.subtitle}</p>
          </div>
          {nextMission && (
            <button
              className="inline-flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground rounded-2xl px-3 py-1.5"
              onClick={() => navigate(`/chapter/${nextMission.id}`)}
            >
              Resume Chapter <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl card-layer-2 p-5">
        <div className="relative">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_hsl(38_92%_50%_/_0.2),_transparent_60%)]" />
          <div className="relative z-10 max-h-[420px] overflow-y-auto pr-2 space-y-5">
            <div className="absolute left-1/2 top-6 bottom-6 w-0.5 bg-border/60" />
            {phaseOne.missions.map((mission, index) => {
              const isCurrent = !mission.locked && mission.completedSteps < mission.totalSteps;
              const isComplete = mission.completedSteps === mission.totalSteps;
              const isLeft = index % 2 === 0;

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn("flex", isLeft ? "justify-start" : "justify-end")}
                >
                  <div className="relative w-full md:w-[48%]">
                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        isCurrent
                          ? "bg-primary/10 border-primary/40 shadow-glow"
                          : isComplete
                            ? "bg-background/90 border-success/40"
                            : mission.locked
                              ? "bg-secondary/40 border-border/50 text-muted-foreground"
                              : "bg-background/80 border-border/60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          Chapter {mission.order}
                        </p>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : mission.locked ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            Active
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-foreground">{mission.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1">{mission.concept}</p>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {mission.completedSteps}/{mission.totalSteps} steps
                        </span>
                        <span className="flex items-center gap-1">
                          {mission.reward.xp} XP
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                            difficultyStyles[mission.difficulty]
                          )}
                        >
                          {mission.difficulty.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/chapter/${mission.id}`)}
                        className={cn(
                          "mt-3 inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[11px] font-semibold",
                          mission.locked
                            ? "bg-secondary text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-primary-foreground"
                        )}
                        disabled={mission.locked}
                      >
                        {mission.locked ? "Locked" : "Open Chapter"} <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
