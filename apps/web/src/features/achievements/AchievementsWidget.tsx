import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Flame } from 'lucide-react';
import { fetchAchievements, ACHIEVEMENTS_KEY } from './achievements.service';
import { WeeklyMissions, useAnnounceMilestones } from './AchievementSections';

/** Dashboard: this week's missions (claimable here), the coding streak and a link to Achievements. */
export function AchievementsWidget() {
  const { data } = useQuery({ queryKey: ACHIEVEMENTS_KEY, queryFn: fetchAchievements, staleTime: 30_000, retry: false });
  useAnnounceMilestones(data);
  if (!data) return null;
  const earned = data.collections.reduce((s, c) => s + c.earned, 0);
  const total = data.collections.reduce((s, c) => s + c.total, 0);
  return (
    <div className="space-y-3">
      <WeeklyMissions data={data} compact />
      <Link to="/achievements" className="card-glass rounded-2xl px-5 py-4 border border-border/40 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
        <Flame className="w-5 h-5 text-reward shrink-0" aria-hidden />
        <span className="flex-1 min-w-0 text-sm text-foreground">
          <strong className="tabular-nums">{data.coding_streak.current}</strong>-day coding streak · <span className="tabular-nums">{earned}/{total}</span> badges
        </span>
        <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 shrink-0">Achievements <ArrowRight className="w-3.5 h-3.5" aria-hidden /></span>
      </Link>
    </div>
  );
}
