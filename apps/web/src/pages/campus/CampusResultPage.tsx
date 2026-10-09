import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, CheckCircle2, XCircle, MinusCircle, Hourglass, Loader2, AlertTriangle, Clock, ShieldAlert, ListChecks, Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { fetchAttemptView, type AttemptView } from '@/services/campus.service';

const REASON: Record<string, { icon: React.ElementType; text: string; tone: string }> = {
  timeout: { icon: Clock, text: 'Time ran out, so we submitted the answers you had saved.', tone: 'text-reward bg-reward/10 border-reward/30' },
  violations: { icon: ShieldAlert, text: 'This test was submitted automatically after repeated proctoring violations.', tone: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30' },
  closed: { icon: Clock, text: 'The test window closed, so we submitted the answers you had saved.', tone: 'text-reward bg-reward/10 border-reward/30' },
};

function encouragement(percent: number) {
  if (percent >= 85) return 'Outstanding work — you clearly know this material.';
  if (percent >= 60) return 'Solid result. Review the questions you missed to lock it in.';
  if (percent >= 35) return "You're getting there. A little focused practice will move this up fast.";
  return "Tough one. Go through the topics again — your next attempt will show the difference.";
}

export default function CampusResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { justSubmitted?: boolean } };

  const { data, isLoading, isError, error, refetch } = useQuery<AttemptView>({
    queryKey: ['campus-attempt', attemptId],
    queryFn: () => fetchAttemptView(attemptId!),
    enabled: !!attemptId,
    retry: 1,
  });

  const result = data?.result;
  const released = result?.released === true ? result : null;
  const percent = released && released.totalMarks > 0 ? Math.max(0, Math.round((released.score / released.totalMarks) * 100)) : 0;

  useEffect(() => {
    if (data?.status === 'in_progress') navigate(`/college/tests/${data.assignment.id}`, { replace: true });
  }, [data, navigate]);

  useEffect(() => {
    if (location.state?.justSubmitted && released && percent >= 60) {
      void confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 } });
    }
  }, [location.state?.justSubmitted, released, percent]);

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (isError || !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-reward" />
        <p className="font-semibold text-foreground">{(error as Error)?.message || "We couldn't load this result."}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const reason = data.submitReason ? REASON[data.submitReason] : undefined;
  const correct = released?.perQuestion.filter((q) => q.isCorrect === true).length ?? 0;
  const wrong = released?.perQuestion.filter((q) => q.attempted && q.isCorrect === false).length ?? 0;
  const skipped = released?.perQuestion.filter((q) => !q.attempted).length ?? 0;
  const coding = (released?.perQuestion ?? []).map((q, i) => ({ q, i })).filter(({ q }) => q.testsTotal !== undefined || q.pending);
  const gradingPending = coding.some(({ q }) => q.pending);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>

      <div>
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Attempt {data.attemptNumber} · Result</p>
        <h1 className="text-page-title font-display font-bold text-foreground">{data.assignment.title}</h1>
      </div>

      {reason && (
        <div className={cn('flex items-start gap-3 p-4 rounded-xl border text-sm', reason.tone)}>
          <reason.icon className="w-4 h-4 mt-0.5 shrink-0" /> {reason.text}
        </div>
      )}

      {!released ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass rounded-2xl p-8 border border-border/40 text-center space-y-3"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-success/10 text-success flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Your answers are submitted</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto flex items-center justify-center gap-1.5">
            <Hourglass className="w-4 h-4 shrink-0" /> Your faculty will release the results. You'll find them right here.
          </p>
        </motion.section>
      ) : (
        <>
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass rounded-2xl p-6 sm:p-8 border border-border/40"
          >
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="relative shrink-0">
                <ProgressRing value={percent} size={140} strokeWidth={12} label={`${percent}%`} sublabel="score" />
              </div>
              <div className="flex-1 text-center sm:text-left space-y-3">
                <p className="text-3xl font-display font-bold text-foreground">
                  {released.score} <span className="text-base font-medium text-muted-foreground">/ {released.totalMarks} marks</span>
                </p>
                <p className="text-sm text-muted-foreground">{encouragement(percent)}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-success/10 p-2.5 text-center">
                    <p className="text-lg font-bold text-success">{correct}</p><p className="text-[11px] text-muted-foreground">Correct</p>
                  </div>
                  <div className="rounded-xl bg-destructive/10 p-2.5 text-center">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{wrong}</p><p className="text-[11px] text-muted-foreground">Wrong</p>
                  </div>
                  <div className="rounded-xl bg-secondary p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{skipped}</p><p className="text-[11px] text-muted-foreground">Skipped</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <section className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40">
            <h2 className="text-sm font-display font-bold text-foreground mb-4">Question by question</h2>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {released.perQuestion.map((q, i) => (
                <div
                  key={q.questionId}
                  title={`Q${i + 1}: ${q.pending ? 'grading pending' : q.testsTotal ? `${q.testsPassed}/${q.testsTotal} tests passed` : q.attempted ? (q.isCorrect ? 'correct' : 'wrong') : 'skipped'} (${q.marksAwarded >= 0 ? '+' : ''}${q.marksAwarded})`}
                  className={cn(
                    'h-10 rounded-lg flex flex-col items-center justify-center text-[11px] font-bold border',
                    q.isCorrect === true && 'bg-success/10 text-success border-success/30',
                    q.attempted && q.isCorrect === false && (q.pending || q.marksAwarded > 0)
                      ? 'bg-reward/10 text-reward border-reward/30'
                      : q.attempted && q.isCorrect === false && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
                    !q.attempted && 'bg-secondary text-muted-foreground border-border',
                  )}
                >
                  {q.isCorrect === true ? <CheckCircle2 className="w-3.5 h-3.5" /> : q.attempted ? <XCircle className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                  {i + 1}
                </div>
              ))}
            </div>
            {coding.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {coding.map(({ q, i }) => (
                  <li key={q.questionId} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                    <span className="font-semibold text-foreground">Q{i + 1} · Coding</span>
                    <span className="text-muted-foreground">
                      {q.pending ? 'Grading pending'
                        : !q.attempted ? 'Not answered'
                        : `${q.testsPassed}/${q.testsTotal} tests passed · +${q.marksAwarded}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {gradingPending && (
              <p className="mt-3 text-xs text-muted-foreground">
                Some code hasn't been graded yet because the code judge was busy. Those questions count as 0 until your faculty grades them — your score will update.
              </p>
            )}
          </section>
        </>
      )}

      <section className="grid sm:grid-cols-2 gap-3">
        <Link to="/topics" className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ListChecks className="w-5 h-5" /></div>
          <div><p className="text-sm font-bold text-foreground">Practise on Forge</p><p className="text-xs text-muted-foreground">Sharpen weak topics with coding problems</p></div>
        </Link>
        <Link to="/ai-coach" className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Bot className="w-5 h-5" /></div>
          <div><p className="text-sm font-bold text-foreground">Ask your AI mentor</p><p className="text-xs text-muted-foreground">Get concepts explained your way</p></div>
        </Link>
      </section>
    </div>
  );
}
