import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Clock, Loader2, CheckCircle2, XCircle, Trophy, RotateCcw, NotebookText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startMockTest, submitMockTest, type MockTestStartResult, type MockTestSubmitResult } from '@/data/mockTest';
import { parseEntitlementError } from '@/lib/entitlementError';
import { toast } from 'sonner';

type Phase = 'intro' | 'in_progress' | 'results';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MockTestPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('intro');
  const [test, setTest] = useState<MockTestStartResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<MockTestSubmitResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startMockTest(courseId!),
    onSuccess: (res) => {
      setTest(res);
      setAnswers({});
      setRemaining(res.duration_seconds);
      setPhase('in_progress');
    },
    onError: (err) => {
      const { denied, message } = parseEntitlementError(err);
      if (denied) {
        toast.error(message || "You've used today's mock test attempt.", {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      } else {
        toast.error((err as Error)?.message || 'Could not start the mock test.');
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const answerList = Object.entries(answers).map(([idx, selected]) => ({
        question_index: Number(idx),
        selected_index: selected,
      }));
      return submitMockTest(test!.test_id, answerList);
    },
    onSuccess: (res) => {
      setResult(res);
      setPhase('results');
    },
    onError: () => toast.error('Could not submit the test. Try again.'),
  });

  useEffect(() => {
    if (phase !== 'in_progress') return;
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const allAnswered = useMemo(
    () => Boolean(test) && test!.questions.every((_, i) => answers[i] !== undefined),
    [test, answers]
  );

  const handleRetake = () => {
    setPhase('intro');
    setTest(null);
    setResult(null);
    setAnswers({});
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-8">
      <button
        type="button"
        onClick={() => navigate(courseId ? `/course/${courseId}/chapters` : '/courses')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to course
      </button>

      {phase === 'intro' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl card-layer-2 border border-border/40 p-8 text-center space-y-4"
        >
          <Trophy className="h-10 w-10 mx-auto text-orange-500" />
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mock Test</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A timed test pulling questions from every chapter you've covered in this course. Your score
            and answer review are saved to your notebook.
          </p>
          <button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 shadow-md text-white px-6 py-3 text-sm font-bold transition-all"
          >
            {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Start Mock Test
          </button>
        </motion.div>
      )}

      {phase === 'in_progress' && test && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="sticky top-16 z-10 flex items-center justify-between rounded-xl bg-[#111111] text-white px-5 py-3 shadow-lg">
            <span className="text-sm font-bold">{test.course_title}</span>
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-extrabold', remaining < 60 && 'text-red-400 animate-pulse')}>
              <Clock className="h-4 w-4" /> {formatTime(remaining)}
            </span>
          </div>

          <div className="space-y-4">
            {test.questions.map((q, qi) => (
              <div key={qi} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">
                  Question {qi + 1} · {q.chapter_title}
                </p>
                <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                      className={cn(
                        'w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all',
                        answers[qi] === oi
                          ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                          : 'border-border/50 hover:border-orange-400/50 bg-background'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={!allAnswered || submitMutation.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 shadow-md text-white px-6 py-3.5 text-sm font-bold transition-all"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Test
          </button>
        </motion.div>
      )}

      {phase === 'results' && result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div
            className={cn(
              'rounded-2xl border p-6 text-center',
              result.score_percent >= 66 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'
            )}
          >
            <p className="text-4xl font-extrabold text-foreground">{result.score_percent}%</p>
            <p className="text-sm font-semibold text-muted-foreground mt-1">
              {result.correct_count} / {result.total_questions} correct
            </p>
          </div>

          <div className="space-y-3">
            {result.answers.map((qa, i) => (
              <div key={i} className={cn('rounded-xl border-l-4 bg-secondary/20 p-4', qa.is_correct ? 'border-emerald-500/70' : 'border-red-400/70')}>
                <div className="flex items-start gap-2">
                  {qa.is_correct ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-semibold leading-relaxed">{i + 1}. {qa.question}</p>
                </div>
                <p className="text-xs mt-1.5 pl-6 text-muted-foreground">
                  Your answer: <span className={cn('font-semibold', qa.is_correct ? 'text-emerald-600' : 'text-red-500')}>{qa.selected_text || '(skipped)'}</span>
                </p>
                {!qa.is_correct && qa.correct_option && (
                  <p className="text-xs pl-6 text-emerald-600 font-semibold">Correct answer: {qa.correct_option}</p>
                )}
                {qa.explanation && <p className="text-xs pl-6 mt-1 text-muted-foreground">{qa.explanation}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              type="button"
              onClick={() => navigate(courseId ? `/course/${courseId}/notebook` : '/courses')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold transition-all"
            >
              <NotebookText className="h-4 w-4" /> View in Notebook
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
