import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Flag, History, PlusCircle, Power, ShieldAlert, WifiOff } from 'lucide-react';
import { api, post } from '@/api/client';
import type { LiveBoard as Board, LiveRow, LiveStatus, ReviewOutcome, TimelineItem } from '@/api/types';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useOrg } from '@/context/CampusContext';
import { cn } from '@/lib/utils';

// Live invigilation: everyone in the batch, refreshed every few seconds.

const STATUS: Record<LiveStatus, { label: string; className: string }> = {
  active: { label: 'Writing', className: 'bg-success/15 text-success' },
  offline: { label: 'Offline', className: 'bg-warning/15 text-warning' },
  not_started: { label: 'Not started', className: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', className: 'bg-primary/10 text-primary' },
};
const EVENT: Record<string, string> = {
  tab_switch: 'Switched tab', window_blur: 'Left the window', fullscreen_exit: 'Left full screen',
  copy: 'Tried to copy', paste: 'Tried to paste', context_menu: 'Right-clicked',
};
const OUTCOME: Record<ReviewOutcome, { label: string; className: string }> = {
  no_issue: { label: 'No issue', className: 'text-success' },
  warning: { label: 'Warning', className: 'text-warning' },
  malpractice: { label: 'Malpractice', className: 'text-destructive' },
};
const ENDED: Record<string, string> = {
  manual: 'Submitted', timeout: 'Time ran out', violations: 'Auto-submitted (violations)', closed: 'Closed', invigilator: 'Ended by invigilator',
};

const ago = (iso: string | null, now: number) => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};

type Filter = 'all' | LiveStatus | 'flagged';
type Action = { kind: 'timeline' | 'extend' | 'review' | 'end'; row: LiveRow } | null;

export default function LiveBoard() {
  const { orgId, assignmentId } = useParams();
  const { can } = useOrg(orgId);
  const canAct = can('assessments.invigilate');
  const [filter, setFilter] = useState<Filter>('all');
  const [action, setAction] = useState<Action>(null);
  const key = ['live', assignmentId];
  const board = useQuery({
    queryKey: key,
    queryFn: () => api<Board>(`/orgs/${orgId}/assignments/${assignmentId}/live`),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  // Count down between refreshes, corrected to the server's clock.
  const offset = useRef(0);
  useEffect(() => { if (board.data) offset.current = new Date(board.data.serverNow).getTime() - Date.now(); }, [board.data]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now() + offset.current), 1000); return () => clearInterval(id); }, []);

  const rows = useMemo(() => (board.data?.rows ?? []).filter((r) =>
    filter === 'all' || (filter === 'flagged' ? r.violations > 0 && !r.review : r.status === filter)), [board.data, filter]);

  if (board.isLoading) return <Loading />;
  if (board.error) return <ErrorNote error={board.error} />;
  const { assignment, summary } = board.data!;

  return (
    <>
      <Link to="../.." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Assignments
      </Link>
      <PageHeader
        title={assignment.title}
        description={`${assignment.batch} · closes ${formatDateTime(assignment.closesAt)}`}
        actions={<span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden /> Live · updates every 5 s</span>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Writing" value={summary.active} />
        <Stat label="Offline" value={summary.offline} hint="No signal for a minute" tone={summary.offline ? 'warning' : undefined} />
        <Stat label="Not started" value={summary.notStarted} />
        <Stat label="Submitted" value={`${summary.submitted}/${summary.assigned}`} />
        <Stat label="Needs review" value={summary.needsReview} hint="Violations nobody has reviewed" tone={summary.needsReview ? 'warning' : undefined} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Filter students">
        {([['all', 'All'], ['active', 'Writing'], ['offline', 'Offline'], ['flagged', 'Needs review'], ['not_started', 'Not started'], ['submitted', 'Submitted']] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
            className={cn('rounded-md px-3 py-1.5', filter === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent')}>{label}</button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th><th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Progress</th><th className="px-4 py-2.5 font-medium">Time left</th>
              <th className="px-4 py-2.5 font-medium">Proctoring</th><th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No students match this filter.</td></tr>}
            {rows.map((r) => {
              const open = r.status === 'active' || r.status === 'offline';
              const left = r.section ? new Date(r.section.endsAt).getTime() - now : r.expiresAt ? new Date(r.expiresAt).getTime() - now : 0;
              return (
                <tr key={r.userId} className={cn(r.violations > 0 && !r.review && 'bg-warning/5')}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.name ?? r.email}</p>
                    <p className="text-xs tabular text-muted-foreground">{r.rollNumber ?? r.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS[r.status].className)}>
                      {r.status === 'offline' && <WifiOff className="h-3 w-3" aria-hidden />}{STATUS[r.status].label}
                    </span>
                    {open && <p className="mt-0.5 text-xs text-muted-foreground">seen {ago(r.lastSeenAt, now)}</p>}
                    {r.status === 'submitted' && <p className="mt-0.5 text-xs text-muted-foreground">{r.submitReason ? ENDED[r.submitReason] : ''}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.attemptId ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <div className="h-full bg-primary" style={{ width: `${r.total ? (r.answered / r.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs tabular">{r.answered}/{r.total}</span>
                        </div>
                        {r.section && <p className="mt-0.5 text-xs text-muted-foreground">Section {r.section.index + 1}/{r.section.count} · {r.section.name}</p>}
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular">
                    {open ? <span className={cn(left < 5 * 60_000 && 'font-semibold text-warning')}><Clock className="mr-1 inline h-3.5 w-3.5" />{clock(left)}</span> : '—'}
                    {r.extraMinutes > 0 && <p className="text-xs text-muted-foreground">+{r.extraMinutes} min given</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.violations > 0
                      ? <span className="inline-flex items-center gap-1 font-medium text-warning"><ShieldAlert className="h-3.5 w-3.5" />{r.violations} {r.violations === 1 ? 'violation' : 'violations'}</span>
                      : <span className="text-muted-foreground">Clean</span>}
                    {r.lastEvent && <p className="text-xs text-muted-foreground">{EVENT[r.lastEvent.type] ?? r.lastEvent.type} · {ago(r.lastEvent.at, now)}</p>}
                    {r.review && <p className={cn('text-xs font-medium', OUTCOME[r.review.outcome].className)}>Reviewed: {OUTCOME[r.review.outcome].label}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {r.attemptId && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Timeline for ${r.name ?? r.email}`} onClick={() => setAction({ kind: 'timeline', row: r })}><History className="h-4 w-4" /></Button>
                        {canAct && (
                          <>
                            <Button size="sm" variant="ghost" aria-label={`Review ${r.name ?? r.email}`} onClick={() => setAction({ kind: 'review', row: r })}><Flag className="h-4 w-4" /></Button>
                            {open && <Button size="sm" variant="ghost" aria-label={`Extra time for ${r.name ?? r.email}`} onClick={() => setAction({ kind: 'extend', row: r })}><PlusCircle className="h-4 w-4" /></Button>}
                            {open && <Button size="sm" variant="ghost" className="text-destructive" aria-label={`End attempt of ${r.name ?? r.email}`} onClick={() => setAction({ kind: 'end', row: r })}><Power className="h-4 w-4" /></Button>}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">"Offline" means no signal from the student's browser for a minute — their answers are safe; the timer keeps running.</p>

      {action?.kind === 'timeline' && <TimelineDialog orgId={orgId!} assignmentId={assignmentId!} row={action.row} onClose={() => setAction(null)} />}
      {action && action.kind !== 'timeline' && (
        <ActionDialog orgId={orgId!} assignmentId={assignmentId!} action={{ kind: action.kind, row: action.row }} onClose={() => setAction(null)} />
      )}
    </>
  );
}

function TimelineDialog({ orgId, assignmentId, row, onClose }: { orgId: string; assignmentId: string; row: LiveRow; onClose: () => void }) {
  const timeline = useQuery({
    queryKey: ['timeline', row.attemptId],
    queryFn: () => api<{ items: TimelineItem[] }>(`/orgs/${orgId}/assignments/${assignmentId}/attempts/${row.attemptId}/timeline`),
    refetchInterval: 10_000,
  });
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Timeline · {row.name ?? row.email}</DialogTitle></DialogHeader>
        {timeline.isLoading ? <Loading /> : timeline.error ? <ErrorNote error={timeline.error} /> : (
          <ol className="relative ml-2 space-y-3 border-l pl-5 text-sm">
            {timeline.data!.items.map((i, n) => (
              <li key={n}>
                <span className={cn('absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full',
                  i.kind === 'event' ? (i.severity === 'violation' ? 'bg-destructive' : 'bg-warning') : i.kind === 'review' ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
                <p className="text-xs tabular text-muted-foreground">{time(i.at)}</p>
                {i.kind === 'started' && <p>Started the test</p>}
                {i.kind === 'event' && <p>{EVENT[i.type] ?? i.type} <span className={i.severity === 'violation' ? 'font-medium text-destructive' : 'text-warning'}>({i.severity})</span></p>}
                {i.kind === 'extend' && <p>+{i.minutes} min extra time{i.by ? ` by ${i.by}` : ''} — <span className="text-muted-foreground">{i.reason}</span></p>}
                {i.kind === 'force_submit' && <p className="font-medium">Ended by {i.by ?? 'an invigilator'} — <span className="font-normal text-muted-foreground">{i.reason}</span></p>}
                {i.kind === 'review' && <p>Reviewed: <span className={cn('font-medium', OUTCOME[i.outcome].className)}>{OUTCOME[i.outcome].label}</span>{i.by ? ` by ${i.by}` : ''}{i.note && <span className="block text-muted-foreground">{i.note}</span>}</p>}
                {i.kind === 'submitted' && <p className="font-medium">{i.reason ? ENDED[i.reason] : 'Submitted'}</p>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionDialog({ orgId, assignmentId, action, onClose }: {
  orgId: string; assignmentId: string; action: { kind: 'extend' | 'review' | 'end'; row: LiveRow }; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState(10);
  const [outcome, setOutcome] = useState<ReviewOutcome>(action.row.violations > 0 ? 'warning' : 'no_issue');
  const [text, setText] = useState('');
  const base = `/orgs/${orgId}/assignments/${assignmentId}/attempts/${action.row.attemptId}`;
  const who = action.row.name ?? action.row.email;
  const run = useMutation({
    mutationFn: () => action.kind === 'extend' ? post(`${base}/extend`, { minutes, reason: text })
      : action.kind === 'end' ? post(`${base}/force-submit`, { reason: text })
      : post(`${base}/reviews`, { outcome, note: text || null }),
    onSuccess: () => {
      toast.success(action.kind === 'extend' ? `${minutes} minutes added for ${who}` : action.kind === 'end' ? `${who}'s attempt has ended` : 'Review saved');
      qc.invalidateQueries({ queryKey: ['live', assignmentId] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const needsReason = action.kind !== 'review';
  const submit = (e: FormEvent) => { e.preventDefault(); if (needsReason && text.trim().length < 3) { toast.error('Write a short reason — it goes on the record.'); return; } run.mutate(); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {action.kind === 'extend' ? `Extra time for ${who}` : action.kind === 'end' ? `End ${who}'s attempt?` : `Review ${who}`}
            </DialogTitle>
          </DialogHeader>
          {action.kind === 'extend' && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">How much?</legend>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 30, 60].map((m) => (
                  <button key={m} type="button" onClick={() => setMinutes(m)} aria-pressed={minutes === m}
                    className={cn('rounded-md border px-3 py-1.5 text-sm', minutes === m ? 'border-primary bg-primary/10 font-medium text-primary' : 'hover:bg-accent')}>+{m} min</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Added to the test and to the section they're in now.</p>
            </fieldset>
          )}
          {action.kind === 'end' && (
            <p className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> The attempt is submitted now and scored on the answers already saved. This can't be undone.
            </p>
          )}
          {action.kind === 'review' && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Decision ({action.row.violations} {action.row.violations === 1 ? 'violation' : 'violations'} recorded)</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(OUTCOME) as ReviewOutcome[]).map((o) => (
                  <label key={o} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', outcome === o && 'border-primary bg-primary/5')}>
                    <input type="radio" name="outcome" checked={outcome === o} onChange={() => setOutcome(o)} className="accent-[var(--color-primary)]" />
                    <span className={OUTCOME[o].className}>{OUTCOME[o].label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="space-y-1.5">
            <label htmlFor="action-text" className="text-sm font-medium">{needsReason ? 'Reason (goes on the record)' : 'Note (optional)'}</label>
            <Textarea id="action-text" rows={3} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={action.kind === 'extend' ? 'e.g. Power cut in lab 3' : action.kind === 'end' ? 'e.g. Phone found on the desk' : 'What you saw or did'} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={action.kind === 'end' ? 'destructive' : 'default'} disabled={run.isPending}>
              {action.kind === 'extend' ? <><PlusCircle className="mr-1.5 h-4 w-4" /> Add {minutes} min</> : action.kind === 'end' ? <><Power className="mr-1.5 h-4 w-4" /> End attempt</> : <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Save review</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
