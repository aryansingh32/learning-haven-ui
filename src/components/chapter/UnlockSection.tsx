import React, { useState } from "react";
import { useApiMutation } from "@/hooks/useApi";
import { api } from "@/services/api.svc";

interface UnlockSectionProps {
  chapterId: string;
  chapterNumber?: number | null;
  quizPassed: boolean;
  taskCompleted: boolean;
  usedSkipToken?: boolean;
  skipTokensRemaining?: number | null;
}

export const UnlockSection: React.FC<UnlockSectionProps> = ({
  chapterId,
  chapterNumber,
  quizPassed,
  taskCompleted,
  usedSkipToken,
  skipTokensRemaining,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [skipped, setSkipped] = useState(!!usedSkipToken);

  const unlockMutation = useApiMutation(() =>
    api.post("/chapters/unlock", { chapterId })
  );

  const skipMutation = useApiMutation(() =>
    api.post("/chapters/skip-unlock", { chapterId })
  );

  const nextChapterLabel =
    typeof chapterNumber === "number" ? chapterNumber + 1 : "Next";

  const ready = quizPassed && taskCompleted || skipped;

  const handleUnlock = async () => {
    if (!ready || unlocked) return;
    try {
      await unlockMutation.mutateAsync();
      setUnlocked(true);
      // Simple CSS confetti placeholder
      const el = document.getElementById("chapter-unlock-confetti");
      if (el) {
        el.classList.remove("hidden");
        setTimeout(() => {
          el.classList.add("hidden");
        }, 1800);
      }
      // Navigate to roadmap after a slight delay
      window.setTimeout(() => {
        window.location.href = "/roadmap";
      }, 800);
    } catch {
      // ignore for now or hook into toast
    }
  };

  const handleSkip = async () => {
    if (!skipTokensRemaining || skipTokensRemaining <= 0) return;
    const ok = window.confirm(
      `Use a Skip Token to unlock Chapter ${nextChapterLabel}? You have ${skipTokensRemaining} remaining.`
    );
    if (!ok) return;
    try {
      await skipMutation.mutateAsync();
      setSkipped(true);
    } catch {
      // ignore for now
    }
  };

  const quizLabel = quizPassed ? "✅ Quiz passed (≥66%)" : "⏳ Quiz passed (≥66%)";
  const taskLabel = taskCompleted ? "✅ Task completed" : "⏳ Task completed";

  return (
    <section className="mt-4 mb-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 relative overflow-hidden">
        <div
          id="chapter-unlock-confetti"
          className="hidden pointer-events-none absolute inset-0"
        >
          <div className="w-full h-full animate-pulse opacity-40 bg-gradient-to-br from-green-200 via-blue-200 to-yellow-200" />
        </div>

        <p className="text-sm font-semibold text-gray-900">
          {ready
            ? `Ready to Unlock Chapter ${nextChapterLabel}`
            : `Complete to Unlock Chapter ${nextChapterLabel}`}
        </p>

        <div className="space-y-1 text-xs text-gray-700">
          <p>{quizLabel}</p>
          <p>{taskLabel}</p>
        </div>

        <button
          type="button"
          onClick={handleUnlock}
          disabled={!ready || unlocked}
          className={[
            "w-full h-11 rounded-xl text-sm font-semibold mt-1",
            ready
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          ].join(" ")}
        >
          {ready ? `🔓 Unlock Chapter ${nextChapterLabel} →` : "Unlock Next Chapter 🔒"}
        </button>

        {typeof skipTokensRemaining === "number" && skipTokensRemaining > 0 && (
          <button
            type="button"
            onClick={handleSkip}
            className="mt-2 text-[11px] text-blue-600 hover:text-blue-700 underline-offset-2"
          >
            Or use a Skip Token — you have {skipTokensRemaining} remaining
          </button>
        )}
      </div>
    </section>
  );
};

