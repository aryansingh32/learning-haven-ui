import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type OnboardingAnswers = {
  year?: string | null;
  goal?: string | null;
  hours_per_day?: string | null;
  language?: string | null;
};

const STORAGE_KEY = "dsa_os_onboarding";

type Chapter = {
  number: number;
  emoji: string;
  title: string;
  minutes: number;
};

const CHAPTERS: Chapter[] = [
  { number: 1, emoji: "🚀", title: "Introduction to DSA", minutes: 45 },
  { number: 2, emoji: "⏱️", title: "Time Complexity & Big O", minutes: 60 },
  { number: 3, emoji: "📦", title: "Arrays Basics", minutes: 90 },
  { number: 4, emoji: "🔄", title: "Two Pointers", minutes: 75 },
  { number: 5, emoji: "#️⃣", title: "Hashing & Maps", minutes: 80 },
  { number: 6, emoji: "🔤", title: "Strings", minutes: 70 },
  { number: 7, emoji: "🔗", title: "Linked Lists", minutes: 90 },
  { number: 8, emoji: "📚", title: "Stacks & Queues", minutes: 75 },
  { number: 9, emoji: "🌳", title: "Binary Trees", minutes: 120 },
  { number: 10, emoji: "🔍", title: "Binary Search", minutes: 60 },
  { number: 11, emoji: "↩️", title: "Recursion", minutes: 90 },
  { number: 12, emoji: "🧩", title: "Dynamic Programming I", minutes: 120 },
  { number: 13, emoji: "🧩", title: "Dynamic Programming II", minutes: 120 },
  { number: 14, emoji: "📈", title: "Greedy Algorithms", minutes: 75 },
  { number: 15, emoji: "🌐", title: "Graphs I", minutes: 90 },
  { number: 16, emoji: "🌐", title: "Graphs II", minutes: 90 },
  { number: 17, emoji: "⚙️", title: "System Design Basics", minutes: 60 },
  { number: 18, emoji: "🏆", title: "Mock Interview Prep", minutes: 90 },
];

const getRoadmapTitle = (answers: OnboardingAnswers | null): string => {
  if (!answers) return "90-Day DSA + Placement Roadmap";

  const goal = answers.goal;
  const hours = answers.hours_per_day;

  const hoursHigh =
    hours === "3-4 hours" || hours === "5+ hours";

  if (goal === "Get a Job" && hoursHigh) {
    return "90-Day Placement Roadmap";
  }

  if (goal === "Get an Internship") {
    return "30-Day Internship Sprint";
  }

  if (goal === "Clear College Exams") {
    return "Semester Survival Plan";
  }

  return "90-Day DSA + Placement Roadmap";
};

const RoadmapPreview: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Guard: authenticated users go to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const onboarding: OnboardingAnswers | null = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingAnswers;
    } catch {
      return null;
    }
  }, []);

  const title = useMemo(() => getRoadmapTitle(onboarding), [onboarding]);

  const handleStart = () => {
    navigate("/signup");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 px-4 pt-8 pb-32 max-w-md mx-auto w-full">
        {/* Section 1 — Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Your {title} is Ready 🚀
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            18 chapters · 90+ practice problems · 0 completed
          </p>
          <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-gray-400" style={{ width: "0%" }} />
          </div>
        </header>

        {/* Section 2 — Chapter List */}
        <section className="mt-6">
          <div className="relative">
            {/* Vertical dotted line */}
            <div className="absolute left-4 top-0 bottom-0 border-l border-dashed border-gray-200 pointer-events-none" />

            <div className="space-y-4">
              {CHAPTERS.map((chapter, index) => {
                const isUnlocked = chapter.number <= 2;
                const delayMs = 80 * index;

                return (
                  <div
                    key={chapter.number}
                    className={[
                      "relative pl-10 pr-2",
                      "opacity-0 translate-y-3",
                      "animate-fade-slide-up",
                      !isUnlocked ? "animate-locked-pulse" : "",
                    ].join(" ")}
                    style={{ animationDelay: `${delayMs}ms` }}
                  >
                    {/* Circle */}
                    <div
                      className={[
                        "absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                        isUnlocked
                          ? "bg-green-100 text-green-700 border border-green-500"
                          : "bg-gray-100 text-gray-400 border border-gray-300",
                      ].join(" ")}
                    >
                      {chapter.number}
                    </div>

                    <div
                      className={[
                        "flex items-center justify-between rounded-xl border px-3 py-3",
                        "bg-white",
                        isUnlocked
                          ? "border-green-200"
                          : "border-gray-200 text-gray-400",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">
                          {chapter.emoji}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={[
                              "text-sm font-medium",
                              !isUnlocked ? "text-gray-400 blur-[3px]" : "text-gray-900",
                            ].join(" ")}
                          >
                            {chapter.title}
                          </p>
                          {!isUnlocked && (
                            <p className="mt-0.5 text-[11px] text-gray-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Locked — unlock by starting your free trial
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={[
                          "ml-3 px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap",
                          isUnlocked
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200",
                        ].join(" ")}
                      >
                        {chapter.minutes} min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 3 — Social proof */}
        <section className="mt-8 space-y-2">
          <p className="text-xs text-gray-500">
            Joined by students from{" "}
            <span className="font-semibold text-gray-700">
              IET Lucknow · SATI Vidisha · LNCT Bhopal
            </span>
          </p>
          <p className="text-xs text-gray-500">
            <span className="mr-1">⭐⭐⭐⭐⭐</span>
            <span className="font-semibold text-gray-700">4.8/5</span>{" "}
            from 200+ students
          </p>
        </section>
      </div>

      {/* Section 4 — Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 px-4 pt-3 pb-4 safe-area-bottom">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleStart}
            className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 transition-colors"
          >
            Start Free — Unlock Your Roadmap →
          </button>
          <p className="mt-2 text-[11px] text-gray-500 text-center">
            7-day free trial · No credit card · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoadmapPreview;

