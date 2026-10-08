import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '@/api/client';
import type { Assignment, Batch, Org } from '@/api/types';
import { EmptyState, ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/CampusContext';

export function assignmentState(a: Pick<Assignment, 'status' | 'opensAt' | 'closesAt'>, now = new Date()) {
  if (a.status === 'draft') return { label: 'Draft', variant: 'outline' as const };
  if (now < new Date(a.opensAt)) return { label: 'Scheduled', variant: 'secondary' as const };
  if (now >= new Date(a.closesAt)) return { label: 'Closed', variant: 'outline' as const };
  return { label: 'Open now', variant: 'default' as const };
}

export default function Overview() {
  const { orgId } = useParams();
  const { membership, can } = useOrg(orgId);
  const org = useQuery({ queryKey: ['org', orgId], queryFn: () => api<Org>(`/orgs/${orgId}`) });
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`), enabled: can('members.view') });
  const assignments = useQuery({
    queryKey: ['assignments', orgId],
    queryFn: () => api<Assignment[]>(`/orgs/${orgId}/assignments`),
    enabled: can('assessments.create'),
  });

  if (org.isLoading) return <Loading />;
  if (org.error) return <ErrorNote error={org.error} />;

  const now = new Date();
  const live = (assignments.data ?? []).filter((a) => a.status === 'published' && new Date(a.opensAt) <= now && now < new Date(a.closesAt));
  const upcoming = (assignments.data ?? []).filter((a) => a.status === 'published' && new Date(a.opensAt) > now);
  const recent = (assignments.data ?? []).slice(0, 6);

  return (
    <>
      <PageHeader
        title={membership?.orgName ?? 'Overview'}
        description="What's happening across your batches."
        actions={can('assessments.create') && <Button asChild><Link to="../assignments?new=1">New assignment</Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active students" value={org.data?.activeStudents ?? 0}
          hint={org.data?.seatLimit ? `of ${org.data.seatLimit} seats` : undefined} />
        <Stat label="Batches" value={batches.data?.filter((b) => b.status === 'active').length ?? '—'} />
        <Stat label="Tests open now" value={assignments.data ? live.length : '—'} />
        <Stat label="Scheduled" value={assignments.data ? upcoming.length : '—'} />
      </div>

      {can('assessments.create') && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent assignments</h2>
            <Link to="../assignments" className="text-sm font-medium text-primary hover:underline">All assignments</Link>
          </div>
          {assignments.isLoading ? <Loading /> : recent.length === 0 ? (
            <EmptyState title="No assignments yet"
              action={<Button asChild variant="outline"><Link to="../assignments?new=1">Assign a test to a batch</Link></Button>}>
              Create a test or pick one from the Forge library, then assign it to a batch.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {recent.map((a) => {
                const state = assignmentState(a, now);
                const pct = a.assigned ? Math.round((a.submitted / a.assigned) * 100) : 0;
                return (
                  <li key={a.id}>
                    <Link to={`../assignments/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-accent/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.batchName} · closes {formatDateTime(a.closesAt)}</p>
                      </div>
                      <Badge variant={state.variant}>{state.label}</Badge>
                      <p className="w-28 text-right text-sm tabular text-muted-foreground">{a.submitted}/{a.assigned} submitted</p>
                      <div className="hidden w-24 sm:block" aria-hidden>
                        <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
