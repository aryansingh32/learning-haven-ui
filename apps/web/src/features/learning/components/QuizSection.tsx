import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from 'lucide-react';
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

export interface QuizAnswerDetail {
  question: string;
  options: string[];
  selected_index: number;
  selected_text: string;
  is_correct: boolean;
  correct_option: string | null;
  explanation: string;
}

interface QuizSectionProps {
  chapterId: string;
  questions: QuizQuestion[];
  savedScorePercent?: number | null;
  alreadySubmitted?: boolean;
  onSubmitQuiz: (score: number, passed: boolean, totalQuestions: number, answers: QuizAnswerDetail[]) => void;
  onProceed: () => void;
}

type Phase = 'form' | 'results' | 'previously_submitted';

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
        const parsed = JSON.parse(raw) as { answers?: Record<number, number>; submitted?: boolean };
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.submitted) setSubmitted(true);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, phase]);

  if (!normalized.length) return null;

  const allAnswered = normalized.every((q) => answers[q.id] !== undefined);

  const persistLocal = (nextAnswers: Record<number, number>, isSubmitted: boolean) => {
    localStorage.setItem(storageKey, JSON.stringify({ answers: nextAnswers, submitted: isSubmitted }));
  };

  /**
   * BUG-014: Submit all answers to the server for checking.
   * The server never sent correct indices to the client, so we
   * ask the server to grade each answer.
   */
  const handleSubmitAll = async () => {
    if (!allAnswered || checking) return;
    setChecking(true);

    try {
      // Check all questions in parallel via the server-side endpoint
      const checkPromises = normalized.map((q, idx) =>
        api
          .post<ServerCheckResult>(`/chapters/${chapterId}/quiz/check`, {
            questionIndex: idx,
            selectedIndex: answers[q.id],
          })
          .then(res => ({ idx, result: res as unknown as ServerCheckResult }))
          .catch(() => ({
            idx,
            // Graceful fallback: treat as wrong if server unreachable
            result: { correct: false, explanation: q.explanation || '', correctOption: null } as ServerCheckResult,
          }))
      );

      const results = await Promise.all(checkPromises);
      const resultMap: Record<number, ServerCheckResult> = {};
      results.forEach(({ idx, result }) => { resultMap[idx] = result; });

      setCheckResults(resultMap);

      const correctCount = results.filter(r => r.result.correct).length;
      const percent = Math.round((correctCount / normalized.length) * 100);
      const didPass = percent >= 66;

      setSubmitted(true);
      setPhase('results');
      persistLocal(answers, true);

      const answersDetail: QuizAnswerDetail[] = normalized.map((q) => {
        const result = resultMap[q.id];
        const selectedIndex = answers[q.id];
        return {
          question: q.text,
          options: q.options,
          selected_index: selectedIndex,
          selected_text: q.options[selectedIndex] ?? '',
          is_correct: Boolean(result?.correct),
          correct_option: result?.correct ? null : result?.correctOption ?? null,
          explanation: result?.explanation || q.explanation || '',
        };
      });

      onSubmitQuiz(correctCount, didPass, normalized.length, answersDetail);
    } finally {
      setChecking(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setPhase('form');
    setCheckResults({});
    localStorage.removeItem(storageKey);
  };

  // Derived score from server results
  const scoreCount = Object.values(checkResults).filter(r => r.correct).length;
  const scorePercent = normalized.length > 0 ? Math.round((scoreCount / normalized.length) * 100) : 0;
  const passed = scorePercent >= 66;

  if (phase === 'previously_submitted' && savedScorePercent != null) {
    const wasPassed = savedScorePercent >= 66;
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
    return (
      <div className="pt-2 space-y-5">
        <div
          className={`rounded-2xl border p-5 text-center ${passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}
        >
          <p className="text-3xl font-extrabold text-foreground">
            {scoreCount} / {normalized.length}
          </p>
          <p className="text-sm font-semibold text-muted-foreground mt-1">{scorePercent}% — {passed ? 'Passed' : 'Keep practicing'}</p>
        </div>

        <div className="space-y-4">
          {normalized.map((q) => {
            const selected = answers[q.id];
            const result = checkResults[q.id];
            const isCorrect = result?.correct ?? false;
            return (
              <div key={q.id} className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-semibold text-foreground leading-relaxed">{q.text}</p>
                </div>
                <div className="space-y-2 pl-7">
                  {q.options.map((opt, idx) => {
                    const isSelected = selected === idx;
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

  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-muted-foreground">
        Answer all questions, then submit to see explanations and your score together.
      </p>

      <div className="space-y-5">
        {normalized.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">
              Question {qi + 1}
            </p>
            <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">{q.text}</p>
            <div className="space-y-2">
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const next = { ...answers, [q.id]: idx };
                    setAnswers(next);
                    persistLocal(next, false);
                  }}
                  className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    answers[q.id] === idx
                      ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                      : 'border-border/50 hover:border-orange-400/50 bg-background'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ChapterCta
        onClick={handleSubmitAll}
        disabled={!allAnswered || checking}
        className={(!allAnswered || checking) ? 'opacity-50 pointer-events-none' : ''}
      >
        {checking ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking answers…
          </span>
        ) : (
          'Submit quiz'
        )}
      </ChapterCta>
    </div>
  );
};
