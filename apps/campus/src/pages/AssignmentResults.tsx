import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { api, download } from '@/api/client';
import type { ResultRow, Results } from '@/api/types';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/CampusContext';

const STATUS: Record<ResultRow['status'], { label: string; variant: 'secondary' | 'outline' | 'default' }> = {
  submitted: { label: 'Submitted', variant: 'secondary' },
  in_progress: { label: 'In progress', variant: 'default' },
  not_attempted: { label: 'Not attempted', variant: 'outline' },
};
const ENDED: Record<NonNullable<ResultRow['submitReason']>, string> = {
  manual: 'Submitted', timeout: 'Time ran out', violations: 'Auto-submitted', closed: 'Closed',
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
        actions={can('reports.export') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted" value={`${summary.submitted}/${summary.assigned}`} hint={summary.notAttempted ? `${summary.notAttempted} not attempted` : 'Everyone has attempted'} />
        <Stat label="Average" value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`} hint="Of students who submitted" />
        <Stat label="Range" value={summary.highestPercent === null ? '—' : `${summary.lowestPercent}–${summary.highestPercent}%`} />
        <Stat label="Flagged" value={summary.flagged} hint="Left the test at least once" tone={summary.flagged ? 'warning' : undefined} />
      </div>

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
                <td className="px-4 py-2.5 text-right tabular">{r.score === null ? '—' : `${r.score}/${r.totalMarks}`}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.percent === null ? '—' : `${r.percent}%`}</td>
                <td className="px-4 py-2.5 text-right tabular">
                  {r.violations > 0
                    ? <span className="inline-flex items-center gap-1 font-medium text-warning"><AlertTriangle className="h-3.5 w-3.5" />{r.violations}</span>
                    : <span className="text-muted-foreground">0</span>}
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
