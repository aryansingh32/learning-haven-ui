import React, { useMemo, useState } from "react";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface QuizSectionProps {
  questions: QuizQuestion[];
  chapterId: string;
  onComplete: (score: number, passed: boolean) => void;
}

type QuizState = "idle" | "answering" | "reviewing" | "complete";

export const QuizSection: React.FC<QuizSectionProps> = ({
  questions: rawQuestions,
  chapterId: _chapterId, // reserved for parent usage, not used here
  onComplete,
}) => {
  const questions = useMemo(
    () => (Array.isArray(rawQuestions) ? rawQuestions.slice(0, 3) : []),
    [rawQuestions]
  );

  const [state, setState] = useState<QuizState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (!questions.length) return null;

  const current = questions[currentIndex];

  const handleStart = () => {
    setState("answering");
    setCurrentIndex(0);
    setSelectedIndex(null);
    setScore(0);
  };

  const handleSelect = (idx: number) => {
    if (state !== "answering") return;
    setSelectedIndex((prev) => (prev === idx ? null : idx));
  };

  const handleSubmit = () => {
    if (state !== "answering" || selectedIndex === null) return;
    const isCorrect = selectedIndex === current.answer;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setState("reviewing");
  };

  const handleNext = () => {
    if (state !== "reviewing") return;
    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      const passed = score >= 2;
      setState("complete");
      onComplete(score, passed);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedIndex(null);
    setState("answering");
  };

  const handleRetake = () => {
    setState("idle");
    setCurrentIndex(0);
    setSelectedIndex(null);
    setScore(0);
  };

  const total = questions.length;
  const passed = score >= 2;

  const renderQuestionBody = () => {
    if (state === "idle") {
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            🧠 Quick Check (3 Questions)
          </p>
          <p className="text-xs text-gray-600 mb-4">
            Test your understanding before unlocking the next chapter.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold"
          >
            Start Quiz
          </button>
        </div>
      );
    }

    if (state === "complete") {
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div
            className={[
              "rounded-lg px-4 py-3 mb-3 text-center",
              passed ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800",
            ].join(" ")}
          >
            <p className="text-2xl font-bold mb-1">
              {score} / {total}
            </p>
            <p className="text-sm font-semibold">
              {passed
                ? "🎉 Great job! Chapter unlocked."
                : "📚 Review the material and try again."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetake}
            className="w-full h-10 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Retake Quiz
          </button>
        </div>
      );
    }

    const isReviewing = state === "reviewing";

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-semibold text-gray-800">
            🧠 Quick Check
          </p>
          <p className="text-xs text-gray-500">
            Question {currentIndex + 1} of {total}
          </p>
        </div>
        <p className="text-lg font-semibold text-gray-900 mb-4">
          {current.q}
        </p>

        <div className="space-y-2 mb-4">
          {current.options.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            const isCorrect = idx === current.answer;

            let border = "border-gray-200";
            let bg = "bg-white";
            let text = "text-gray-800";
            let icon: string | null = null;

            if (isReviewing) {
              if (isCorrect) {
                border = "border-green-500";
                bg = "bg-green-50";
                text = "text-green-800";
                icon = "✅";
              } else if (isSelected && !isCorrect) {
                border = "border-red-500";
                bg = "bg-red-50";
                text = "text-red-800";
                icon = "❌";
              }
            } else if (isSelected) {
              border = "border-blue-600";
              bg = "bg-blue-50";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                className={[
                  "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors flex items-center justify-between gap-2",
                  border,
                  bg,
                  text,
                ].join(" ")}
                disabled={isReviewing}
              >
                <span className="flex-1">{opt}</span>
                {icon && <span className="ml-2 text-base">{icon}</span>}
              </button>
            );
          })}
        </div>

        {state === "answering" && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIndex === null}
            className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        )}

        {isReviewing && (
          <>
            <div className="mt-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              {current.explanation}
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="mt-3 w-full h-10 rounded-lg bg-gray-900 text-white text-sm font-semibold"
            >
              {currentIndex === total - 1 ? "See Results" : "Next Question"}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="mb-6">
      {renderQuestionBody()}
    </section>
  );
};


