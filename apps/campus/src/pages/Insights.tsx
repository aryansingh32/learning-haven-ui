import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { api, download } from '@/api/client';
import type { Batch, CollegeOverview, RiskLevel, Rollup, StudentsInsight } from '@/api/types';
import { ColumnChart } from '@/components/charts';
import { EmptyState, ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrg } from '@/context/CampusContext';

export const RISK: Record<RiskLevel, { label: string; variant: 'destructive' | 'outline' | 'secondary' }> = {
  high: { label: 'At risk', variant: 'destructive' },
  medium: { label: 'Watch', variant: 'outline' },
  low: { label: 'On track', variant: 'secondary' },
};
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** College-wide picture for faculty, placement officers and admins. */
export default function Insights() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  return (
    <>
      <PageHeader title="Insights" description="How your batches are doing, who needs help, and exports for placements." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">College</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
        <TabsContent value="students" className="mt-4"><Students /></TabsContent>
      </Tabs>
    </>
  );
}

function Overview() {
  const { orgId } = useParams();
  const [months, setMonths] = useState(6);
  const q = useQuery({ queryKey: ['insights-overview', orgId, months], queryFn: () => api<CollegeOverview>(`/orgs/${orgId}/analytics/overview?months=${months}`), placeholderData: (p) => p });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const totalTests = d.months.reduce((n, m) => n + m.tests, 0);
  return (
    <div className={q.isFetching ? 'opacity-60 transition-opacity' : ''}>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="ins-months" className="text-muted-foreground">Period</label>
        <select id="ins-months" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-md border bg-card px-2 py-1">
          <option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option>
        </select>
      </div>
      {totalTests === 0 ? (
        <EmptyState title="No closed tests in this period">Trends appear once tests have closed.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border bg-card p-4">
            <ColumnChart title="Participation" unit="%" max={100} valueLabel="Participation"
              data={d.months.map((m) => ({ label: monthName(m.month), value: m.participation, detail: `${m.submitted}/${m.assigned} across ${m.tests} tests` }))} />
          </section>
          <section className="rounded-lg border bg-card p-4">
            <ColumnChart title="Average score" unit="%" max={100} valueLabel="Average"
              data={d.months.map((m) => ({ label: monthName(m.month), value: m.averagePercent, detail: `${m.tests} tests` }))} />
          </section>
        </div>
      )}
      <RollupTable title="By batch" rows={d.byBatch} />
      <RollupTable title="By department" rows={d.byDepartment} />
    </div>
  );
}

function RollupTable({ title, rows }: { title: string; rows: Rollup[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 text-right font-medium">Students</th>
              <th className="px-4 py-2.5 text-right font-medium">Average</th><th className="px-4 py-2.5 text-right font-medium">Participation</th>
              <th className="px-4 py-2.5 text-right font-medium">At risk</th><th className="px-4 py-2.5 text-right font-medium">Courses done</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.students}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.averagePercent === null ? '—' : `${r.averagePercent}%`}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.participation === null ? '—' : `${r.participation}%`}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.atRisk || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular">{r.coursesAssigned ? `${r.coursesCompleted}/${r.coursesAssigned}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Students() {
  const { orgId } = useParams();
  const { can } = useOrg(orgId);
  const [batchId, setBatchId] = useState('');
  const [days, setDays] = useState(180);
  const [level, setLevel] = useState<'all' | RiskLevel>('all');
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`) });
  const qs = `?days=${days}${batchId ? `&batchId=${batchId}` : ''}`;
  const q = useQuery({ queryKey: ['insights-students', orgId, batchId, days], queryFn: () => api<StudentsInsight>(`/orgs/${orgId}/analytics/students${qs}`), placeholderData: (p) => p });
  const rows = useMemo(() => {
    const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
    return (q.data?.rows ?? []).filter((r) => level === 'all' || r.risk.level === level).sort((a, b) => order[a.risk.level] - order[b.risk.level]);
  }, [q.data, level]);
  async function exportCsv() {
    try { await download(`/orgs/${orgId}/analytics/students${qs}&format=csv`, 'students.csv'); }
    catch (e) { toast.error((e as Error).message); }
  }
  const showRecord = rows.some((r) => r.record);

  return (
    <div className={q.isFetching ? 'opacity-60 transition-opacity' : ''}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select aria-label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-md border bg-card px-2 py-1.5">
          <option value="">All batches</option>
          {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border bg-card px-2 py-1.5">
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={180}>Last 6 months</option><option value={365}>Last year</option>
        </select>
        <div className="flex gap-1" role="tablist" aria-label="Filter by risk">
          {(['all', 'high', 'medium', 'low'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={level === v} onClick={() => setLevel(v)}
              className={`rounded-md px-3 py-1.5 ${level === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
              {v === 'all' ? 'All' : RISK[v].label}
            </button>
          ))}
        </div>
        {can('reports.export') && <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Placement CSV</Button>}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Students" value={q.data!.summary.students} />
            <Stat label="At risk" value={q.data!.summary.high} tone={q.data!.summary.high ? 'warning' : undefined} />
            <Stat label="To watch" value={q.data!.summary.medium} />
            <Stat label="Average" value={q.data!.summary.averagePercent === null ? '—' : `${q.data!.summary.averagePercent}%`} hint="Of closed tests" />
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Student</th><th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Average</th><th className="px-4 py-2.5 text-right font-medium">Tests</th>
                  <th className="px-4 py-2.5 text-right font-medium">Courses</th>{showRecord && <th className="px-4 py-2.5 text-right font-medium">CGPA</th>}
                  <th className="px-4 py-2.5 font-medium">Last test</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No students here.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.userId} className="align-top">
                    <td className="px-4 py-2.5">
                      <Link to={`students/${r.userId}`} className="font-medium hover:underline">{r.name ?? r.email}</Link>
                      <p className="text-xs text-muted-foreground">{[r.rollNumber, r.department, r.batches.join(', ')].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={RISK[r.risk.level].variant}>{RISK[r.risk.level].label}</Badge>
                      {r.risk.reasons.length > 0 && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.risk.reasons.join(' · ')}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{r.averagePercent === null ? '—' : `${r.averagePercent}%`}</td>
                    <td className="px-4 py-2.5 text-right tabular">{r.taken}/{r.assigned}</td>
                    <td className="px-4 py-2.5 text-right tabular">{r.coursesAssigned ? `${r.coursesCompleted}/${r.coursesAssigned}` : '—'}</td>
                    {showRecord && <td className="px-4 py-2.5 text-right tabular">{r.record?.cgpa ?? '—'}</td>}
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(r.lastTestAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">"At risk" combines a low average (under 40%), missed tests, falling scores, overdue courses and malpractice. Each flag says why.</p>
        </>
      )}
    </div>
  );
}
