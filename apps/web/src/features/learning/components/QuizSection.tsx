import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, RotateCcw, Loader2, ChevronLeft, SkipForward, MinusCircle,
} from 'lucide-react';
import { ChapterCta } from './ChapterCta';
import { api } from '@/services/api.svc';

export interface QuizQuestion {
  q?: string;
  question?: string;
  options: string[];
  // NOTE: answer / correctAnswer fields are intentionally omitted from API responses (BUG-014)
  explanation?: string;
}

interface ServerCheckResult {
  correct: boolean;
  explanation: string;
  correctOption: string | null;
}

interface QuizSectionProps {
  chapterId: string;
  questions: QuizQuestion[];
  savedScorePercent?: number | null;
  alreadySubmitted?: boolean;
  onSubmitQuiz: (score: number, passed: boolean, totalQuestions: number) => void;
  onProceed: () => void;
}

type Phase = 'form' | 'results' | 'previously_submitted';

/** Sentinel stored in `answers` for a question the learner chose to skip. */
const SKIPPED = -1;

const PASS_PERCENT = 66;

export const QuizSection: React.FC<QuizSectionProps> = ({
  chapterId,
  questions = [],
  savedScorePercent,
  alreadySubmitted = false,
  onSubmitQuiz,
  onProceed,
}) => {
  const storageKey = `lh_quiz_${chapterId}`;

  const [phase, setPhase] = useState<Phase>(() =>
    alreadySubmitted && savedScorePercent != null ? 'previously_submitted' : 'form'
  );
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  // Server-returned check results per question index
  const [checkResults, setCheckResults] = useState<Record<number, ServerCheckResult>>({});

  const normalized = useMemo(
    () =>
      questions.map((q, i) => ({
        id: i,
        text: q.q || q.question || '',
        options: q.options || [],
        // correctIndex is NO LONGER in client-side data (BUG-014 fix)
        // explanation is also removed from client data; we get it from server after submit
        explanation: q.explanation || '',
      })),
    [questions]
  );

  useEffect(() => {
    if (alreadySubmitted && savedScorePercent != null) {
      setPhase('previously_submitted');
    }
  }, [alreadySubmitted, savedScorePercent]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && phase === 'form') {
        const parsed = JSON.parse(raw) as {
          answers?: Record<number, number>;
          submitted?: boolean;
          current?: number;
        };
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.submitted) setSubmitted(true);
        if (typeof parsed.current === 'number') setCurrent(parsed.current);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, phase]);

  if (!normalized.length) return null;

  const total = normalized.length;
  const question = normalized[Math.min(current, total - 1)];
  const selected = answers[question.id];
  const hasSelection = selected !== undefined && selected !== SKIPPED;
  const isLast = current === total - 1;
  const answeredCount = Object.values(answers).filter((v) => v !== SKIPPED).length;

  const persistLocal = (
    nextAnswers: Record<number, number>,
    isSubmitted: boolean,
    nextCurrent: number
  ) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers: nextAnswers, submitted: isSubmitted, current: nextCurrent })
      );
    } catch {
      /* storage can be unavailable (private mode) — the quiz still works in-memory */
    }
  };

  /**
   * BUG-014: Answers are graded server-side; the client never receives correct
   * indices. Skipped questions are sent as SKIPPED so the server still returns
   * the correct option and explanation for the summary.
   */
  const gradeAll = async (finalAnswers: Record<number, number>) => {
    if (checking) return;
    setChecking(true);

    try {
      const checkPromises = normalized.map((q, idx) =>
        api
          .post<ServerCheckResult>(`/chapters/${chapterId}/quiz/check`, {
            questionIndex: idx,
            selectedIndex: finalAnswers[q.id] ?? SKIPPED,
          })
          .then((res) => ({ idx, result: res as unknown as ServerCheckResult }))
          .catch(() => ({
            idx,
            // Graceful fallback: treat as wrong if server unreachable
            result: {
              correct: false,
              explanation: q.explanation || '',
              correctOption: null,
            } as ServerCheckResult,
          }))
      );

      const results = await Promise.all(checkPromises);
      const resultMap: Record<number, ServerCheckResult> = {};
      results.forEach(({ idx, result }) => {
        resultMap[idx] = result;
      });

      setCheckResults(resultMap);

      const correctCount = results.filter((r) => r.result.correct).length;
      const percent = Math.round((correctCount / total) * 100);

      setSubmitted(true);
      setPhase('results');
      persistLocal(finalAnswers, true, current);
      onSubmitQuiz(correctCount, percent >= PASS_PERCENT, total);
    } finally {
      setChecking(false);
    }
  };

  const goNext = (nextAnswers: Record<number, number>) => {
    setAnswers(nextAnswers);
    if (isLast) {
      void gradeAll(nextAnswers);
      return;
    }
    const nextIndex = current + 1;
    setCurrent(nextIndex);
    persistLocal(nextAnswers, false, nextIndex);
  };

  const handleSelect = (optionIndex: number) => {
    const next = { ...answers, [question.id]: optionIndex };
    setAnswers(next);
    persistLocal(next, false, current);
  };

  const handleNext = () => {
    if (!hasSelection) return;
    goNext(answers);
  };

  const handleSkip = () => {
    goNext({ ...answers, [question.id]: SKIPPED });
  };

  const handleBack = () => {
    if (current === 0) return;
    const prev = current - 1;
    setCurrent(prev);
    persistLocal(answers, false, prev);
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
    setPhase('form');
    setCheckResults({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  // Derived score from server results
  const scoreCount = Object.values(checkResults).filter((r) => r.correct).length;
  const scorePercent = total > 0 ? Math.round((scoreCount / total) * 100) : 0;
  const passed = scorePercent >= PASS_PERCENT;

  if (phase === 'previously_submitted' && savedScorePercent != null) {
    const wasPassed = savedScorePercent >= PASS_PERCENT;
    return (
      <div className="pt-2 space-y-4">
        <div
          className={`rounded-2xl border p-6 text-center ${wasPassed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Previous attempt
          </p>
          <p className="text-4xl font-extrabold text-foreground mb-1">{savedScorePercent}%</p>
          <p className="text-sm text-muted-foreground mb-4">
            {wasPassed ? 'You passed this quiz.' : 'Review the material and retake if you want.'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              <RotateCcw className="w-4 h-4" /> Retake quiz
            </button>
            <ChapterCta onClick={onProceed}>I&apos;ve reviewed my knowledge</ChapterCta>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'results' && submitted) {
    const skippedCount = normalized.filter((q) => answers[q.id] === undefined || answers[q.id] === SKIPPED).length;
    const wrongCount = total - scoreCount - skippedCount;

    return (
      <div className="pt-2 space-y-5">
        {/* Score summary */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className={`rounded-2xl border p-6 text-center ${passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Your result
          </p>
          <p className="text-4xl font-extrabold text-foreground leading-none">
            {scoreCount}
            <span className="text-2xl text-muted-foreground"> / {total}</span>
          </p>
          <p className="text-sm font-semibold text-muted-foreground mt-2">
            {scorePercent}% — {passed ? 'Passed' : 'Keep practicing'}
          </p>

          <div className="mt-4 h-2 w-full max-w-xs mx-auto rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${passed ? 'bg-emerald-500' : 'bg-orange-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${scorePercent}%` }}
              transition={{ duration: 0.6, delay: 0.1 }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> {scoreCount} correct
            </span>
            {wrongCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                <XCircle className="w-3.5 h-3.5" /> {wrongCount} incorrect
              </span>
            )}
            {skippedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-muted-foreground">
                <MinusCircle className="w-3.5 h-3.5" /> {skippedCount} skipped
              </span>
            )}
          </div>
        </motion.div>

        {/* Per-question breakdown */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Review your answers
          </p>
          {normalized.map((q, qi) => {
            const answer = answers[q.id];
            const wasSkipped = answer === undefined || answer === SKIPPED;
            const result = checkResults[q.id];
            const isCorrect = result?.correct ?? false;
            return (
              <div key={q.id} className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : wasSkipped ? (
                    <MinusCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Question {qi + 1}
                      {wasSkipped && <span className="ml-2 normal-case tracking-normal">· skipped</span>}
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{q.text}</p>
                  </div>
                </div>
                <div className="space-y-2 pl-7">
                  {q.options.map((opt, idx) => {
                    const isSelected = !wasSkipped && answer === idx;
                    const isRight = !isCorrect && result?.correctOption === opt;
                    let cls = 'border-border/50 bg-background/50 opacity-60';
                    if (isSelected && isCorrect) cls = 'border-emerald-500/50 bg-emerald-500/10';
                    if (isSelected && !isCorrect) cls = 'border-destructive/50 bg-destructive/10';
                    if (isRight) cls = 'border-emerald-500/50 bg-emerald-500/10';
                    return (
                      <div key={idx} className={`rounded-lg border px-3 py-2 text-xs font-medium ${cls}`}>
                        {opt}
                        {isSelected && isCorrect && <span className="ml-2 text-emerald-600">✓ Correct</span>}
                        {isRight && <span className="ml-2 text-emerald-600">✓ Correct answer</span>}
                      </div>
                    );
                  })}
                </div>
                {result?.explanation && (
                  <div className="pl-7 text-xs text-muted-foreground bg-background/60 rounded-lg p-3 border border-border/40">
                    <span className="font-bold text-foreground block mb-1">Explanation</span>
                    {result.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={handleRetake}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
          <ChapterCta onClick={onProceed}>I&apos;ve reviewed my knowledge</ChapterCta>
        </div>
      </div>
    );
  }

  // ── One question at a time ────────────────────────────────────────────────
  const progressPercent = Math.round((current / total) * 100);

  return (
    <div className="pt-2 space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-orange-500">
            Question {current + 1} of {total}
          </span>
          <span className="text-muted-foreground">
            {answeredCount} answered
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question card — keyed so each question animates in without waiting on
          an exit animation (mode="wait" delayed the next question from mounting). */}
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl border border-border/50 bg-secondary/20 p-4 sm:p-5"
      >
          <p className="text-sm sm:text-base font-semibold text-foreground mb-4 leading-relaxed">
            {question.text}
          </p>
          <div className="space-y-2">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                aria-pressed={selected === idx}
                className={`w-full text-left rounded-lg border-2 px-3 py-3 text-sm font-medium transition-all flex items-start gap-3 ${
                  selected === idx
                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                    : 'border-border/50 hover:border-orange-400/50 bg-background'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors ${
                    selected === idx
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={current === 0 || checking}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
          >
            <SkipForward className="w-4 h-4" /> Skip
          </button>
          <ChapterCta
            onClick={handleNext}
            disabled={!hasSelection || checking}
            className={!hasSelection || checking ? 'opacity-50 pointer-events-none' : ''}
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking…
              </span>
            ) : isLast ? (
              'Finish quiz'
            ) : (
              'Next question'
            )}
          </ChapterCta>
        </div>
      </div>
    </div>
  );
};
