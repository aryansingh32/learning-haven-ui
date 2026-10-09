import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Download } from 'lucide-react';
import { api, download } from '@/api/client';
import type { CourseProgressReport, StudentCourseStatus } from '@/api/types';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/CampusContext';

const STATUS: Record<StudentCourseStatus, { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  completed: { label: 'Completed', variant: 'secondary' },
  in_progress: { label: 'In progress', variant: 'default' },
  not_started: { label: 'Not started', variant: 'outline' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

/** Each student's chapter progress on a course given to their batch. */
export default function CourseProgress() {
  const { orgId, assignmentId } = useParams();
  const { can } = useOrg(orgId);
  const [filter, setFilter] = useState<'all' | StudentCourseStatus>('all');
  const report = useQuery({
    queryKey: ['course-progress', assignmentId],
    queryFn: () => api<CourseProgressReport>(`/orgs/${orgId}/course-assignments/${assignmentId}/progress`),
  });
  const rows = useMemo(() => (report.data?.rows ?? []).filter((r) => filter === 'all' || r.status === filter), [report.data, filter]);

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorNote error={report.error} />;
  const { assignment, summary, chapters } = report.data!;

  async function exportCsv() {
    try { await download(`/orgs/${orgId}/course-assignments/${assignmentId}/progress?format=csv`, 'course-progress.csv'); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Courses
      </Link>
      <PageHeader title={assignment.title}
        description={`${assignment.batch} · ${assignment.courseTitle ?? 'Course'} · ${assignment.dueAt ? `due ${formatDateTime(assignment.dueAt)}` : 'no due date'}`}
        actions={can('reports.export') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed" value={`${summary.completed}/${summary.assigned}`} />
        <Stat label="In progress" value={summary.inProgress} hint={`${summary.notStarted} not started`} />
        <Stat label="Overdue" value={summary.overdue} tone={summary.overdue ? 'warning' : undefined} />
        <Stat label="Average" value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`} hint="Of chapters done" />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Filter students">
        {([['all', 'All'], ['completed', 'Completed'], ['in_progress', 'In progress'], ['not_started', 'Not started'], ['overdue', 'Overdue']] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
            className={`rounded-md px-3 py-1.5 ${filter === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Chapters</th>
              {chapters.map((c) => <th key={c.id} className="px-2 py-2.5 text-center font-medium" title={c.title}>{c.number}</th>)}
              <th className="px-4 py-2.5 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={chapters.length + 4} className="px-4 py-8 text-center text-muted-foreground">No students here.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{r.name ?? r.email}</p>
                  <p className="text-xs text-muted-foreground">{r.rollNumber ?? '—'}</p>
                </td>
                <td className="px-4 py-2.5"><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></td>
                <td className="px-4 py-2.5 text-right tabular">{r.completedChapters}/{r.totalChapters}</td>
                {r.chapters.map((done, i) => (
                  <td key={chapters[i].id} className="px-2 py-2.5 text-center">
                    {done ? <Check className="mx-auto h-4 w-4 text-success" aria-label={`Chapter ${chapters[i].number} done`} /> : <span className="text-muted-foreground" aria-label="Not done">·</span>}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(r.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
