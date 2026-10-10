import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAchievements, ACHIEVEMENTS_KEY } from '@/features/achievements/achievements.service';
import { WeeklyMissions, CodingStreakCard, Milestones, Collections, LeaderboardPanel, useAnnounceMilestones } from '@/features/achievements/AchievementSections';

/** Weekly missions, coding streak, milestones, badge collections and the leaderboard. */
const AchievementsPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ACHIEVEMENTS_KEY, queryFn: fetchAchievements, staleTime: 30_000, retry: false });
  useAnnounceMilestones(data);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 md:pb-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Award className="w-6 h-6 text-reward" aria-hidden /> Achievements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Missions, streaks, badges and where you stand.</p>
      </header>

      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}
      {isError && <p className="card-glass rounded-2xl p-5 text-sm text-muted-foreground">Could not load your achievements. Please try again.</p>}

      {data && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <WeeklyMissions data={data} />
            <Milestones data={data} />
            <Collections data={data} />
          </div>
          <div className="space-y-6 min-w-0">
            <CodingStreakCard data={data} />
            <LeaderboardPanel />
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementsPage;
