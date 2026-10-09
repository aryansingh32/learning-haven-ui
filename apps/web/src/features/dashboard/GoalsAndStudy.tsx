import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Target, Clock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchInsights, saveGoals, minutesLabel, INSIGHTS_KEY, type Insights } from './insights.service';

/** Goals (weekly problems, daily minutes) and a 14-day study-time chart with the daily goal line. */
export function GoalsAndStudy() {
  const { data } = useQuery({ queryKey: INSIGHTS_KEY, queryFn: fetchInsights, staleTime: 60_000, retry: false });
  const [editing, setEditing] = useState(false);
  if (!data) return null;
  const { goals, study } = data;
  const weekPct = goals.weekly_problems ? Math.min(100, Math.round((goals.solved_this_week / goals.weekly_problems) * 100)) : null;
  const todayPct = study.goal_minutes ? Math.min(100, Math.round((study.today_minutes / study.goal_minutes) * 100)) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="goals-heading"
      className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id="goals-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" aria-hidden /> Your goals
          </h2>
          {goals.learning_goal && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">“{goals.learning_goal}”</p>}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="w-3.5 h-3.5" aria-hidden /> {goals.weekly_problems || goals.daily_minutes ? 'Edit goals' : 'Set goals'}
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <GoalTile
          label="Problems this week"
          value={goals.weekly_problems ? `${goals.solved_this_week} / ${goals.weekly_problems}` : `${goals.solved_this_week}`}
          hint={goals.weekly_problems ? (goals.solved_this_week >= goals.weekly_problems ? 'Goal reached 🎉' : `${goals.weekly_problems - goals.solved_this_week} to go`) : 'No weekly goal yet'}
          pct={weekPct}
        />
        <GoalTile
          label="Studied today"
          value={minutesLabel(study.today_minutes)}
          hint={study.goal_minutes ? `Goal ${minutesLabel(study.goal_minutes)} a day` : 'No daily goal yet'}
          pct={todayPct}
        />
        <GoalTile
          label="Goal days this week"
          value={study.goal_minutes ? `${study.goal_days_met} / ${study.week_days_so_far}` : '—'}
          hint={`${minutesLabel(study.week_minutes)} studied this week`}
          pct={study.goal_minutes ? Math.round((study.goal_days_met / Math.max(1, study.week_days_so_far)) * 100) : null}
        />
      </div>

      <StudyChart study={study} />
      {editing && <GoalsDialog insights={data} onClose={() => setEditing(false)} />}
    </motion.section>
  );
}

function GoalTile({ label, value, hint, pct }: { label: string; value: string; hint: string; pct: number | null }) {
  return (
    <div className="rounded-xl bg-secondary/40 border border-border/40 p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{value}</p>
      {pct !== null && (
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1.5" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>
    </div>
  );
}

function StudyChart({ study }: { study: Insights['study'] }) {
  const max = Math.max(study.goal_minutes ?? 0, ...study.days.map((d) => d.minutes), 10);
  const goalTop = study.goal_minutes ? 100 - (study.goal_minutes / max) * 100 : null;
  const day = (iso: string) => new Date(`${iso}T00:00:00`);
  return (
    <figure>
      <figcaption className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-4 h-4 text-muted-foreground" aria-hidden /> Study time, last 14 days</span>
        {study.goal_minutes && <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-muted-foreground" aria-hidden /> daily goal</span>}
      </figcaption>
      <div className="relative h-28" aria-hidden>
        {goalTop !== null && <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/60" style={{ top: `${goalTop}%` }} />}
        <div className="absolute inset-0 flex items-end gap-1">
          {study.days.map((d) => (
            <div key={d.date} className="flex-1 h-full flex items-end" title={`${day(d.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}: ${minutesLabel(d.minutes)}`}>
              <div
                className={d.minutes > 0 ? 'w-full rounded-t-sm bg-primary' : 'w-full rounded-t-sm bg-secondary'}
                style={{ height: d.minutes > 0 ? `${Math.max(3, (d.minutes / max) * 100)}%` : '3px' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1" aria-hidden>
        <span>{day(study.days[0].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Minutes studied per day</caption>
        <tbody>{study.days.map((d) => <tr key={d.date}><th scope="row">{d.date}</th><td>{d.minutes}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function GoalsDialog({ insights, onClose }: { insights: Insights; onClose: () => void }) {
  const qc = useQueryClient();
  const [daily, setDaily] = useState(String(insights.goals.daily_minutes ?? ''));
  const [weekly, setWeekly] = useState(String(insights.goals.weekly_problems ?? ''));
  const [goal, setGoal] = useState(insights.goals.learning_goal ?? '');
  const save = useMutation({
    mutationFn: () => saveGoals({
      daily_minutes: daily.trim() ? Number(daily) : null,
      weekly_problems: weekly.trim() ? Number(weekly) : null,
      learning_goal: goal.trim() ? goal.trim() : null,
    }),
    onSuccess: (next) => { qc.setQueryData(INSIGHTS_KEY, next); toast.success('Goals saved'); onClose(); },
    onError: (e: Error) => toast.error(e.message || 'Could not save your goals'),
  });
  const dailyOk = !daily.trim() || (Number.isInteger(Number(daily)) && Number(daily) >= 5 && Number(daily) <= 600);
  const weeklyOk = !weekly.trim() || (Number.isInteger(Number(weekly)) && Number(weekly) >= 1 && Number(weekly) <= 100);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your goals</DialogTitle>
          <DialogDescription>Small, steady targets work best. Leave a box empty for no goal.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dailyOk && weeklyOk) save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="goal-weekly">Problems to solve each week</Label>
            <Input id="goal-weekly" inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value)} aria-invalid={!weeklyOk} placeholder="e.g. 10" />
            {!weeklyOk && <p className="text-xs text-destructive">Between 1 and 100.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-daily">Minutes to study each day</Label>
            <Input id="goal-daily" inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} aria-invalid={!dailyOk} placeholder="e.g. 45" />
            {!dailyOk && <p className="text-xs text-destructive">Between 5 and 600 minutes.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-text">What you're working towards</Label>
            <Input id="goal-text" maxLength={200} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Crack product-company placements" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!dailyOk || !weeklyOk || save.isPending}>{save.isPending ? 'Saving…' : 'Save goals'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
