import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, animate } from "framer-motion";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Flame,
  Lock,
  Play,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMissionById, phaseOne } from "@/data/chapters";
import { useAuth } from "@/context/AuthContext";

const difficultyStyles: Record<string, string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  hard: "bg-destructive/15 text-destructive",
};

export default function ChapterPage() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.full_name || "Student";
  const mission = useMemo(() => getMissionById(chapterId || ""), [chapterId]);

  const [started, setStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [quizState, setQuizState] = useState({
    current: 0,
    score: 0,
    answered: false,
    selected: -1,
    done: false,
    passed: false,
  });
  const [practiceSolved, setPracticeSolved] = useState<Record<string, boolean>>({});
  const [displayXp, setDisplayXp] = useState(0);

  useEffect(() => {
    if (showCelebration) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.1, x: 0.5 },
        colors: ['#f97316', '#eab308']
      });

      const controls = animate(0, mission?.reward?.xp || 0, {
        duration: 2,
        onUpdate: (value) => setDisplayXp(Math.floor(value)),
      });
      return controls.stop;
    }
  }, [showCelebration, mission?.reward?.xp]);

  if (!mission) {
    return (
      <div className="max-w-7xl mx-auto card-layer-2 rounded-2xl p-6 text-center">
        <p className="text-lg font-semibold text-foreground">Chapter not found</p>
        <p className="text-sm text-muted-foreground mt-2">Choose a chapter from the roadmap.</p>
        <button
          onClick={() => navigate("/chapters")}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          Back to Roadmap <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const steps = mission.steps;
  const shareText = `I just completed Chapter ${mission.order}: ${mission.title} on DSA OS!`;

  const isUnlocked = (index: number) => index === 0 || completedSteps.includes(steps[index - 1].id);
  const isCompleted = (id: string) => completedSteps.includes(id);

  const completeStep = (id: string, index: number) => {
    if (!isUnlocked(index)) return;
    setCompletedSteps((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (index + 1 < steps.length) {
      setActiveStepIndex(index + 1);
    } else {
      setShowCelebration(true);
    }
  };

  const handleQuizAnswer = (correctIndex: number, selectedIndex: number) => {
    if (quizState.answered) return;
    const isCorrect = selectedIndex === correctIndex;
    setQuizState((prev) => ({
      ...prev,
      answered: true,
      selected: selectedIndex,
      score: isCorrect ? prev.score + 1 : prev.score,
    }));
  };

  const handleQuizNext = () => {
    if (quizState.current + 1 >= (steps.find((s) => s.type === "quiz")?.quizQuestions?.length || 0)) {
      const total = steps.find((s) => s.type === "quiz")?.quizQuestions?.length || 0;
      const passed = quizState.score >= Math.max(2, Math.ceil(total * 0.6));
      setQuizState((prev) => ({ ...prev, done: true, passed }));
      return;
    }
    setQuizState((prev) => ({
      ...prev,
      current: prev.current + 1,
      answered: false,
      selected: -1,
    }));
  };

  const quizStep = steps.find((s) => s.type === "quiz");
  const quizQuestions = quizStep?.quizQuestions || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
      {/* Story Hero */}
      <section className="rounded-2xl bg-[#111111] border border-white/10 text-white p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[280px]">
            <div className="text-[10px] font-bold tracking-widest uppercase text-white/50 mb-3">
               {phaseOne.title.toUpperCase()} • CHAPTER {mission.order}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold">{mission.title}</h1>
            <p className="mt-4 text-sm text-white/80 max-w-2xl leading-relaxed">{mission.storyIntro}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className={cn("px-3 py-1.5 rounded-full", difficultyStyles[mission.difficulty])}>
                {mission.difficulty.toUpperCase()}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white">
                ~{mission.timeMinutes} minutes
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white flex items-center gap-1">
                 <Flame className="w-3 h-3 text-orange-400" /> +{mission.reward.xp} XP
              </span>
            </div>
          </div>
        </div>
        {!started && (
          <button
            onClick={() => setStarted(true)}
            className="relative z-10 mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-3.5 text-sm font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]"
          >
            Start Your Journey <Play className="h-4 w-4 fill-white" />
          </button>
        )}
      </section>

      {/* Ghosted Preview */}
      {!started && (
        <div className="mt-8 space-y-4 opacity-40 blur-[2px] select-none pointer-events-none px-2 max-w-3xl">
          {Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-secondary/20">
                <div className="w-4 h-4 rounded-full border-[3px] border-border/60 shrink-0" />
                <div className="h-3 bg-border/40 rounded-full w-48" />
                <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
             </div>
          ))}
        </div>
      )}

      {started && (
        <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Timeline */}
          <div className="relative lg:sticky lg:top-24 h-fit rounded-2xl card-layer-2 p-5 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">Timeline</p>
            <div className="relative">
              {/* Continuous background line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-secondary/50 rounded-full" />
              {/* Active filled line */}
              <motion.div 
                className="absolute left-[7px] top-2 w-[2px] bg-orange-500 origin-top rounded-full"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: activeStepIndex / Math.max(1, steps.length - 1) }}
                transition={{ duration: 0.5 }}
              />
              <div className="space-y-4 relative z-10">
                {steps.map((step, index) => {
                  const locked = !isUnlocked(index);
                  const done = isCompleted(step.id);
                  const active = index === activeStepIndex && !locked;

                  return (
                    <button
                      key={step.id}
                      onClick={() => !locked && setActiveStepIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-3 text-left group transition-all relative",
                        locked && "opacity-30"
                      )}
                      disabled={locked}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-[3px] shrink-0 bg-background transition-all duration-300 relative z-10",
                          done
                            ? "border-orange-500 bg-orange-500 scale-90"
                            : active
                              ? "border-orange-500 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-[0_0_10px_rgba(249,115,22,0.4)] scale-110"
                              : "border-border/80 group-hover:border-border scale-95"
                        )}
                      >
                        {locked && <Lock className="absolute inset-0 m-auto w-2 h-2 text-muted-foreground/50" />}
                      </div>
                      <span className={cn("text-xs transition-colors", active ? "text-foreground font-bold" : "text-muted-foreground font-medium group-hover:text-foreground")}> 
                        {step.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const locked = !isUnlocked(index);
              const done = isCompleted(step.id);
              const active = index === activeStepIndex;

              if (!active) return null;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-2xl border p-5",
                    locked ? "bg-secondary/40 border-border/50" : "bg-background/90 border-border/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-1">Step {index + 1}</p>
                        <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{step.title}</h3>
                      </div>
                      {done && <CheckCircle2 className="h-6 w-6 text-success" />}
                    </div>
                  </div>

                  {step.type === "story_hook" && (
                    <div className="mt-6 space-y-5">
                      <div className="relative p-6 px-8 rounded-2xl bg-orange-500/5 border border-orange-500/20">
                         <div className="absolute -top-4 -left-1 text-[80px] text-orange-500/10 font-serif leading-none select-none pointer-events-none">"</div>
                         <p className="text-[15px] font-medium text-foreground leading-relaxed relative z-10">
                           {step.storyContent}
                         </p>
                      </div>
                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        Understood, let's practice <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {step.type === "video" && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{step.videoTitle}</p>
                        <p className="text-[11px] text-muted-foreground">Duration: {step.videoDuration}</p>
                      </div>
                      <div className="rounded-2xl overflow-hidden bg-secondary/40 border border-border/50">
                        <div className="aspect-video w-full bg-black/80">
                          {step.videoUrl ? (
                            <iframe
                              className="w-full h-full"
                              src={step.videoUrl}
                              title={step.videoTitle}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          ) : null}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.videoNote}</p>
                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground px-5 py-2.5 text-sm font-bold transition-all"
                      >
                        Got it, moving on <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {step.type === "cheatsheet" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-secondary/40 border border-border/50 p-4 space-y-2 text-xs text-foreground font-mono">
                        {step.cheatsheetContent?.map((line) => (
                          <div key={line} className="rounded-lg bg-background/70 px-3 py-2 border border-border/40">
                            {line}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground px-5 py-2.5 text-sm font-bold transition-all"
                      >
                        Got it, moving on <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {step.type === "practice" && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-muted-foreground">Problems solved: {Object.values(practiceSolved).filter(Boolean).length}/{step.practiceProblems?.length || 0}</p>
                      <div className="space-y-2">
                        {step.practiceProblems?.map((problem) => (
                          <div
                            key={problem.id}
                            className="rounded-2xl border border-border/50 bg-secondary/40 p-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">{problem.name}</p>
                              <p className="text-[11px] text-muted-foreground">{problem.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                {problem.difficulty}
                              </span>
                              <a
                                href={problem.link || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] px-2 py-1 rounded-full bg-background border border-border text-foreground"
                              >
                                Solve
                              </a>
                              <button
                                onClick={() =>
                                  setPracticeSolved((prev) => ({
                                    ...prev,
                                    [problem.id]: !prev[problem.id],
                                  }))
                                }
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded-full font-semibold",
                                  practiceSolved[problem.id] ? "bg-success/15 text-success" : "bg-background border border-border"
                                )}
                              >
                                {practiceSolved[problem.id] ? "Solved" : "Mark"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-2xl bg-secondary/30 border border-border/40 p-3 text-[11px] text-muted-foreground">
                        Did you complete these problems? Be honest. This helps you improve faster.
                      </div>
                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
                      >
                        I&apos;ve attempted these <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {step.type === "quiz" && (
                    <div className="mt-4 space-y-3">
                      {!quizState.done ? (
                        <>
                          <p className="text-sm font-semibold text-foreground">{quizQuestions[quizState.current]?.question}</p>
                          <div className="space-y-2">
                            {quizQuestions[quizState.current]?.options.map((opt, optIndex) => {
                              const isSelected = quizState.selected === optIndex;
                              const isCorrect = optIndex === quizQuestions[quizState.current].correctIndex;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => handleQuizAnswer(quizQuestions[quizState.current].correctIndex, optIndex)}
                                  className={cn(
                                    "w-full text-left rounded-2xl border px-3 py-2 text-xs",
                                    quizState.answered && isSelected && isCorrect && "border-success bg-success/10",
                                    quizState.answered && isSelected && !isCorrect && "border-destructive bg-destructive/10",
                                    !quizState.answered && "border-border/50 bg-secondary/30"
                                  )}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {quizState.answered && (
                            <p className="text-[11px] text-muted-foreground">
                              {quizQuestions[quizState.current]?.explanation}
                            </p>
                          )}
                          <button
                            onClick={handleQuizNext}
                            className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
                          >
                            Next Question <ArrowRight className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Quiz Complete</p>
                          <p className="text-xs text-muted-foreground">Score: {quizState.score}/{quizQuestions.length}</p>
                          {quizState.passed ? (
                            <button
                              onClick={() => completeStep(step.id, index)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
                            >
                              Unlock Next Step <CheckCircle2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Review the cheatsheet and try again.</p>
                              <button
                                onClick={() =>
                                  setQuizState({
                                    current: 0,
                                    score: 0,
                                    answered: false,
                                    selected: -1,
                                    done: false,
                                    passed: false,
                                  })
                                }
                                className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-xs font-semibold text-foreground"
                              >
                                Try Again
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {step.type === "task" && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-foreground">{step.taskStatement}</p>
                      <div className="rounded-2xl bg-secondary/40 border border-border/50 p-3 text-xs text-muted-foreground">
                        <p>Sample Input: {step.taskSampleInput}</p>
                        <p>Sample Output: {step.taskSampleOutput}</p>
                      </div>
                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
                      >
                        Start Coding <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {step.type === "complete" && (
                    <div className="mt-4 py-12 flex flex-col items-center text-center space-y-8 bg-gradient-to-b from-transparent to-orange-500/5 rounded-3xl">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-24 h-24 rounded-full bg-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] flex items-center justify-center"
                      >
                         <Trophy className="w-12 h-12 text-white" />
                      </motion.div>
                      
                      <div className="space-y-2">
                        <h2 className="text-4xl font-display font-extrabold text-white tracking-tight">Chapter Complete!</h2>
                        <p className="text-xl text-orange-500 font-bold">+{mission.reward.xp} XP</p>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          You just unlocked the <span className="text-foreground font-bold">{mission.reward.badge}</span> badge and took a massive leap in Phase 1.
                        </p>
                      </div>

                      <button
                        onClick={() => completeStep(step.id, index)}
                        className="inline-flex items-center gap-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg font-bold shadow-xl transition-all hover:-translate-y-1 active:scale-95"
                      >
                        Celebrate & Share <Sparkles className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {showCelebration && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          {/* Badge animation */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: 1 }}
            transition={{ type: "spring", damping: 12, duration: 0.6 }}
            className="w-32 h-32 sm:w-48 sm:h-48 shrink-0 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_50px_rgba(249,115,22,0.4)] flex items-center justify-center mt-10 mb-6 border-4 border-white/10"
          >
            <Trophy className="h-16 w-16 sm:h-24 sm:w-24 text-white drop-shadow-lg" />
          </motion.div>

          {/* Heading */}
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl font-display font-black text-white text-center tracking-tight"
          >
            You just leveled up 🚀
          </motion.h2>

          {/* XP Odometer */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-xl font-bold bg-white/10 px-4 py-2 rounded-full border border-white/5 flex items-center gap-3 backdrop-blur-sm shadow-xl"
          >
            <span className="text-orange-500 tabular-nums">+{displayXp} XP</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white/80">{mission.title}</span>
          </motion.div>

          {/* LinkedIn Mock */}
          <motion.div 
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 max-w-md w-full bg-white rounded-2xl shadow-2xl border-l-[8px] border-[#0A66C2] overflow-hidden text-left shrink-0"
          >
             <div className="p-5 flex items-center gap-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center text-[#0A66C2] font-black text-lg border-2 border-[#0A66C2]/20">
                  {userName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-base font-black text-slate-900 leading-tight">{userName || "Learner"}</p>
                  <p className="text-xs font-bold text-slate-500">Mastering DSA on DSA OS</p>
                </div>
                <div className="bg-[#0A66C2] text-white font-black text-lg px-2 rounded-md shadow-sm">
                   in
                </div>
             </div>
             <div className="p-6 space-y-4">
               <p className="text-[15px] font-medium text-slate-800 leading-relaxed">
                 {shareText}
               </p>
               <div className="flex flex-wrap gap-2">
                 <span className="text-xs font-bold text-[#0A66C2] bg-[#0A66C2]/5 px-2 py-1 rounded">#DSA</span>
                 <span className="text-xs font-bold text-[#0A66C2] bg-[#0A66C2]/5 px-2 py-1 rounded">#CodingJourney</span>
                 <span className="text-xs font-bold text-[#0A66C2] bg-[#0A66C2]/5 px-2 py-1 rounded">#LevelUp</span>
               </div>
             </div>
             <div className="w-full bg-slate-50 aspect-[1.91/1] flex items-center justify-center border-t border-gray-100 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5" />
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-2xl flex items-center justify-center border-4 border-white/20 z-10 transition-transform group-hover:scale-110">
                  <Trophy className="h-14 w-14 text-white drop-shadow-md" />
                </div>
             </div>
          </motion.div>

          {/* Actions */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-12 flex flex-col items-center gap-4 w-full max-w-md pb-12"
          >
            <button className="w-full rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white px-6 py-5 text-lg font-black shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl active:scale-95">
              Share Achievement on LinkedIn
            </button>
            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={() => navigate("/chapters")}
                className="rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-4 text-sm font-bold transition-all hover:-translate-y-0.5"
              >
                Next Chapter
              </button>
              <button
                onClick={() => setShowCelebration(false)}
                className="rounded-xl bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 px-6 py-4 text-sm font-bold transition-all hover:-translate-y-0.5"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
