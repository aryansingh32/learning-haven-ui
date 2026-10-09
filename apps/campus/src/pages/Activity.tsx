import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { api, download } from '@/api/client';
import type { ActivityRow } from '@/api/types';
import { EmptyState, ErrorNote, formatDateTime, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const FILTERS: Array<[string, string]> = [
  ['', 'Everything'], ['tests', 'Tests'], ['testseries_questions', 'Questions'], ['assignments', 'Assignments'],
  ['org_memberships', 'Members'], ['custom_roles', 'Roles'], ['batch_members', 'Batch members'], ['course_assignments', 'Courses given'],
  ['test_shares', 'Sharing'], ['students', 'Student exports'], ['results', 'Results exports'],
];
const ACTION: Record<ActivityRow['action'], { label: string; variant: 'secondary' | 'outline' | 'destructive' | 'default' }> = {
  create: { label: 'Added', variant: 'secondary' }, update: { label: 'Changed', variant: 'outline' },
  delete: { label: 'Removed', variant: 'destructive' }, export: { label: 'Exported', variant: 'outline' },
};
// Columns worth showing in "what changed"; internal ids are left out.
const HIDE = new Set(['id', 'org_id', 'owner_org_id', 'user_id', 'test_id', 'question_id', 'batch_id', 'created_by', 'invited_by', 'department_id', 'section_id', 'custom_role_id', 'visibility']);
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80));

function Changes({ row }: { row: ActivityRow }) {
  if (!row.changes || row.action === 'export') return null;
  const entries = Object.entries(row.changes).filter(([k]) => !HIDE.has(k));
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {entries.slice(0, 6).map(([k, v]) => (
        <li key={k}>
          <span className="font-medium text-foreground">{k.replace(/_/g, ' ')}</span>{': '}
          {row.action === 'update' && v && typeof v === 'object' && 'from' in (v as object)
            ? <>{show((v as { from: unknown }).from)} → {show((v as { to: unknown }).to)}</>
            : show(v)}
        </li>
      ))}
    </ul>
  );
}

/** Who changed what in this college, and who exported what. */
export default function Activity() {
  const { orgId } = useParams();
  const [entity, setEntity] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['activity', orgId, entity],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => api<{ rows: ActivityRow[]; next: number | null }>(
      `/orgs/${orgId}/activity?limit=100${entity ? `&entity=${entity}` : ''}${pageParam ? `&before=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.next,
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  async function exportCsv() {
    try { await download(`/orgs/${orgId}/activity?format=csv${entity ? `&entity=${entity}` : ''}`, 'activity.csv'); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <>
      <PageHeader title="Activity" description="Every change to tests, questions, assignments, people and roles — and every export — with who did it."
        actions={<Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Filter activity">
        {FILTERS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={entity === v} onClick={() => setEntity(v)}
            className={`rounded-md px-3 py-1.5 ${entity === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>{label}</button>
        ))}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : rows.length === 0 ? <EmptyState title="Nothing recorded yet" /> : (
        <>
          <ol className="divide-y rounded-lg border bg-card">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted-foreground tabular">{formatDateTime(r.at)}</span>
                <div className="min-w-0 flex-1">
                  <p><Badge variant={ACTION[r.action].variant} className="mr-2">{ACTION[r.action].label}</Badge>
                    <span className="font-medium">{r.what}</span>{r.summary ? <span className="text-muted-foreground"> · {r.summary}</span> : null}</p>
                  <Changes row={r} />
                </div>
                <span className="shrink-0 text-muted-foreground">{r.actor ?? 'System'}</span>
              </li>
            ))}
          </ol>
          {q.hasNextPage && <Button className="mt-3" variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Show older</Button>}
        </>
      )}
    </>
  );
}
