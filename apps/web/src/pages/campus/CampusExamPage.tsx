import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Clock, Loader2, ShieldCheck, Maximize, Flag, Eraser, CheckCircle2,
  AlertTriangle, LayoutGrid, CloudOff, Check, ShieldAlert, BookOpenText, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMyAssignments } from '@/hooks/useCampus';
import {
  CampusApiError, reportProctoringEvent, saveCampusAnswer, startAssignment, submitCampusAttempt,
  type AnswerStatus, type AttemptAnswer, type AttemptView, type ExamQuestion, type MyAssignment, type ProctoringEvent,
} from '@/services/campus.service';
import { enterFullscreen, exitFullscreen, fullscreenSupported, useLockdown } from '@/features/campus/useLockdown';
import { assignmentStatus, formatWhen } from '@/features/campus/assignmentStatus';

type SavePayload = { selectedOptions?: string[] | null; natValue?: number | null; markedForReview?: boolean };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const LETTERS = 'ABCDEFGHIJ';

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

/** Same rule the server applies, so the palette updates instantly. */
function statusFor(payload: SavePayload): AnswerStatus {
  const hasAnswer = Boolean(payload.selectedOptions?.length) || (payload.natValue !== undefined && payload.natValue !== null);
  if (hasAnswer) return payload.markedForReview ? 'answered_marked' : 'answered';
  return payload.markedForReview ? 'marked_for_review' : 'visited';
}

const isMarked = (s?: AnswerStatus) => s === 'marked_for_review' || s === 'answered_marked';
const isAnswered = (s?: AnswerStatus) => s === 'answered' || s === 'answered_marked';

function paletteClass(status: AnswerStatus | undefined, current: boolean) {
  return cn(
    'h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold border transition-all relative',
    current && 'ring-2 ring-offset-2 ring-offset-background ring-primary',
    status === 'answered' && 'bg-success text-white border-success',
    status === 'answered_marked' && 'bg-purple-500 text-white border-purple-600',
    status === 'marked_for_review' && 'bg-purple-200 text-purple-900 border-purple-300 dark:bg-purple-900/60 dark:text-purple-100 dark:border-purple-700',
    status === 'visited' && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40',
    (!status || status === 'not_visited') && 'bg-secondary text-muted-foreground border-border',
  );
}

// ─── Instructions screen ─────────────────────────────────────────────────

function ExamIntro({ a, onStart, starting }: { a: MyAssignment; onStart: () => void; starting: boolean }) {
  const navigate = useNavigate();
  const [ack, setAck] = useState(false);
  const p = a.proctoring;
  const resuming = a.latestStatus === 'in_progress';
  const fsNote = p?.enabled && p.requireFullscreen && !fullscreenSupported();

  return (
    <div className="min-h-screen bg-depth">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>

        <div className="card-glass rounded-2xl p-6 sm:p-8 border border-border/40 space-y-6">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{a.college} · {a.batch}</p>
            <h1 className="text-2xl font-display font-bold text-foreground mt-1">{a.title}</h1>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Duration</p>
              <p className="text-lg font-display font-bold text-foreground">{a.durationMinutes} min</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Attempt</p>
              <p className="text-lg font-display font-bold text-foreground">
                {resuming ? a.attemptsUsed : a.attemptsUsed + 1} of {a.maxAttempts}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Closes</p>
              <p className="text-sm font-bold text-foreground mt-1">{formatWhen(a.closesAt)}</p>
            </div>
          </div>

          {a.instructions && (
            <div className="rounded-xl border border-border/50 bg-background/50 p-4">
              <p className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary" /> From your faculty</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.instructions}</p>
            </div>
          )}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
            <p className="font-bold text-foreground">How this works</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /><span>Every answer saves the moment you pick it. You can change it any time before submitting.</span></li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /><span>The timer runs on the server. If your browser closes, reopen this page and press <strong className="text-foreground">Resume</strong>.</span></li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /><span>Use <strong className="text-foreground">Mark for review</strong> to flag a question you want to revisit.</span></li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /><span>When time runs out, your saved answers are submitted automatically.</span></li>
            </ul>
          </div>

          {p?.enabled && (
            <div className="rounded-xl border border-reward/30 bg-reward/5 p-4 space-y-2 text-sm">
              <p className="font-bold text-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-reward" /> This test is proctored</p>
              <ul className="space-y-1.5 text-muted-foreground list-disc pl-5">
                {p.requireFullscreen && <li>It runs in full screen. Leaving full screen pauses the test until you return.</li>}
                <li>Switching tabs or apps is recorded.{p.warnFirst ? ' The first time is only a warning.' : ''}</li>
                {p.maxViolations !== null && <li>After <strong className="text-foreground">{p.maxViolations}</strong> violation{p.maxViolations === 1 ? '' : 's'}, the test submits automatically.</li>}
                {p.blockClipboard && <li>Copy, paste and right-click are turned off.</li>}
                <li>Close other apps and notifications before you begin.</li>
              </ul>
              {fsNote && <p className="text-xs text-muted-foreground">Your browser can't go full screen, so this test runs in a normal window. Tab switches are still recorded.</p>}
            </div>
          )}

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span className="text-foreground">I have read the instructions and I'm ready to begin.</span>
          </label>

          <Button className="w-full h-12 text-base" disabled={!ack || starting} onClick={onStart}>
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {resuming ? 'Resume test' : 'Begin test'}
            {!starting && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── One question ────────────────────────────────────────────────────────

function QuestionView({
  q, index, total, answer, natDraft, onSelect, onNat,
}: {
  q: ExamQuestion; index: number; total: number; answer?: AttemptAnswer; natDraft: string;
  onSelect: (optionId: string) => void; onNat: (value: string) => void;
}) {
  const selected = answer?.selected_options ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-foreground">Question {index + 1} <span className="text-muted-foreground font-medium">of {total}</span></span>
        {q.section && <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">{q.section}</span>}
        <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">+{q.marks}</span>
        {q.negativeMarks > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-semibold">−{q.negativeMarks} if wrong</span>}
        {q.type === 'msq' && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Select all that apply</span>}
      </div>

      {q.passage && (
        <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><BookOpenText className="w-3.5 h-3.5" /> Read this first</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{q.passage}</p>
        </div>
      )}

      <p className="text-lg leading-relaxed text-foreground whitespace-pre-wrap">{q.body}</p>

      {(q.type === 'mcq' || q.type === 'msq') && (
        <div className="space-y-2.5" role={q.type === 'mcq' ? 'radiogroup' : 'group'}>
          {q.options?.map((opt, i) => {
            const on = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role={q.type === 'mcq' ? 'radio' : 'checkbox'}
                aria-checked={on}
                onClick={() => onSelect(opt.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all',
                  on ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5',
                )}
              >
                <span className={cn(
                  'w-8 h-8 shrink-0 flex items-center justify-center text-sm font-bold border transition-colors',
                  q.type === 'mcq' ? 'rounded-full' : 'rounded-lg',
                  on ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border',
                )}>
                  {on && q.type === 'msq' ? <Check className="w-4 h-4" /> : LETTERS[i]}
                </span>
                <span className="text-sm sm:text-base text-foreground">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'nat' && (
        <div className="max-w-xs space-y-1.5">
          <label htmlFor={`nat-${q.id}`} className="text-xs font-semibold text-muted-foreground">Type your answer (a number)</label>
          <Input
            id={`nat-${q.id}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={natDraft}
            onChange={(e) => onNat(e.target.value)}
            placeholder="e.g. 42 or 3.5"
            className="h-12 text-lg font-mono"
          />
          {natDraft.trim() !== '' && !Number.isFinite(Number(natDraft)) && (
            <p className="text-xs text-red-600 dark:text-red-400">That isn't a number yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Palette (sidebar on desktop, sheet on mobile) ──────────────────────

function Palette({
  questions, answers, current, onJump,
}: { questions: ExamQuestion[]; answers: Record<string, AttemptAnswer>; current: number; onJump: (i: number) => void }) {
  const counts = questions.reduce(
    (acc, q) => {
      const s = answers[q.id]?.status ?? 'not_visited';
      if (isAnswered(s)) acc.answered += 1;
      else if (s === 'visited') acc.skipped += 1;
      else if (s === 'not_visited') acc.notVisited += 1;
      if (isMarked(s)) acc.marked += 1;
      return acc;
    },
    { answered: 0, skipped: 0, marked: 0, notVisited: 0 }
  );
  const sections = [...new Set(questions.map((q) => q.section ?? ''))];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success" /> Answered <b className="ml-auto text-foreground">{counts.answered}</b></div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-red-500/30 border border-red-500/40" /> Skipped <b className="ml-auto text-foreground">{counts.skipped}</b></div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-purple-400" /> For review <b className="ml-auto text-foreground">{counts.marked}</b></div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-secondary border border-border" /> Not seen <b className="ml-auto text-foreground">{counts.notVisited}</b></div>
      </div>
      {sections.map((section) => (
        <div key={section || 'all'} className="space-y-2">
          {section && <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{section}</p>}
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => ((q.section ?? '') === section ? (
              <button key={q.id} onClick={() => onJump(i)} className={paletteClass(answers[q.id]?.status, i === current)} aria-label={`Question ${i + 1}`}>
                {i + 1}
                {isMarked(answers[q.id]?.status) && <Flag className="absolute -top-1 -right-1 w-3 h-3 text-purple-600 fill-purple-400" />}
              </button>
            ) : null))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── The exam ────────────────────────────────────────────────────────────

function ExamRunner({ initial, collegeName }: { initial: AttemptView; collegeName?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const attemptId = initial.attemptId;
  const questions = initial.questions;

  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>(() =>
    Object.fromEntries((initial.answers ?? []).map((a) => [a.question_id, a]))
  );
  const [current, setCurrent] = useState(0);
  const [natDraft, setNatDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [violations, setViolations] = useState(initial.violationCount);
  const [warning, setWarning] = useState<null | { kind: 'warning' | 'violation'; count: number; max: number | null }>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [hasBeenFullscreen, setHasBeenFullscreen] = useState(false);

  // Server-corrected clock: the server decides when time is up.
  const clockOffset = useRef(new Date(initial.serverNow).getTime() - Date.now());
  const expiresAt = new Date(initial.expiresAt).getTime();
  const secondsLeft = () => (expiresAt - (Date.now() + clockOffset.current)) / 1000;
  const [remaining, setRemaining] = useState(secondsLeft);

  const pending = useRef(new Map<string, SavePayload>());
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const natTimer = useRef<ReturnType<typeof setTimeout>>();
  const finished = useRef(false);

  const q = questions[current];

  const finish = useCallback(async (reason: 'manual' | 'timeout' | 'violations') => {
    if (finished.current) return;
    finished.current = true;
    setFinishing(true);
    // Last chance to get unsaved answers in before the server scores.
    for (const [qid, payload] of pending.current) {
      try { await saveCampusAnswer(attemptId, qid, payload); } catch { /* scored on what the server already has */ }
    }
    pending.current.clear();
    try {
      if (reason !== 'violations') await submitCampusAttempt(attemptId);
    } catch (e) {
      // Already submitted (time up / auto-submit) is fine; anything else, let them retry.
      if (!(e instanceof CampusApiError && e.status === 409)) {
        finished.current = false;
        setFinishing(false);
        toast.error((e as Error).message || 'Could not submit. Check your connection and try again.');
        return;
      }
    }
    exitFullscreen();
    void queryClient.invalidateQueries({ queryKey: ['campus-my-assignments'] });
    navigate(`/college/attempts/${attemptId}`, { replace: true, state: { justSubmitted: true, reason } });
  }, [attemptId, navigate, queryClient]);

  // ── Autosave queue ──
  const flush = useCallback(async () => {
    if (inFlight.current || finished.current) return;
    const next = pending.current.entries().next();
    if (next.done) { setSaveState((s) => (s === 'saving' ? 'saved' : s)); return; }
    const [qid, payload] = next.value;
    inFlight.current = true;
    setSaveState('saving');
    try {
      const res = await saveCampusAnswer(attemptId, qid, payload);
      if (pending.current.get(qid) === payload) {
        pending.current.delete(qid);
        // Only trust the server's status if nothing newer was queued meanwhile.
        setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? { question_id: qid, selected_options: null, nat_value: null }), status: res.status } }));
      }
      inFlight.current = false;
      if (pending.current.size === 0) setSaveState('saved');
      void flush();
    } catch (e) {
      inFlight.current = false;
      if (e instanceof CampusApiError && e.status === 409) { void finish('timeout'); return; }
      setSaveState('error');
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void flush(), 4000);
    }
  }, [attemptId, finish]);

  const queueSave = useCallback((qid: string, payload: SavePayload) => {
    pending.current.set(qid, payload);
    setAnswers((prev) => ({
      ...prev,
      [qid]: {
        question_id: qid,
        status: statusFor(payload),
        selected_options: payload.selectedOptions?.length ? payload.selectedOptions : null,
        nat_value: payload.natValue ?? null,
      },
    }));
    void flush();
  }, [flush]);

  useEffect(() => {
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => { window.removeEventListener('online', online); clearTimeout(retryTimer.current); clearTimeout(natTimer.current); };
  }, [flush]);

  // ── Timer ──
  const warned = useRef({ five: false, one: false });
  useEffect(() => {
    const id = setInterval(() => {
      const left = secondsLeft();
      setRemaining(left);
      if (left <= 300 && left > 60 && !warned.current.five) { warned.current.five = true; toast.warning('5 minutes left.'); }
      if (left <= 60 && left > 0 && !warned.current.one) { warned.current.one = true; toast.warning('1 minute left — your answers are saved.'); }
      // A short grace lets the server's clock decide, so the attempt is recorded as timed out, not submitted early.
      if (left <= -1.5) void finish('timeout');
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  // ── Opening a question marks it seen and loads its numeric draft ──
  useEffect(() => {
    if (!q) return;
    const a = answers[q.id];
    setNatDraft(a?.nat_value !== null && a?.nat_value !== undefined ? String(a.nat_value) : '');
    if (!a || a.status === 'not_visited') queueSave(q.id, { markedForReview: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // ── Leaving the page mid-test ──
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (!finished.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // ── Proctoring ──
  const onProctorEvent = useCallback(async (type: ProctoringEvent) => {
    if (finished.current) return;
    try {
      const res = await reportProctoringEvent(attemptId, type);
      setViolations(res.violationCount);
      if (res.autoSubmitted) {
        toast.error('Your test was submitted automatically after repeated violations.');
        void finish('violations');
        return;
      }
      const leave = type === 'tab_switch' || type === 'window_blur' || type === 'fullscreen_exit';
      if (leave && res.severity) {
        setWarning({ kind: res.severity, count: res.violationCount, max: res.maxViolations ?? initial.proctoring.maxViolations });
      }
    } catch { /* offline: the server still enforces the clock; nothing to do */ }
  }, [attemptId, finish, initial.proctoring.maxViolations]);

  const lockdown = useLockdown({
    policy: initial.proctoring,
    active: !finishing,
    onEvent: onProctorEvent,
    onBlocked: (type) => toast.info(type === 'context_menu' ? 'Right-click is turned off during this test.' : 'Copy and paste are turned off during this test.'),
  });
  useEffect(() => { if (lockdown.fullscreen) setHasBeenFullscreen(true); }, [lockdown.fullscreen]);

  if (!q) return null;
  const a = answers[q.id];
  const marked = isMarked(a?.status);

  const payloadFor = (overrides: Partial<{ selected: string[]; nat: string; marked: boolean }> = {}): SavePayload => {
    const m = overrides.marked ?? marked;
    if (q.type === 'nat') {
      const raw = (overrides.nat ?? natDraft).trim();
      const n = raw === '' ? null : Number(raw);
      return { natValue: n !== null && Number.isFinite(n) ? n : null, markedForReview: m };
    }
    const sel = overrides.selected ?? a?.selected_options ?? [];
    return { selectedOptions: sel.length ? sel : null, markedForReview: m };
  };

  const onSelect = (optionId: string) => {
    const prev = a?.selected_options ?? [];
    const selected = q.type === 'mcq'
      ? (prev[0] === optionId ? [] : [optionId])
      : prev.includes(optionId) ? prev.filter((o) => o !== optionId) : [...prev, optionId];
    queueSave(q.id, payloadFor({ selected }));
  };

  const onNat = (value: string) => {
    setNatDraft(value);
    clearTimeout(natTimer.current);
    const qid = q.id;
    natTimer.current = setTimeout(() => {
      const raw = value.trim();
      const n = raw === '' ? null : Number(raw);
      if (raw !== '' && !Number.isFinite(n)) return;
      queueSave(qid, { natValue: n, markedForReview: isMarked(answers[qid]?.status) });
    }, 600);
  };

  const commitNatNow = () => {
    if (q.type !== 'nat') return;
    clearTimeout(natTimer.current);
    const p = payloadFor();
    const savedValue = a?.nat_value ?? null;
    if (p.natValue !== savedValue) queueSave(q.id, p);
  };

  const go = (i: number) => {
    commitNatNow();
    setCurrent(Math.max(0, Math.min(questions.length - 1, i)));
    setPaletteOpen(false);
  };

  const toggleMark = () => queueSave(q.id, payloadFor({ marked: !marked }));
  const clear = () => { setNatDraft(''); queueSave(q.id, { selectedOptions: null, natValue: null, markedForReview: marked }); };

  const answeredCount = questions.filter((x) => isAnswered(answers[x.id]?.status)).length;
  const markedCount = questions.filter((x) => isMarked(answers[x.id]?.status)).length;
  const low = remaining <= 60;
  const lowish = remaining <= 300;

  return (
    <div className={cn('flex flex-col h-[100dvh] bg-background', initial.proctoring.enabled && initial.proctoring.blockClipboard && 'select-none')}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 px-4 sm:px-6 h-14 bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{collegeName ?? 'College test'}</p>
          <h1 className="text-sm font-bold text-foreground truncate">{initial.assignment.title}</h1>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {saveState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>}
          {saveState === 'saved' && <><CheckCircle2 className="w-3.5 h-3.5 text-success" /> All answers saved</>}
          {saveState === 'error' && <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5"><CloudOff className="w-3.5 h-3.5" /> Not saved — retrying</span>}
        </div>

        {initial.proctoring.enabled && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg',
              violations > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-secondary text-muted-foreground',
            )}
            title="Violations recorded"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {violations}{initial.proctoring.maxViolations !== null ? `/${initial.proctoring.maxViolations}` : ''}
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-1.5 font-mono text-base font-bold px-3 py-1 rounded-lg tabular-nums',
            low ? 'bg-destructive text-destructive-foreground animate-pulse' : lowish ? 'bg-reward/15 text-reward' : 'bg-secondary text-foreground',
          )}
          aria-label="Time left"
        >
          <Clock className="w-4 h-4" /> {formatClock(remaining)}
        </div>

        <Button size="sm" variant="destructive" className="hidden sm:inline-flex" onClick={() => { commitNatNow(); setConfirmOpen(true); }} disabled={finishing}>
          Submit
        </Button>
      </header>

      {saveState === 'error' && (
        <div className="md:hidden bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-4 py-1.5 flex items-center gap-1.5">
          <CloudOff className="w-3.5 h-3.5" /> Connection lost — we'll keep retrying your answers.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 sm:p-8 pb-28">
            <QuestionView q={q} index={current} total={questions.length} answer={a} natDraft={natDraft} onSelect={onSelect} onNat={onNat} />
          </div>
        </main>

        <aside className="hidden lg:block w-72 shrink-0 border-l border-border/60 bg-card p-5 overflow-y-auto space-y-5">
          <Palette questions={questions} answers={answers} current={current} onJump={go} />
          <Button className="w-full" variant="destructive" onClick={() => { commitNatNow(); setConfirmOpen(true); }} disabled={finishing}>Submit test</Button>
        </aside>
      </div>

      {/* Footer actions */}
      <footer className="border-t border-border/60 bg-card px-3 sm:px-6 py-3 shrink-0">
        <div className="max-w-3xl mx-auto lg:max-w-none flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous question">
            <ArrowLeft className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Previous</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={!isAnswered(a?.status) && natDraft === ''}>
            <Eraser className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Clear</span>
          </Button>
          <Button variant={marked ? 'secondary' : 'ghost'} size="sm" onClick={toggleMark} className={cn(marked && 'text-purple-600 dark:text-purple-300')}>
            <Flag className={cn('w-4 h-4 sm:mr-1.5', marked && 'fill-current')} /><span className="hidden sm:inline">{marked ? 'Marked' : 'Mark for review'}</span>
          </Button>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="All questions">
            <LayoutGrid className="w-4 h-4 mr-1.5" /> {answeredCount}/{questions.length}
          </Button>
          <div className="flex-1" />
          {current < questions.length - 1 ? (
            <Button size="sm" onClick={() => go(current + 1)}>Next <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => { commitNatNow(); setConfirmOpen(true); }} disabled={finishing}>Finish test</Button>
          )}
        </div>
      </footer>

      {/* Mobile palette */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>All questions</SheetTitle></SheetHeader>
          <div className="pt-4 space-y-5">
            <Palette questions={questions} answers={answers} current={current} onJump={go} />
            <Button className="w-full" variant="destructive" onClick={() => { setPaletteOpen(false); setConfirmOpen(true); }}>Submit test</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Submit confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your test?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-success/10 p-2"><p className="text-lg font-bold text-success">{answeredCount}</p><p className="text-[11px]">Answered</p></div>
                  <div className="rounded-xl bg-secondary p-2"><p className="text-lg font-bold text-foreground">{questions.length - answeredCount}</p><p className="text-[11px]">Unanswered</p></div>
                  <div className="rounded-xl bg-purple-500/10 p-2"><p className="text-lg font-bold text-purple-600 dark:text-purple-300">{markedCount}</p><p className="text-[11px]">For review</p></div>
                </div>
                <p>You still have <strong className="text-foreground">{formatClock(remaining)}</strong>. Once you submit, you can't change your answers.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finish('manual')}>
              {finishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proctoring warning */}
      <AlertDialog open={warning !== null && !lockdown.blocked} onOpenChange={(o) => !o && setWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className={cn('w-5 h-5', warning?.kind === 'violation' ? 'text-red-600 dark:text-red-400' : 'text-reward')} />
              {warning?.kind === 'violation' ? 'Violation recorded' : 'Please stay on the test'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {warning?.kind === 'violation'
                ? warning.max !== null
                  ? `You left the test window. That's ${warning.count} of ${warning.max} — at ${warning.max} your test is submitted automatically.`
                  : 'You left the test window. Your faculty can see this in the report.'
                : 'You left the test window. This time it is only a warning — next time it counts as a violation.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWarning(null)}>Back to my test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full-screen gate */}
      {lockdown.blocked && !finishing && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-glass rounded-2xl p-6 sm:p-8 border border-border/40 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Maximize className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">
              {hasBeenFullscreen ? 'Return to full screen' : 'Enter full screen to begin'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasBeenFullscreen
                ? 'This test runs in full screen. Your timer is still running — go back to keep answering.'
                : 'This test is proctored and runs in full screen. Your timer has started.'}
            </p>
            <p className="text-xs text-muted-foreground">
              <Clock className="inline w-3.5 h-3.5 mr-1" />{formatClock(remaining)} left
              {initial.proctoring.maxViolations !== null && <> · {violations}/{initial.proctoring.maxViolations} violations</>}
            </p>
            <Button className="w-full h-11" onClick={() => void enterFullscreen().then((ok) => { if (!ok) toast.error('Your browser blocked full screen. Try pressing F11.'); })}>
              <Maximize className="w-4 h-4 mr-2" /> {hasBeenFullscreen ? 'Return to full screen' : 'Enter full screen'}
            </Button>
          </div>
        </div>
      )}

      {finishing && (
        <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-foreground">Submitting your answers…</p>
        </div>
      )}
    </div>
  );
}

// ─── Route ───────────────────────────────────────────────────────────────

export default function CampusExamPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const assignments = useMyAssignments();
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [starting, setStarting] = useState(false);

  const assignment = useMemo(() => assignments.data?.find((x) => x.id === assignmentId), [assignments.data, assignmentId]);

  const start = async () => {
    if (!assignmentId || !assignment) return;
    setStarting(true);
    // Ask for full screen inside the click, before the network call, so the browser allows it.
    if (assignment.proctoring?.enabled && assignment.proctoring.requireFullscreen) await enterFullscreen();
    try {
      const view = await startAssignment(assignmentId);
      if (view.status === 'completed') {
        exitFullscreen();
        navigate(`/college/attempts/${view.attemptId}`, { replace: true });
        return;
      }
      setAttempt(view);
    } catch (e) {
      exitFullscreen();
      toast.error((e as Error).message || 'Could not start the test.');
    } finally {
      setStarting(false);
    }
  };

  if (attempt) return <ExamRunner initial={attempt} collegeName={assignment?.college} />;

  if (assignments.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-depth"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-depth p-4">
        <div className="card-glass rounded-2xl p-8 border border-border/40 max-w-md text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-reward" />
          <p className="font-semibold text-foreground">{assignments.isError ? 'College services are unavailable right now.' : "This test isn't available to you."}</p>
          <p className="text-sm text-muted-foreground">It may have been removed, or it's for a different batch.</p>
          <Button variant="outline" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>
        </div>
      </div>
    );
  }

  const status = assignmentStatus(assignment);
  if (status.action.kind === 'result') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-depth p-4">
        <div className="card-glass rounded-2xl p-8 border border-border/40 max-w-md text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 mx-auto text-success" />
          <p className="font-semibold text-foreground">You've already taken this test</p>
          <p className="text-sm text-muted-foreground">
            {assignment.maxAttempts > 1 ? `You've used all ${assignment.maxAttempts} attempts.` : 'It allows one attempt.'}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>
            <Button onClick={() => navigate(`/college/attempts/${assignment.latestAttemptId}`)}>View result</Button>
          </div>
        </div>
      </div>
    );
  }

  if (assignment.state !== 'open') {
    const upcoming = assignment.state === 'upcoming';
    return (
      <div className="min-h-screen flex items-center justify-center bg-depth p-4">
        <div className="card-glass rounded-2xl p-8 border border-border/40 max-w-md text-center space-y-3">
          <Clock className="w-8 h-8 mx-auto text-primary" />
          <p className="font-semibold text-foreground">{upcoming ? 'This test has not opened yet' : 'This test has closed'}</p>
          <p className="text-sm text-muted-foreground">{upcoming ? `It opens ${formatWhen(assignment.opensAt)}.` : `It closed ${formatWhen(assignment.closesAt)}.`}</p>
          <Button variant="outline" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>
        </div>
      </div>
    );
  }

  return <ExamIntro a={assignment} onStart={start} starting={starting} />;
}
