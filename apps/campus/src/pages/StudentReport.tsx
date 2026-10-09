import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/api/client';
import type { StudentReport as Report } from '@/api/types';
import { BarList } from '@/components/charts';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { RISK } from './Insights';

const COURSE: Record<string, string> = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started', overdue: 'Overdue' };

/** Everything about one student on one page: tests with rank, courses, topics, record. */
export default function StudentReport() {
  const { orgId, studentId } = useParams();
  const q = useQuery({ queryKey: ['student-report', studentId], queryFn: () => api<Report>(`/orgs/${orgId}/analytics/students/${studentId}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const r = q.data!;
  const taken = r.tests.filter((t) => t.percent !== null);
  return (
    <>
      <Link to={`/o/${orgId}/insights?tab=students`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Students
      </Link>
      <PageHeader title={r.student.name ?? r.student.email ?? 'Student'}
        description={[r.student.rollNumber, r.student.department, r.student.email].filter(Boolean).join(' · ')}
        actions={<Badge variant={RISK[r.risk.level].variant}>{RISK[r.risk.level].label}</Badge>} />
      {r.risk.reasons.length > 0 && <p className="-mt-3 mb-4 text-sm text-muted-foreground">Why: {r.risk.reasons.join(' · ')}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Average" value={r.averagePercent === null ? '—' : `${r.averagePercent}%`} />
        <Stat label="Tests taken" value={`${taken.length}/${r.tests.length}`} />
        <Stat label="Courses done" value={r.courses.length ? `${r.courses.filter((c) => c.status === 'completed').length}/${r.courses.length}` : '—'} />
        {r.record ? <Stat label="CGPA" value={r.record.cgpa ?? '—'} hint={r.record.backlogs !== null ? `${r.record.backlogs} backlogs` : undefined} />
          : <Stat label="Overdue courses" value={r.courses.filter((c) => c.status === 'overdue').length} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <h2 className="mb-2 text-base font-semibold">Tests</h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Test</th><th className="px-4 py-2.5 text-right font-medium">Score</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rank</th><th className="px-4 py-2.5 text-right font-medium">Batch avg</th></tr>
              </thead>
              <tbody className="divide-y">
                {r.tests.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No tests assigned yet.</td></tr>}
                {r.tests.map((t) => (
                  <tr key={t.assignmentId}>
                    <td className="px-4 py-2.5"><Link to={`/o/${orgId}/assignments/${t.assignmentId}`} className="font-medium hover:underline">{t.title}</Link>
                      <p className="text-xs text-muted-foreground">{t.closed ? 'Closed' : 'Closes'} {formatDateTime(t.closesAt)}</p></td>
                    <td className="px-4 py-2.5 text-right tabular">{t.percent === null ? (t.closed ? <span className="text-destructive">Missed</span> : '—') : `${t.percent}%`}</td>
                    <td className="px-4 py-2.5 text-right tabular">{t.rank ? `${t.rank}/${t.of}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular">{t.batchAverage === null ? '—' : `${t.batchAverage}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.courses.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-base font-semibold">Courses</h2>
              <ul className="divide-y rounded-lg border bg-card text-sm">
                {r.courses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span><span className="font-medium">{c.title}</span>{c.dueAt && <span className="ml-2 text-xs text-muted-foreground">due {formatDateTime(c.dueAt)}</span>}</span>
                    <span className={c.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}>{COURSE[c.status]} · {c.completedChapters}/{c.totalChapters}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="rounded-lg border bg-card p-4 lg:self-start">
          <BarList title="Strengths and gaps by topic" empty="Topics appear once tagged questions are answered."
            data={r.topics.map((t) => ({ label: t.tag, value: t.percent, detail: `${t.possible} marks` }))} />
        </section>
      </div>
    </>
  );
}
