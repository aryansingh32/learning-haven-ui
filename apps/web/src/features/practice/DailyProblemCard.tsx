import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchDailyProblem } from './practice.service';

const DIFF: Record<string, string> = {
  easy: 'bg-success/15 text-success',
  medium: 'bg-primary/15 text-primary',
  hard: 'bg-destructive/15 text-destructive',
};

/** Today's problem — the same for every learner, new at midnight (IST). */
export function DailyProblemCard() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['daily-problem'], queryFn: fetchDailyProblem, staleTime: 5 * 60_000, retry: false });
  const p = data?.problem;
  if (!p) return null;
  const done = data.solved_today || data.solved;
  return (
    <section aria-label="Problem of the day" className="card-layer-2 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 border border-primary/20">
      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
        <CalendarCheck2 className="w-5 h-5 text-primary" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          Problem of the day · {new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize', DIFF[p.difficulty])}>{p.difficulty}</span>
          <span className="text-[11px] text-muted-foreground">{p.topic}</span>
          {(p.companies ?? []).slice(0, 3).map((c) => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{c}</span>
          ))}
        </div>
      </div>
      {done ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success shrink-0">
          <CheckCircle2 className="w-4 h-4" aria-hidden /> {data.solved_today ? 'Solved today' : 'Solved before'}
        </span>
      ) : null}
      <button
        onClick={() => navigate(`/problems/${p.slug}`)}
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold gradient-golden text-primary-foreground shrink-0"
      >
        {done ? 'Practise again' : 'Solve it'} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </button>
    </section>
  );
}
