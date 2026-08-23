import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApiQuery } from '@/hooks/useApi';
import { useQueries } from '@tanstack/react-query';
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { useLearnCourse } from '@/hooks/useLearnCourse';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ProgressRing } from '@/components/ProgressRing';
import { MissionHero } from '@/components/gamification/MissionHero';
import { DailyQuestsWidget } from '@/components/gamification/DailyQuestsWidget';
import { formatStreakDays, type Mission, type DailyQuests, type Identity } from '@/lib/gamification';
import {
  ArrowRight, Zap, Flame, Code2, BookOpen,
  Trophy, Target, ChevronRight, Briefcase, TrendingUp, Brain, AlertTriangle, Gift
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { useRoadmap } from '@/context/RoadmapContext';

// ─── Activity Calendar (GitHub-style, real data) ───────────────────────────
function ActivityCalendar({ heatmap }: { heatmap: { date: string; count: number; level: number }[] }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Map heatmap data to lookup
  const activityMap = useMemo(() => {
    const m = new Map<string, number>();
    heatmap.forEach(h => m.set(h.date, h.count));
    return m;
  }, [heatmap]);

  // Calendar grid: 7 rows (Sun-Sat), columns = weeks
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  const intensityClass = (count: number) => {
    if (count >= 5) return 'bg-orange-500';
    if (count >= 3) return 'bg-orange-500/80';
    if (count >= 1) return 'bg-orange-500/50';
    return 'bg-secondary/60';
  };

  return (
    <div>
      {/* Day labels */}
      <div className="flex items-start gap-1 mb-2">
        <div className="w-8 shrink-0" /> {/* spacer for labels */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <span key={d} className="text-[9px] text-muted-foreground font-semibold text-center">{d}</span>
          ))}
        </div>
      </div>
      {/* Calendar grid */}
      <div className="flex items-start gap-1">
        <div className="w-8 shrink-0" />
        <div className="grid grid-cols-7 gap-1 flex-1">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-sm" />
          ))}
          {daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const count = activityMap.get(dateStr) || 0;
            const todayHighlight = isToday(day);
            return (
              <div
                key={dateStr}
                className={cn(
                  'aspect-square rounded-sm transition-all cursor-default',
                  intensityClass(count),
                  todayHighlight && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                )}
                title={`${format(day, 'MMM d')}: ${count} ${count === 1 ? 'activity' : 'activities'}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glass rounded-2xl p-4 flex items-center gap-4 border border-border/40"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-meta text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-section-title font-display font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}



// ─── Main Dashboard ──────────────────────────────────────────────────────
const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Data Fetching ──
  const { data: profileStats, isLoading: profileLoading } = useApiQuery<{
    total_solved: number;
    total_tried?: number;
    total_revision?: number;
    easy_solved?: number;
    medium_solved?: number;
    hard_solved?: number;
    xp: number;
    apprenticeship_xp?: number;
    level: number;
    streak: number;
    longest_streak?: number;
  }>(
    ['user-profile-stats'],
    '/users/me/stats',
  );

  const { data: heatmapData, isLoading: heatmapLoading } = useApiQuery<
    { date: string; count: number; level: number }[]
  >(
    ['user-activity-heatmap'],
    '/users/analytics/activity',
  );

  const { data: mission, isLoading: missionLoading } = useApiQuery<Mission>(
    ['user-mission'],
    '/users/me/mission',
  );

  const { data: dailyQuests, isLoading: questsLoading } = useApiQuery<DailyQuests>(
    ['user-daily-quests'],
    '/users/me/daily-quests',
  );

  const { data: identity } = useApiQuery<Identity>(
    ['user-identity'],
    '/users/me/identity',
  );

  const [
    { data: appData, isLoading: appLoading },
    { data: buildData, isLoading: buildLoading }
  ] = useQueries({
    queries: [
      { queryKey: ["apprenticeship-enrollments"], queryFn: () => apprenticeshipService.getMyEnrollments() },
      { queryKey: ["build-enrollments"], queryFn: () => buildHavenService.getMyEnrollments() },
    ]
  });

  const { chapters, completedCount, progressPercent, activeChapter, course, isLoading: chaptersLoading } = useLearnCourse();

  const appEnrollments = appData?.enrollments || [];
  const buildEnrollments = buildData?.enrollments || [];

  // Merge all enrollments into unified list sorted by recency
  const allEnrollments = useMemo(() => {
    const apps = appEnrollments.map((e: any) => ({ ...e, _type: 'app' as const, updated: new Date(e.updated_at || e.enrolled_at).getTime() }));
    const builds = buildEnrollments.map((e: any) => ({ ...e, _type: 'build' as const, updated: new Date(e.updated_at || e.enrolled_at).getTime() }));
    return [...apps, ...builds].sort((a, b) => b.updated - a.updated);
  }, [appEnrollments, buildEnrollments]);

  const currentFocus = allEnrollments[0];
  const userName = (user as any)?.full_name?.split(' ')[0] || 'Learner';
  const streak = profileStats?.streak || 0;
  const xp = profileStats?.xp || 0;
  const level = profileStats?.level || 1;
  const heatmap = useMemo(() => {
    const data = heatmapData ? [...heatmapData] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayEntry = data.find(h => h.date === todayStr);
    if (!todayEntry) {
      data.push({ date: todayStr, count: 0, level: 0 });
    }
    return data;
  }, [heatmapData]);

  const hasActivityData = heatmapData && heatmapData.length > 0;
  const isNewUser = (profileStats?.total_solved || 0) === 0 && allEnrollments.length === 0 && chapters.length === 0;
  const isFirstTime = searchParams.get('first_time') === 'true' || isNewUser;

  const isLoading = profileLoading || appLoading || buildLoading || chaptersLoading || missionLoading || questsLoading;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 py-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8 py-6">

      {/* Mission-driven hero */}
      {mission && <MissionHero mission={mission} />}

      {/* Identity + quick stats */}
      <div className="flex flex-wrap items-center gap-3">
        {identity && (
          <span className="inline-flex items-center gap-2 rounded-full bg-reward/10 border border-reward/25 px-4 py-1.5 text-sm font-bold text-reward">
            {identity.identity.title}
          </span>
        )}
        {identity && identity.badges.slice(0, 2).map((b) => (
          <span key={b.badge_id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-meta font-medium text-foreground">
            {b.badge_emoji} {b.badge_name}
          </span>
        ))}
      </div>

      {isFirstTime ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass rounded-2xl p-6 sm:p-8 border border-primary/20 bg-primary/5"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-foreground">You're ready to start, {userName}! 🎉</h3>
              <p className="text-sm text-muted-foreground">Your first mission is waiting. Complete these 3 steps to get started:</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/courses')}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">1</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Complete chapter 1</p>
                <p className="text-xs text-muted-foreground mt-0.5">Takes ~15 min</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/topics')}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">2</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Solve first problem</p>
                <p className="text-xs text-muted-foreground mt-0.5">Arrays is the best place to start</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">3</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Start a challenge</p>
                <p className="text-xs text-muted-foreground mt-0.5">Build real systems</p>
              </div>
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Flame} label="Current Streak" value={formatStreakDays(streak)} color="bg-reward/10 text-reward" />
          <StatCard icon={Zap} label="XP Earned" value={xp} color="bg-reward/10 text-reward" />
          <StatCard icon={Target} label="Level" value={level} color="bg-primary/10 text-primary" />
          <StatCard icon={Trophy} label="Problems Solved" value={profileStats?.total_solved || 0} color="bg-success/10 text-success" />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* Continue Learning - Chapter Progress */}
          {chapters.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-extrabold text-foreground flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Continue Learning
                </h2>
                <Link to="/chapters" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Active chapter card */}
              {activeChapter && (
                <div
                  onClick={() => navigate(`/chapter/${activeChapter.id}`)}
                  className="flex items-center gap-5 p-4 rounded-xl bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors group mb-5"
                >
                  <div className="w-12 h-12 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-lg shadow-md shrink-0">
                    {activeChapter.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Chapter {activeChapter.chapter_number} • {activeChapter.status === 'IN_PROGRESS' ? 'In Progress' : 'Up Next'}</p>
                    <h3 className="text-base font-bold text-foreground truncate">{activeChapter.title}</h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-golden rounded-full transition-all"
                          style={{ width: `${activeChapter.total_steps ? (activeChapter.completed_steps / activeChapter.total_steps) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">{activeChapter.completed_steps}/{activeChapter.total_steps}</span>
                    </div>
                  </div>
                  <button className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm group-hover:-translate-y-0.5 transition-transform">
                    Resume <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Overall phase progress */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">{course?.title || 'Learning Path'}</span>
                <span className="font-bold text-primary">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full gradient-golden rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{completedCount} of {chapters.length} chapters completed</p>
            </motion.section>
          )}

          {/* Active Build Challenges */}
          {buildEnrollments.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-extrabold text-foreground flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" /> Active Build Challenges
                </h2>
                <Link to="/projects" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-3">
                {buildEnrollments.map((enrollment: any) => {
                  const totalStages = enrollment.apprenticeship_programs?.total_projects || 10;
                  const currentStage = enrollment.current_stage || 1;
                  const pct = Math.round((currentStage / totalStages) * 100);

                  return (
                    <div
                      key={enrollment.id}
                      onClick={() => navigate(`/projects/${enrollment.apprenticeship_programs?.slug}`)}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group"
                    >
                      <div className="shrink-0 relative">
                        <ProgressRing value={pct} size={56} strokeWidth={5} label={`${pct}%`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{enrollment.language}</p>
                        <h3 className="text-sm font-bold text-foreground truncate">{enrollment.apprenticeship_programs?.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Stage {currentStage} of {totalStages}</p>
                      </div>
                      <button className="hidden sm:flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-orange-500 transition-colors">
                        Resume <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* Apprenticeship Programs */}
          {appEnrollments.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-extrabold text-foreground flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" /> Apprenticeship Programs
                </h2>
              </div>
              <div className="space-y-3">
                {appEnrollments.map((enrollment: any) => {
                  const pct = Math.round(Number(enrollment.progress_percentage || 0));
                  return (
                    <div
                      key={enrollment.id}
                      onClick={() => navigate(`/apprenticeship/enrollments/${enrollment.id}`)}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group"
                    >
                      <div className="shrink-0 relative">
                        <ProgressRing value={pct} size={56} strokeWidth={5} label={`${pct}%`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-semibold">{enrollment.learning_path}</p>
                        <h3 className="text-sm font-bold text-foreground truncate">{enrollment.apprenticeship_programs?.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {enrollment.completed_projects}/{enrollment.total_projects} projects • Project {enrollment.current_project_number}
                        </p>
                      </div>
                      <button className="hidden sm:flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-orange-500 transition-colors">
                        Open <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {dailyQuests && <DailyQuestsWidget data={dailyQuests} />}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-glass rounded-2xl p-5 border border-border/40"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" fill="currentColor" />
                {format(new Date(), 'MMMM yyyy')}
              </h3>
              {streak > 0 && (
                <span className="text-meta font-bold text-reward bg-reward/10 px-2 py-1 rounded-full">{formatStreakDays(streak)} 🔥</span>
              )}
            </div>
            {heatmapLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : hasActivityData ? (
              <ActivityCalendar heatmap={heatmap} />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 bg-secondary/30 rounded-lg border border-dashed border-border/60">
                <Flame className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">Start your streak today!</p>
              </div>
            )}
            <div className="flex items-center justify-between mt-4 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-secondary/60" />
                <div className="w-3 h-3 rounded-sm bg-orange-500/50" />
                <div className="w-3 h-3 rounded-sm bg-orange-500/80" />
                <div className="w-3 h-3 rounded-sm bg-orange-500" />
              </div>
              <span>More</span>
            </div>
          </motion.div>

          {/* Problem Difficulty Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-glass rounded-2xl p-5 border border-border/40"
          >
            <h3 className="text-sm font-display font-bold text-foreground mb-4">Problems Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: 'Easy', value: profileStats?.easy_solved || 0, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
                { label: 'Medium', value: profileStats?.medium_solved || 0, color: 'bg-amber-500', textColor: 'text-amber-500' },
                { label: 'Hard', value: profileStats?.hard_solved || 0, color: 'bg-red-500', textColor: 'text-red-500' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-muted-foreground">{item.label}</span>
                    <span className={cn('font-bold', item.textColor)}>{item.value}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', item.color)}
                      style={{ width: `${Math.min(100, ((item.value) / Math.max(1, profileStats?.total_solved || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Career Readiness */}
          <CareerReadinessWidget />

          {/* Knowledge Graph */}
          <KnowledgeGraphWidget />

          {/* Referral Status */}
          <ReferralWidget />

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-glass rounded-2xl p-5 border border-border/40"
          >
            <h3 className="text-sm font-display font-bold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/chapters')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-foreground hover:bg-primary/5 border border-border/40 transition-colors group"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="flex-1 text-left">Continue Chapters</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
              <button
                onClick={() => navigate('/projects')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-foreground hover:bg-primary/5 border border-border/40 transition-colors group"
              >
                <Code2 className="w-4 h-4 text-primary" />
                <span className="flex-1 text-left">Browse Build Challenges</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
              <button
                onClick={() => navigate('/ai-coach')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-foreground hover:bg-primary/5 border border-border/40 transition-colors group"
              >
                <Zap className="w-4 h-4 text-primary" />
                <span className="flex-1 text-left">Ask AI Coach</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Index;

// ─── Career Readiness Widget ─────────────────────────────────────────────────
function CareerReadinessWidget() {
  const { careerReadiness, isLoading } = useRoadmap();
  if (isLoading || !careerReadiness) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent p-5"
    >
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-purple-500" />
        Career Readiness
      </h3>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl font-display font-bold text-foreground">
          {careerReadiness.readinessPercent}%
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">{careerReadiness.targetRole}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3 text-reward" />
            <span className="text-[10px] font-bold text-reward">{careerReadiness.salaryBand}</span>
          </div>
        </div>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${careerReadiness.readinessPercent}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="font-bold text-foreground">{careerReadiness.skillsLearned}</p>
          <p className="text-[10px] text-muted-foreground">Skills Learned</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="font-bold text-foreground">{careerReadiness.projectsBuilt}</p>
          <p className="text-[10px] text-muted-foreground">Projects Built</p>
        </div>
      </div>
      {careerReadiness.skillsMissing.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Missing Skills</p>
          <div className="flex flex-wrap gap-1">
            {careerReadiness.skillsMissing.slice(0, 4).map(s => (
              <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">{s}</span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Knowledge Graph Widget ──────────────────────────────────────────────────
function KnowledgeGraphWidget() {
  const { knowledgeGraph, weakAreas, strongAreas, isLoading } = useRoadmap();
  if (isLoading || knowledgeGraph.length === 0) return null;

  const topItems = [
    ...weakAreas.slice(0, 2).map(k => ({ ...k, type: 'weak' as const })),
    ...strongAreas.slice(0, 2).map(k => ({ ...k, type: 'strong' as const })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="card-glass rounded-2xl p-5 border border-border/40"
    >
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        Knowledge Map
      </h3>
      <div className="space-y-2.5">
        {topItems.map(item => (
          <div key={item.topic}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-foreground truncate max-w-[140px] flex items-center gap-1">
                {item.type === 'weak' && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                {item.topic}
              </span>
              <span className={cn(
                'font-bold tabular-nums',
                item.proficiency >= 60 ? 'text-success' : item.proficiency >= 30 ? 'text-primary' : 'text-orange-500'
              )}>
                {item.proficiency}%
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  item.proficiency >= 60 ? 'bg-success' : item.proficiency >= 30 ? 'bg-primary' : 'bg-orange-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${item.proficiency}%` }}
                transition={{ duration: 0.6, delay: 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
      {weakAreas.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-3">
          💡 Focus on <strong className="text-orange-500">{weakAreas[0].topic}</strong> — most learners struggle here
        </p>
      )}
    </motion.div>
  );
}

// ─── Referral Earnings Widget ──────────────────────────────────────────────────
function ReferralWidget() {
  const navigate = useNavigate();
  const { data: refInfo } = useApiQuery<any>(['referral-info'], '/referrals/info');
  
  const referralsCount = refInfo?.referral_count || 0;
  const target = refInfo?.next_tier_target || 5;
  const progressPercent = Math.round((referralsCount / target) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="card-glass rounded-2xl p-5 border border-border/40 relative overflow-hidden group cursor-pointer"
      onClick={() => navigate('/referrals')}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
        <Gift className="w-16 h-16 text-orange-500" />
      </div>
      <h3 className="text-sm font-display font-bold text-foreground mb-1 flex items-center gap-2">
        <Gift className="w-4 h-4 text-orange-500" />
        Earn Free Pro
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Invite friends to unlock Pro features</p>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-foreground">{referralsCount} joined</span>
          <span className="text-orange-500">Tier 1 Unlock: {target}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground text-right mt-1">
          {target - referralsCount} more to go
        </p>
      </div>
    </motion.div>
  );
}
