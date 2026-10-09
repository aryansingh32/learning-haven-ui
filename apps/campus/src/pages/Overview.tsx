import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { api } from '@/api/client';
import type { Assignment, Batch, Department, Member, Org, TestSummary } from '@/api/types';
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

      {can('members.manage') && <GettingStarted orgId={orgId!} org={org.data!} batches={batches.data} assignments={assignments.data} />}

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

/** First steps for a new college; disappears once they are all done. */
function GettingStarted({ orgId, org, batches, assignments }: { orgId: string; org: Org; batches?: Batch[]; assignments?: Assignment[] }) {
  const departments = useQuery({ queryKey: ['departments', orgId], queryFn: () => api<Department[]>(`/orgs/${orgId}/departments`) });
  const tests = useQuery({ queryKey: ['tests', orgId], queryFn: () => api<TestSummary[]>(`/orgs/${orgId}/tests`) });
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => api<Member[]>(`/orgs/${orgId}/members`) });
  if (!departments.data || !batches || !tests.data || !members.data || !assignments) return null;
  const steps = [
    { done: Boolean(org.logoUrl || org.brandColor), label: 'Add your logo and colour', to: '../settings' },
    { done: departments.data.length > 0, label: 'Add departments or branches', to: '../batches' },
    { done: batches.length > 0, label: 'Create batches (and sections)', to: '../batches' },
    { done: members.data.some((m) => m.role !== 'student' && m.role !== 'owner'), label: 'Invite faculty and staff', to: '../people' },
    { done: org.activeStudents > 0, label: 'Upload your student roster', to: '../people' },
    { done: tests.data.some((t) => t.source === 'college') || assignments.length > 0, label: 'Write a test or pick one from the Forge library', to: '../tests' },
    { done: assignments.length > 0, label: 'Assign a test to a batch', to: '../assignments?new=1' },
  ];
  const left = steps.filter((x) => !x.done).length;
  if (left === 0) return null;
  return (
    <section className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-5" aria-labelledby="start-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="start-title" className="font-semibold">Set up {org.name}</h2>
        <span className="text-sm text-muted-foreground">{steps.length - left} of {steps.length} done</span>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((x) => (
          <li key={x.label}>
            <Link to={x.to} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${x.done ? 'text-muted-foreground line-through' : 'hover:bg-background'}`}>
              {x.done ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Done" /> : <Circle className="h-4 w-4 text-muted-foreground" aria-label="To do" />} {x.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
