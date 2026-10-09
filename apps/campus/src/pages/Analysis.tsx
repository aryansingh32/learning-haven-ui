import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { api, download } from '@/api/client';
import type { AssignmentAnalysis } from '@/api/types';
import { BarList, ColumnChart } from '@/components/charts';
import { ErrorNote, Loading, PageHeader, Stat } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/CampusContext';

const LETTERS = 'ABCDEFGHIJ';
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** How each question of one test performed, and how the batch did by topic. */
export default function Analysis() {
  const { orgId, assignmentId } = useParams();
  const { can } = useOrg(orgId);
  const q = useQuery({ queryKey: ['analysis', assignmentId], queryFn: () => api<AssignmentAnalysis>(`/orgs/${orgId}/analytics/assignments/${assignmentId}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const s = d.summary;
  async function exportCsv() {
    try { await download(`/orgs/${orgId}/analytics/assignments/${assignmentId}?format=csv`, 'topics.csv'); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Results
      </Link>
      <PageHeader title={`Analysis · ${d.assignment.title}`} description={`${d.assignment.batch} · each student's best submitted attempt`}
        actions={can('reports.export') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Topic-wise CSV</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Took the test" value={`${s.submitted}/${s.assigned}`} hint={s.participation === null ? undefined : `${s.participation}% participation`} />
        <Stat label="Average" value={s.average === null ? '—' : `${s.average}%`} hint={s.median === null ? undefined : `median ${s.median}%`} />
        <Stat label="Highest" value={s.highest === null ? '—' : `${s.highest}%`} />
        <Stat label="Lowest" value={s.lowest === null ? '—' : `${s.lowest}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <ColumnChart title="Score distribution" valueLabel="Students"
            data={d.distribution.map((b) => ({ label: `${b.from}–${b.to}`, value: b.count, detail: `${b.count === 1 ? 'student' : 'students'} scored ${b.from}–${b.to}%` }))} />
        </section>
        <section className="rounded-lg border bg-card p-4">
          <BarList title="Marks by topic (weakest first)" empty="Tag questions to see results by topic."
            data={d.tags.map((t) => ({ label: t.tag, value: t.percent, detail: `${t.questions} questions · ${t.earned}/${t.possible} marks` }))} />
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 text-base font-semibold">Question by question</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Correct</strong> is the share of students who got it right.{' '}
          <strong className="font-medium text-foreground">Separation</strong> compares the top and bottom 27% of the batch: 0.3 or more means the question tells stronger from weaker students; near 0 or negative needs a look.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Question</th>
                <th className="px-4 py-2.5 text-right font-medium">Correct</th><th className="px-4 py-2.5 text-right font-medium">Separation</th>
                <th className="px-4 py-2.5 text-right font-medium">Answered</th><th className="px-4 py-2.5 font-medium">Options picked</th></tr>
            </thead>
            <tbody className="divide-y">
              {d.questions.map((x) => (
                <tr key={x.questionId} className="align-top">
                  <td className="px-4 py-2.5 tabular text-muted-foreground">{x.number}</td>
                  <td className="max-w-md px-4 py-2.5">
                    <p className="line-clamp-2">{x.body}</p>
                    <p className="text-xs text-muted-foreground">{x.type.toUpperCase()} · {x.marks} marks{x.tags.length ? ` · ${x.tags.join(', ')}` : ''}{x.pending ? ` · ${x.pending} waiting to be marked` : ''}</p>
                    {x.flag && <p className="mt-1 flex items-start gap-1 text-xs font-medium text-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{x.flag}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{pct(x.difficulty)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{x.discrimination === null ? '—' : x.discrimination.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{x.attempted}/{x.dealt}</td>
                  <td className="px-4 py-2.5">
                    {x.options && x.optionPicks ? (
                      <ul className="space-y-0.5 text-xs">
                        {x.options.map((o, i) => (
                          <li key={o.id} className={o.correct ? 'font-medium text-success' : 'text-muted-foreground'}>
                            {LETTERS[i]}{o.correct ? ' ✓' : ''} · {x.optionPicks![o.id] ?? 0} <span className="hidden xl:inline">— {o.text.slice(0, 40)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
