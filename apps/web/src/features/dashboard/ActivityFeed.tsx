import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, BookOpen, Award, ClipboardCheck } from 'lucide-react';
import { fetchInsights, ago, INSIGHTS_KEY, type Insights } from './insights.service';

const ICON: Record<Insights['activity'][number]['kind'], { icon: typeof Activity; verb: string; color: string }> = {
  solved: { icon: CheckCircle2, verb: 'Solved', color: 'text-success' },
  attempted: { icon: XCircle, verb: 'Tried', color: 'text-orange-500' },
  chapter: { icon: BookOpen, verb: 'Finished chapter', color: 'text-primary' },
  certificate: { icon: Award, verb: 'Earned certificate', color: 'text-reward' },
  test_series: { icon: ClipboardCheck, verb: 'Took', color: 'text-primary' },
  mock_test: { icon: ClipboardCheck, verb: 'Took the course test', color: 'text-primary' },
};

/** What you've done lately, newest first. */
export function ActivityFeed() {
  const { data } = useQuery({ queryKey: INSIGHTS_KEY, queryFn: fetchInsights, staleTime: 60_000, retry: false });
  if (!data) return null;
  const items = data.activity.slice(0, 8);
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="activity-heading"
      className="card-glass rounded-2xl p-5 border border-border/40">
      <h3 id="activity-heading" className="text-sm font-display font-bold text-foreground flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" aria-hidden /> Recent activity
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet — solve a problem or finish a chapter and it shows up here.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((a, i) => {
            const { icon: Icon, verb, color } = ICON[a.kind];
            const text = (
              <>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-foreground"><span className="text-muted-foreground">{verb}</span> <span className="font-semibold">{a.title}</span></span>
                  <span className="block text-[11px] text-muted-foreground truncate">{[a.detail && a.kind !== 'certificate' ? a.detail : null, ago(a.at)].filter(Boolean).join(' · ')}</span>
                </span>
              </>
            );
            return (
              <li key={`${a.kind}${a.at}${i}`}>
                {a.link ? <Link to={a.link} className="flex gap-2.5 rounded-md hover:bg-secondary/30 -mx-1.5 px-1.5 py-0.5">{text}</Link> : <div className="flex gap-2.5">{text}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
}
