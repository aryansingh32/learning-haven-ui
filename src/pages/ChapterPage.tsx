import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Brain,
  Flame,
  Gamepad2,
  LockOpen,
  Play,
  Sparkles,
  Trophy,
  Share2,
  CheckCircle2,
  CircleDot,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMissionById, getNextMission, phaseOne } from "@/data/chapters";

const difficultyStyles: Record<string, string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  hard: "bg-destructive/15 text-destructive",
};

function ArrayVisualizer() {
  const values = [5, 2, 9, 1, 7];
  const [index, setIndex] = useState(2);

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Array Visualizer</p>
        <span className="text-[11px] text-muted-foreground">Pointer at index {index}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {values.map((value, idx) => (
          <div
            key={value}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-semibold border",
              idx === index
                ? "bg-primary text-primary-foreground border-primary shadow-card"
                : "bg-background border-border text-foreground"
            )}
          >
            {value}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setIndex((prev) => (prev === 0 ? values.length - 1 : prev - 1))}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-background border border-border"
        >
          Prev
        </button>
        <button
          onClick={() => setIndex((prev) => (prev + 1) % values.length)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-primary text-primary-foreground"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ChapterPage() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const mission = useMemo(() => getMissionById(chapterId || ""), [chapterId]);
  const nextMission = useMemo(() => (mission ? getNextMission(mission.id) : null), [mission]);
  const practiceProblems = [
    { id: "lc-1", name: "Two Sum", difficulty: "Easy", status: "Solved" },
    { id: "lc-2", name: "Binary Search", difficulty: "Easy", status: "Unsolved" },
    { id: "lc-3", name: "Arrays & Hashing", difficulty: "Easy", status: "Solved" },
    { id: "lc-4", name: "Two Pointers", difficulty: "Medium", status: "Unsolved" },
  ];
  const shareText =
    "I just completed Chapter 3: Arrays Basics on DSA OS. Learning data structures step by step. #DSA #CodingJourney";
  const stepLabels = [
    "Story Hook",
    "Curated Video",
    "Cheatsheet",
    "Practice Problems",
    "Mini Quiz",
    "The Task",
    "Complete Chapter",
  ];

  if (!mission) {
    return (
      <div className="max-w-3xl mx-auto card-layer-2 rounded-3xl p-8 text-center">
        <p className="text-lg font-semibold text-foreground">Mission not found</p>
        <p className="text-sm text-muted-foreground mt-2">Choose a mission from the Learn page.</p>
        <button
          onClick={() => navigate("/chapters")}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          Back to Learn <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const progressPercent = Math.round((mission.completedSteps / mission.totalSteps) * 100);
  const isComplete = mission.completedSteps === mission.totalSteps;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <section className="rounded-2xl card-layer-2 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-muted-foreground">
              Learn &gt; Roadmap &gt; Java &amp; DSA &gt; {mission.title}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{mission.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{mission.concept}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/chapters")}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground border border-border/50 rounded-2xl px-3 py-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Learn
            </button>
            <span
              className={cn(
                "text-[11px] px-3 py-1 rounded-full font-semibold",
                difficultyStyles[mission.difficulty]
              )}
            >
              {mission.difficulty.toUpperCase()}
            </span>
            <span className="text-[11px] px-3 py-1 rounded-full bg-secondary text-muted-foreground">
              {mission.timeMinutes} minutes
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl bg-background/70 border border-border/50 p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-foreground">
              <span>Chapter Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full gradient-golden"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {mission.completedSteps} / {mission.totalSteps} steps completed
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" /> Keep the streak alive with one more step.
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-background to-background border border-primary/20 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-semibold">Mentor Note</p>
            <p className="mt-2 text-xs text-foreground font-medium">{mission.mentorNote}</p>
          </div>
        </div>
      </section>

      {isComplete && (
        <section className="rounded-2xl bg-success/10 border border-success/30 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-success" />
            <div>
              <p className="text-sm font-semibold text-foreground">Mission Complete!</p>
              <p className="text-xs text-muted-foreground">+{mission.reward.xp} XP and {mission.reward.badge} unlocked</p>
            </div>
          </div>
          {nextMission && (
            <button
              onClick={() => navigate(`/chapter/${nextMission.id}`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
            >
              Start Next Mission <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-3">
          <div className="rounded-2xl card-glass p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Story Hook</p>
                <p className="text-sm font-semibold text-foreground">Why this chapter matters</p>
              </div>
              <span className="text-xs text-muted-foreground">Narrative</span>
            </div>
            <div className="rounded-2xl bg-secondary/40 border border-border/50 p-3 text-xs text-foreground">
              Imagine you are building a search engine. Millions of pages need to be stored in memory efficiently.
              Arrays are the simplest structure that makes this possible.
            </div>
            <div className="flex flex-wrap gap-2">
              {mission.realWorld.map((item) => (
                <span key={item} className="text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl card-layer-2 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Chapter Timeline</p>
                <p className="text-sm font-semibold text-foreground">Follow the path</p>
              </div>
              <span className="text-xs text-muted-foreground">Step {Math.min(2, stepLabels.length)} of {stepLabels.length}</span>
            </div>
            <div className="space-y-2">
              {stepLabels.map((label, index) => {
                const isDone = index < 2;
                const isActive = index === 2;
                const isLocked = index > 2;

                return (
                  <div
                    key={label}
                    className={cn(
                      "rounded-2xl border p-3 flex items-center gap-3 transition-all",
                      isActive
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border/50 bg-secondary/40"
                    )}
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold">
                      {isDone && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {isActive && <CircleDot className="h-4 w-4 text-primary" />}
                      {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-xs font-semibold", isLocked ? "text-muted-foreground" : "text-foreground")}>
                        {label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {isDone
                          ? "Completed"
                          : isActive
                            ? "Current step"
                            : "Unlock by finishing previous step"}
                      </p>
                    </div>
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[11px] font-semibold",
                        isLocked
                          ? "bg-secondary text-muted-foreground"
                          : "bg-background border border-border"
                      )}
                      disabled={isLocked}
                    >
                      {isLocked ? "Locked" : "Start"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl card-layer-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gamepad2 className="h-4 w-4 text-primary" />
              Practice Problems
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Problems solved in this chapter: 2 / 4</p>
            <div className="mt-3 space-y-2">
              {practiceProblems.map((problem) => (
                <div
                  key={problem.id}
                  className="rounded-2xl border border-border/50 bg-secondary/40 p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">{problem.name}</p>
                    <p className="text-[11px] text-muted-foreground">Difficulty: {problem.difficulty}</p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-full font-semibold",
                      problem.status === "Solved" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {problem.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <ArrayVisualizer />

          <div className="rounded-2xl card-layer-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="h-4 w-4 text-primary" /> Real World Connection
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {mission.realWorld.map((item) => (
                <span
                  key={item}
                  className="text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-secondary/70 via-background to-background border border-border/50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Rewards
            </div>
            <div className="mt-3 flex items-center gap-3">
              <BadgeCheck className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">+{mission.reward.xp} XP</p>
                <p className="text-xs text-muted-foreground">{mission.reward.badge} badge</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-background border border-border/50 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Community Progress</p>
            <p className="mt-2 text-xs font-semibold text-foreground">423 learners completed this chapter</p>
            <p className="text-xs text-muted-foreground mt-1">87 shared their progress today</p>
          </div>

          <div className="rounded-2xl bg-primary text-primary-foreground p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.28em] opacity-80">Ready?</p>
            <p className="mt-2 text-sm font-semibold">Start the next step now.</p>
            <button className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/20 px-3 py-1.5 text-xs font-semibold">
              <Play className="h-4 w-4" /> Start Step 1
            </button>
          </div>

          <div className="rounded-2xl card-layer-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Share2 className="h-4 w-4 text-primary" /> Learn in Public
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Share your progress and build your learning identity.
            </p>
            <div className="mt-3 rounded-2xl bg-secondary/40 border border-border/50 p-3 text-[11px] text-muted-foreground">
              {shareText}
            </div>
            <button className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">
              Share on LinkedIn <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {nextMission && (
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LockOpen className="h-4 w-4 text-primary" /> Next Chapter
              </div>
              <p className="mt-2 text-xs text-foreground">{nextMission.title}</p>
              <button
                onClick={() => navigate(`/chapter/${nextMission.id}`)}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
              >
                Go Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </aside>
      </section>

      <section className="rounded-2xl card-layer-2 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Phase 1 Progress</p>
            <p className="text-sm font-semibold text-foreground">{phaseOne.title}</p>
          </div>
          <button
            onClick={() => navigate("/chapters")}
            className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            Back to Mission List <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full gradient-golden" style={{ width: `${phaseOne.progressPercent}%` }} />
        </div>
      </section>
    </div>
  );
}
