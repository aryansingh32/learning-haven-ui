import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Download, Hourglass, Radio, RefreshCw } from 'lucide-react';
import { api, del, download, post, put } from '@/api/client';
import type { Accommodation, ResultRow, Results } from '@/api/types';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/CampusContext';

const STATUS: Record<ResultRow['status'], { label: string; variant: 'secondary' | 'outline' | 'default' }> = {
  submitted: { label: 'Submitted', variant: 'secondary' },
  in_progress: { label: 'In progress', variant: 'default' },
  not_attempted: { label: 'Not attempted', variant: 'outline' },
};
const ENDED: Record<string, string> = {
  manual: 'Submitted', timeout: 'Time ran out', violations: 'Auto-submitted', closed: 'Closed', invigilator: 'Ended by invigilator',
};

type SortKey = 'roll' | 'score' | 'violations';

export default function AssignmentResults() {
  const { orgId, assignmentId } = useParams();
  const { can } = useOrg(orgId);
  const [filter, setFilter] = useState<'all' | ResultRow['status'] | 'flagged'>('all');
  const [sort, setSort] = useState<SortKey>('roll');
  const results = useQuery({
    queryKey: ['results', assignmentId],
    queryFn: () => api<Results>(`/orgs/${orgId}/assignments/${assignmentId}/results`),
    refetchInterval: 30_000, // live-ish while a test is running
  });
  const qc = useQueryClient();
  const regrade = useMutation({
    mutationFn: () => post<{ attempts: number; judged: number; pending: number }>(`/orgs/${orgId}/assignments/${assignmentId}/regrade`, {}),
    onSuccess: (r) => {
      if (r.pending) toast.warning(`${r.judged} graded; ${r.pending} still pending — the code judge stopped responding.`);
      else toast.success(r.judged ? `Graded ${r.judged} coding ${r.judged === 1 ? 'answer' : 'answers'}` : 'Nothing was waiting to be graded');
      qc.invalidateQueries({ queryKey: ['results', assignmentId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = (results.data?.rows ?? []).filter((r) => filter === 'all' || (filter === 'flagged' ? r.violations > 0 : r.status === filter));
    if (sort === 'score') return [...list].sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
    if (sort === 'violations') return [...list].sort((a, b) => b.violations - a.violations);
    return list;
  }, [results.data, filter, sort]);

  if (results.isLoading) return <Loading />;
  if (results.error) return <ErrorNote error={results.error} />;
  const { assignment, summary } = results.data!;

  async function exportCsv() {
    try { await download(`/orgs/${orgId}/assignments/${assignmentId}/results?format=csv`, 'results.csv'); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Assignments
      </Link>
      <PageHeader title={assignment.title} description={assignment.batch}
        actions={<>
          <Button variant="outline" asChild><Link to="live"><Radio className="mr-2 h-4 w-4" /> Live view</Link></Button>
          {can('reports.export') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
        </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted" value={`${summary.submitted}/${summary.assigned}`} hint={summary.notAttempted ? `${summary.notAttempted} not attempted` : 'Everyone has attempted'} />
        <Stat label="Average" value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`} hint="Of students who submitted" />
        <Stat label="Range" value={summary.highestPercent === null ? '—' : `${summary.lowestPercent}–${summary.highestPercent}%`} />
        <Stat label="Flagged" value={summary.flagged} hint="Left the test at least once" tone={summary.flagged ? 'warning' : undefined} />
      </div>

      {summary.gradingPending > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-warning" aria-hidden />
            {summary.gradingPending} {summary.gradingPending === 1 ? 'student has' : 'students have'} coding answers waiting to be graded — the code judge was unavailable when they submitted. Their scores count those questions as 0 for now.
          </p>
          {can('assessments.grade') && can('reports.view') && (
            <Button size="sm" onClick={() => regrade.mutate()} disabled={regrade.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${regrade.isPending ? 'animate-spin' : ''}`} /> Grade now
            </Button>
          )}
        </div>
      )}

      {can('assessments.create') && <ExtraTime orgId={orgId!} assignmentId={assignmentId!} rows={results.data!.rows} />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Filter students">
          {([['all', 'All'], ['submitted', 'Submitted'], ['in_progress', 'In progress'], ['not_attempted', 'Not attempted'], ['flagged', 'Flagged']] as const).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={`rounded-md px-3 py-1.5 ${filter === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>{label}</button>
          ))}
        </div>
        <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border bg-card px-3 py-1.5 text-sm">
          <option value="roll">Sort by roll number</option>
          <option value="score">Sort by score</option>
          <option value="violations">Sort by violations</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th><th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Score</th><th className="px-4 py-2.5 text-right font-medium">%</th>
              <th className="px-4 py-2.5 text-right font-medium">Violations</th><th className="px-4 py-2.5 font-medium">Ended</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No students match this filter.</td></tr>}
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{r.name ?? r.email}</p>
                  <p className="text-xs tabular text-muted-foreground">{r.rollNumber ?? r.email}</p>
                </td>
                <td className="px-4 py-2.5"><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></td>
                <td className="px-4 py-2.5 text-right tabular">
                  {r.score === null ? '—' : `${r.score}/${r.totalMarks}`}
                  {r.gradingPending && <span className="block text-xs text-warning">grading pending</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular">{r.percent === null ? '—' : `${r.percent}%`}</td>
                <td className="px-4 py-2.5 text-right tabular">
                  {r.violations > 0
                    ? <span className="inline-flex items-center gap-1 font-medium text-warning"><AlertTriangle className="h-3.5 w-3.5" />{r.violations}</span>
                    : <span className="text-muted-foreground">0</span>}
                  {r.review && <span className={`block text-xs font-medium ${r.review === 'malpractice' ? 'text-destructive' : r.review === 'warning' ? 'text-warning' : 'text-success'}`}>
                    {r.review === 'no_issue' ? 'Reviewed: no issue' : r.review === 'warning' ? 'Reviewed: warning' : 'Reviewed: malpractice'}
                  </span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {r.submitReason ? <>{ENDED[r.submitReason]}<span className="block text-xs">{formatDateTime(r.submittedAt)}</span></> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Includes every student in the batch, so the average and completion rate reflect everyone assigned. Updates every 30 seconds.</p>
    </>
  );
}

/** Extra time for named students (accommodations), applied when they start. */
function ExtraTime({ orgId, assignmentId, rows }: { orgId: string; assignmentId: string; rows: ResultRow[] }) {
  const qc = useQueryClient();
  const key = ['accommodations', assignmentId];
  const list = useQuery({ queryKey: key, queryFn: () => api<Accommodation[]>(`/orgs/${orgId}/assignments/${assignmentId}/accommodations`) });
  const [studentId, setStudentId] = useState('');
  const [percent, setPercent] = useState(25);
  const [note, setNote] = useState('');
  const base = `/orgs/${orgId}/assignments/${assignmentId}/accommodations`;
  const save = useMutation({
    mutationFn: () => put(`${base}/${studentId}`, { extraPercent: percent, note: note || null }),
    onSuccess: () => { toast.success('Extra time saved — it applies when the student starts'); setStudentId(''); setNote(''); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`${base}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(e.message),
  });
  const given = new Set((list.data ?? []).map((a) => a.userId));
  return (
    <section className="mt-6 rounded-lg border bg-card p-4" aria-label="Extra time">
      <h2 className="font-semibold">Extra time</h2>
      <p className="text-sm text-muted-foreground">For students with an accommodation (e.g. 25% for a scribe). Applies to the whole test and each timed section, from their next start.</p>
      {(list.data ?? []).length > 0 && (
        <ul className="mt-3 divide-y rounded-md border text-sm">
          {list.data!.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="font-medium">{a.name}</span>
              <span className="text-xs tabular text-muted-foreground">{a.rollNumber}</span>
              <Badge variant="secondary">+{a.extraPercent}%</Badge>
              {a.note && <span className="text-xs text-muted-foreground">{a.note}</span>}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove.mutate(a.userId)} aria-label={`Remove extra time for ${a.name}`}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (studentId) save.mutate(); }}>
        <select aria-label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-md border bg-card px-3 py-1.5 text-sm">
          <option value="">Choose a student…</option>
          {rows.filter((r) => !given.has(r.userId)).map((r) => <option key={r.userId} value={r.userId}>{r.rollNumber ? `${r.rollNumber} · ` : ''}{r.name ?? r.email}</option>)}
        </select>
        <select aria-label="Extra time" value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="rounded-md border bg-card px-3 py-1.5 text-sm">
          {[10, 20, 25, 33, 50, 100].map((p) => <option key={p} value={p}>+{p}%</option>)}
        </select>
        <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="rounded-md border bg-card px-3 py-1.5 text-sm" />
        <Button type="submit" size="sm" disabled={!studentId || save.isPending}>Give extra time</Button>
      </form>
    </section>
  );
}
