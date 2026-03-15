import { useMemo } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight, CheckCircle2, Clock, Flame, Lock,
  Brain, Timer, Grid, Type, LayoutGrid, GitMerge, Maximize2, RefreshCw, Search, ArrowDownUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { phaseOne } from "@/data/chapters";

const difficultyStyles: Record<string, string> = {
  easy: "bg-success/10 text-success border border-success/20",
  medium: "bg-primary/10 text-primary border border-primary/20",
  hard: "bg-destructive/10 text-destructive border border-destructive/20",
};

const iconMap: Record<string, any> = {
  Brain, Timer, Grid, Type, LayoutGrid, GitMerge, Maximize2, RefreshCw, Search, ArrowDownUp
};

export default function ChaptersOverviewPage() {
  const navigate = useNavigate();

  const activeIndex = useMemo(
    () => phaseOne.missions.findIndex(m => !m.locked && m.completedSteps < m.totalSteps),
    []
  );
  const safeActiveIndex = activeIndex === -1 ? phaseOne.missions.length : activeIndex;
  const nextMission = phaseOne.missions[safeActiveIndex];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
      <section className="rounded-2xl card-layer-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground font-bold">Phase 1</p>
            <h1 className="font-display text-2xl font-extrabold text-foreground">{phaseOne.title}</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{phaseOne.description}</p>
          </div>
          {nextMission && (
            <button
              onClick={() => navigate(`/chapter/${nextMission.id}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 shadow-md text-white px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5"
            >
              Continue Chapter <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>{phaseOne.missionsCompleted} of {phaseOne.missionsTotal} chapters completed</span>
            <span className="text-orange-500">{phaseOne.progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${phaseOne.progressPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="relative rounded-2xl card-layer-2 p-4 sm:p-8">
        <div className="space-y-6 relative">
          {/* Continuous background line */}
          <div className="absolute left-[22px] top-10 bottom-24 w-1 bg-border/60 rounded-full hidden sm:block" />
          {/* Active filled line */}
          <motion.div 
            className="absolute left-[22px] top-10 w-1 bg-orange-500 origin-top rounded-full z-[5] hidden sm:block"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: safeActiveIndex / Math.max(1, phaseOne.missions.length - 1) }}
            transition={{ duration: 1, delay: 0.2 }}
          />

          {phaseOne.missions.map((mission, index) => {
            const isComplete = index < safeActiveIndex;
            const isActuallyActive = index === safeActiveIndex;
            const statusLabel = isComplete ? "Completed" : mission.locked ? "Coming soon" : "Active";
            
            const IconComponent = iconMap[mission.icon || 'Grid'] || Grid;

            return (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex gap-4 sm:gap-6 relative z-10 group"
              >
                {/* Dot Container */}
                <div className="w-12 shrink-0 hidden sm:flex items-start justify-center pt-8">
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
                </div>
                
                {/* Card */}
                <div
                  onClick={() => !mission.locked && navigate(`/chapter/${mission.id}`)}
                  className={cn(
                    "flex-1 rounded-2xl border p-5 sm:p-6 transition-all duration-300 relative overflow-hidden",
                    isActuallyActive
                      ? "bg-[#111111] border-orange-500/40 shadow-xl scale-[1.02] cursor-pointer hover:-translate-y-1 hover:shadow-2xl ring-1 ring-orange-500/20"
                      : mission.locked
                        ? "bg-background/20 backdrop-blur-sm border-border/20 text-muted-foreground opacity-60 cursor-not-allowed grayscale-[0.3]"
                        : "bg-background/80 border-border/60 cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:bg-background"
                  )}
                >
                  {/* Subtle Glow for Active */}
                  {isActuallyActive && <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(249,115,22,0.1),transparent_50%)] pointer-events-none" />}

                  {mission.locked && (
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                        <Lock className="w-32 h-32" />
                     </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                    <div className="flex gap-4">
                       <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
                          isComplete ? "bg-orange-500/10 text-orange-500" :
                          isActuallyActive ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]" :
                          "bg-secondary/80 text-muted-foreground"
                       )}>
                          <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                       </div>
                       <div className="flex flex-col justify-center">
                         <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                           Chapter {mission.order}
                         </p>
                         <h3 className={cn("text-lg sm:text-xl font-display font-extrabold tracking-tight", isActuallyActive ? "text-white" : mission.locked ? "text-muted-foreground" : "text-foreground")}>{mission.title}</h3>
                         <p className={cn("text-sm mt-1 max-w-xl", isActuallyActive ? "text-white/70" : mission.locked ? "text-muted-foreground/60" : "text-muted-foreground")}>{mission.concept}</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider",
                         isComplete ? "bg-success/10 text-success" :
                         isActuallyActive ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                         "bg-secondary text-muted-foreground"
                      )}>
                        {statusLabel}
                      </span>
                      {!mission.locked && (
                         <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase border", difficultyStyles[mission.difficulty])}>
                           {mission.difficulty.toUpperCase()}
                         </span>
                      )}
                    </div>
                  </div>

                  {!mission.locked && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 relative z-10">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border", isActuallyActive ? "bg-white/5 border-white/10 text-white/90" : "bg-background border-border text-foreground")}>
                          <CheckCircle2 className="h-4 w-4" /> {mission.completedSteps}/{mission.totalSteps} steps
                        </span>
                        <span className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 px-3 py-1.5 rounded-lg">
                          <Flame className="h-4 w-4" /> +{mission.reward.xp} XP
                        </span>
                        <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border", isActuallyActive ? "bg-white/5 border-white/10 text-white/90" : "bg-background border-border text-foreground")}>
                          <Clock className="h-4 w-4" /> ~{mission.timeMinutes} min
                        </span>
                      </div>
                      
                      <button
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-sm",
                          isComplete
                            ? "bg-secondary hover:bg-secondary/80 text-foreground"
                            : "bg-orange-500 hover:bg-orange-600 text-white hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(249,115,22,0.3)]"
                        )}
                      >
                        {isComplete ? "Review Chapter" : "Start Your Journey"} <ArrowRight className="h-4 w-4" />
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
        </div>
      </section>
    </div>
  );
}
