import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle2, XCircle, Trophy, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fetchTestMeta, startTestAttempt, saveAnswer, submitTestAttempt, fetchAttempt,
  type AnswerState, type AnswerStatus, type StartAttemptResult, type AttemptResult,
} from '@/data/testSeries';

type Phase = 'intro' | 'in_progress' | 'results';

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function paletteClasses(status: AnswerStatus | undefined, isCurrent: boolean) {
  const base = 'h-9 w-9 rounded-md flex items-center justify-center text-xs font-semibold border transition-colors';
  const ring = isCurrent ? 'ring-2 ring-offset-2 ring-primary' : '';
  switch (status) {
    case 'answered':
      return cn(base, ring, 'bg-emerald-500 text-white border-emerald-600');
    case 'answered_marked':
      return cn(base, ring, 'bg-purple-500 text-white border-purple-600');
    case 'marked_for_review':
      return cn(base, ring, 'bg-purple-300 text-purple-900 border-purple-400');
    case 'visited':
      return cn(base, ring, 'bg-rose-500 text-white border-rose-600');
    default:
      return cn(base, ring, 'bg-muted text-muted-foreground border-border');
  }
}

export default function CBTTestPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('intro');
  const [ackChecked, setAckChecked] = useState(false);
  const [attempt, setAttempt] = useState<StartAttemptResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [natInput, setNatInput] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const autoSubmittedRef = useRef(false);
  const visitedInFlightRef = useRef<Set<string>>(new Set());

  const metaQuery = useQuery({
    queryKey: ['test-meta', testId],
    queryFn: () => fetchTestMeta(testId!),
    enabled: !!testId && phase === 'intro',
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: () => startTestAttempt(testId!),
    onSuccess: async (res) => {
      if (res.status === 'completed') {
        const finalResult = await fetchAttempt(res.attemptId);
        setResult(finalResult);
        setPhase('results');
        return;
      }
      setAttempt(res);
      const committed: Record<string, AnswerState> = {};
      res.answers.forEach((a) => { committed[a.question_id] = a; });
      setAnswers(committed);
      setCurrentIndex(0);
      const remaining = Math.max(0, Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      autoSubmittedRef.current = false;
      setPhase('in_progress');
    },
    onError: (e: any) => toast.error(e?.message || 'Could not start the test.'),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTestAttempt(attempt!.attemptId),
    onSuccess: (res) => {
      setResult(res);
      setPhase('results');
    },
    onError: (e: any) => toast.error(e?.message || 'Could not submit the test.'),
  });

  // Countdown ticks purely for display -- the server's expires_at is what
  // actually governs whether an answer/submit is accepted.
  useEffect(() => {
    if (phase !== 'in_progress') return;
    const id = setInterval(() => setRemainingSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'in_progress' && remainingSeconds === 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      toast.info("Time's up — submitting your test.");
      submitMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, phase]);

  const currentQuestion = attempt?.questions[currentIndex] ?? null;

  // Load the current question's committed answer into the ephemeral input
  // state, and mark it visited (grey -> red) the first time it's opened.
  useEffect(() => {
    if (!attempt || !currentQuestion) return;
    const committed = answers[currentQuestion.id];
    setSelected(committed?.selected_options ?? []);
    setNatInput(committed?.nat_value !== null && committed?.nat_value !== undefined ? String(committed.nat_value) : '');

    const isUntouched = !committed || committed.status === 'not_visited';
    if (isUntouched && !visitedInFlightRef.current.has(currentQuestion.id)) {
      visitedInFlightRef.current.add(currentQuestion.id);
      saveAnswer(attempt.attemptId, currentQuestion.id, {}).then((res) => {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: { question_id: currentQuestion.id, status: res.status, selected_options: null, nat_value: null } }));
      }).catch(() => { /* best-effort visited marker; ignore failures */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, attempt]);

  if (!testId) return null;

  // ── Intro / instructions phase ──
  if (phase === 'intro') {
    if (metaQuery.isLoading) {
      return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    if (metaQuery.isError || !metaQuery.data) {
      return (
        <div className="max-w-lg mx-auto py-24 text-center space-y-3">
          <p className="text-muted-foreground">This test isn't available.</p>
          <Button variant="outline" onClick={() => navigate('/test-series')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Series</Button>
        </div>
      );
    }
    const meta = metaQuery.data;
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/test-series')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Series</Button>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h1 className="text-2xl font-bold">{meta.title}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {Math.round(meta.durationSeconds / 60)} minutes</span>
              <span>{meta.questionCount} questions</span>
              {meta.isSectional && <Badge variant="outline">Sectional</Badge>}
            </div>
            {meta.instructions && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm whitespace-pre-wrap">{meta.instructions}</div>
            )}
            <div className="rounded-md border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900 space-y-1">
              <p className="font-medium">Before you begin:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>The timer is set server-side and starts the moment you click "Begin Test" — it keeps running even if you refresh or lose connection.</li>
                <li>Use <strong>Save & Next</strong> to record an answer, <strong>Mark for Review & Next</strong> to flag a question, and <strong>Clear Response</strong> to remove your answer.</li>
                <li>The test auto-submits the instant time runs out, using whatever you last saved.</li>
              </ul>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ackChecked} onCheckedChange={(v) => setAckChecked(v === true)} />
              I have read and understood the instructions.
            </label>
            <Button className="w-full" size="lg" disabled={!ackChecked || startMutation.isPending} onClick={() => startMutation.mutate()}>
              {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Begin Test
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Results phase ──
  if (phase === 'results' && result) {
    const attempted = result.answers.filter((a) => a.status === 'answered' || a.status === 'answered_marked').length;
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <Trophy className="h-12 w-12 mx-auto text-amber-500" />
        <h1 className="text-2xl font-bold">Test Submitted</h1>
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-bold">{result.score ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {result.totalMarks}</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Correct</p>
              <p className="text-2xl font-bold flex items-center gap-1"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> {result.correctCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Questions Attempted</p>
              <p className="text-lg font-semibold">{attempted} / {result.totalQuestions}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {result.submittedAt ? new Date(result.submittedAt).toLocaleTimeString() : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => navigate('/test-series')}>Back to Test Series</Button>
      </div>
    );
  }

  // ── In-progress phase ──
  if (!attempt || !currentQuestion) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const commit = async (markedForReview: boolean, advance: boolean) => {
    const isNat = currentQuestion.questionType === 'nat';
    const payload = isNat
      ? { natValue: natInput.trim() === '' ? null : Number(natInput), markedForReview }
      : { selectedOptions: selected.length > 0 ? selected : null, markedForReview };
    try {
      const res = await saveAnswer(attempt.attemptId, currentQuestion.id, payload);
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          question_id: currentQuestion.id,
          status: res.status,
          selected_options: isNat ? null : (selected.length > 0 ? selected : null),
          nat_value: isNat ? (natInput.trim() === '' ? null : Number(natInput)) : null,
        },
      }));
      if (advance && currentIndex < attempt.questions.length - 1) setCurrentIndex((i) => i + 1);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save your answer — time may be up.');
    }
  };

  const clearResponse = async () => {
    setSelected([]);
    setNatInput('');
    try {
      const res = await saveAnswer(attempt.attemptId, currentQuestion.id, {});
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: { question_id: currentQuestion.id, status: res.status, selected_options: null, nat_value: null } }));
    } catch (e: any) {
      toast.error(e?.message || 'Could not clear the response.');
    }
  };

  const toggleMcq = (optionId: string) => setSelected([optionId]);
  const toggleMsq = (optionId: string) =>
    setSelected((prev) => (prev.includes(optionId) ? prev.filter((o) => o !== optionId) : [...prev, optionId]));

  const summary = attempt.questions.reduce(
    (acc, q) => {
      const st = answers[q.id]?.status ?? 'not_visited';
      acc[st] = (acc[st] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header: title + timer */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-card">
        <h1 className="font-semibold truncate">{attempt.test.title}</h1>
        <div className={cn('flex items-center gap-2 font-mono text-lg font-bold px-3 py-1 rounded-md', remainingSeconds < 60 ? 'bg-rose-100 text-rose-700' : 'bg-muted')}>
          <Clock className="h-4 w-4" /> {formatClock(remainingSeconds)}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline">Question {currentIndex + 1} of {attempt.questions.length}</Badge>
            <span className="text-sm text-muted-foreground">
              +{currentQuestion.marks}{currentQuestion.negativeMarks > 0 ? ` / -${currentQuestion.negativeMarks}` : ''} marks
            </span>
          </div>

          <p className="text-lg leading-relaxed whitespace-pre-wrap">{currentQuestion.body}</p>

          {currentQuestion.questionType === 'mcq' && (
            <RadioGroup value={selected[0] ?? ''} onValueChange={toggleMcq} className="space-y-2">
              {currentQuestion.options?.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value={opt.id} />
                  <span>{opt.text}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.questionType === 'msq' && (
            <div className="space-y-2">
              {currentQuestion.options?.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => toggleMsq(opt.id)} />
                  <span>{opt.text}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.questionType === 'nat' && (
            <div className="max-w-xs space-y-1.5">
              <Label className="text-xs">Enter your numeric answer</Label>
              <Input type="number" inputMode="decimal" value={natInput} onChange={(e) => setNatInput(e.target.value)} placeholder="e.g. 42" />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>Previous</Button>
            <Button variant="secondary" onClick={clearResponse}>Clear Response</Button>
            <Button variant="outline" onClick={() => commit(true, true)}>Mark for Review & Next</Button>
            <Button onClick={() => commit(false, true)}>Save & Next</Button>
          </div>
        </div>

        {/* Palette sidebar */}
        <div className="w-72 shrink-0 border-l bg-card p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" /> Answered ({summary.answered ?? 0})</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-rose-500" /> Not Answered ({summary.visited ?? 0})</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-purple-300" /> Marked ({summary.marked_for_review ?? 0})</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-purple-500" /> Marked & Answered ({summary.answered_marked ?? 0})</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted border" /> Not Visited</div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {attempt.questions.map((q, i) => (
              <button key={q.id} className={paletteClasses(answers[q.id]?.status, i === currentIndex)} onClick={() => setCurrentIndex(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <Button className="w-full" variant="destructive" onClick={() => setConfirmSubmitOpen(true)}>Submit Test</Button>
        </div>
      </div>

      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit test now?</AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {summary.answered ?? 0} of {attempt.questions.length} questions. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Working</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmSubmitOpen(false); submitMutation.mutate(); }}>
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
