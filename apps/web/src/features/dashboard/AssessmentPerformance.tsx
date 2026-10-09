import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampusMe, useMyAssignments } from '@/hooks/useCampus';
import { assignmentStatus } from '@/features/campus/assignmentStatus';
import { fetchInsights, ago, INSIGHTS_KEY } from './insights.service';

interface Row { key: string; source: string; title: string; percent: number; at: string; link: string | null }

const tone = (p: number) => (p >= 70 ? 'text-success' : p >= 40 ? 'text-primary' : 'text-destructive');

/** Recent scored assessments in one place: college tests (released results), test series and course mock tests. */
export function AssessmentPerformance() {
  const { data } = useQuery({ queryKey: INSIGHTS_KEY, queryFn: fetchInsights, staleTime: 60_000, retry: false });
  const { isStudent } = useCampusMe();
  const { data: college } = useMyAssignments(isStudent);

  const rows: Row[] = [
    ...(data?.assessments ?? []).map((a, i) => ({
      key: `f${i}`, source: a.kind === 'test_series' ? 'Test series' : 'Course test', title: a.title, percent: a.percent, at: a.at, link: a.link,
    })),
    ...(college ?? []).flatMap((a) => {
      const p = assignmentStatus(a).percent;
      return p === null ? [] : [{ key: `c${a.id}`, source: a.college, title: a.title, percent: p, at: a.closesAt, link: a.latestAttemptId ? `/college/attempts/${a.latestAttemptId}` : '/college' }];
    }),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  if (rows.length === 0) return null;
  const avg = Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length);

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="perf-heading"
      className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40">
      <div className="flex items-center justify-between mb-4">
        <h2 id="perf-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" aria-hidden /> Assessment performance
        </h2>
        <p className="text-xs text-muted-foreground">Average <span className={cn('font-bold tabular-nums', tone(avg))}>{avg}%</span> over your last {rows.length}</p>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{r.source} · {ago(r.at)}</p>
              </div>
              <div className="w-24 sm:w-32 h-2 bg-secondary rounded-full overflow-hidden shrink-0" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.percent}%` }} />
              </div>
              <span className={cn('w-11 text-right text-sm font-bold tabular-nums shrink-0', tone(r.percent))}>{r.percent}%</span>
            </>
          );
          return (
            <li key={r.key}>
              {r.link
                ? <Link to={r.link} className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1 hover:bg-secondary/30 transition-colors">{body}</Link>
                : <div className="flex items-center gap-3">{body}</div>}
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
