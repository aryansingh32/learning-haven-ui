import { ArrowRight, Target, Zap, Users, Clock, Trophy, Linkedin, Flame, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApiQuery } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { phaseOne, phases, communityFeed, getMissionById } from '@/data/chapters';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keep ALL existing API calls untouched
  const { data: profileStats, isLoading: profileLoading } = useApiQuery<{
    total_solved: number;
    rank: string;
    current_streak: number;
    badges: string[];
    recent_activity?: any[];
    full_name?: string;
    avatar_url?: string;
    longest_streak?: number;
    level?: number;
    xp?: number;
    xp_to_next_level?: number;
    level_progress?: number;
    total_tried?: number;
    total_revision?: number;
    consistency?: number;
    avg_study_time?: number;
    easy_solved?: number;
    medium_solved?: number;
    hard_solved?: number;
  }>(
    ['user-profile-stats'],
    '/users/me/stats',
  );

  const { data: settings } = useApiQuery<any>(
    ['public-settings'],
    '/settings/public',
  );

  // Find current active chapter for "Continue Where You Left Off"
  const activeChapterData = phaseOne.missions.find(
    (m) => !m.locked && m.completedSteps < m.totalSteps
  );

  const activeChapter = activeChapterData ? getMissionById(activeChapterData.id) : null;

  const nextStepName = activeChapter?.steps?.[activeChapterData?.completedSteps || 0]?.title || "Crack your first problem today";

  const userName = profileStats?.full_name?.split(' ')[0] || (user as any)?.full_name?.split(' ')[0] || 'Learner';
  const streak = profileStats?.current_streak || 0;
  const xp = profileStats?.xp || 0;

  if (profileLoading) {
    return (
    <div className="max-w-7xl mx-auto space-y-4">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
      {/* Greeting + Streak */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
            Day {streak || 1} 🔥 {userName}. Keep going.
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {streak > 0 ? 'You are building consistency.' : 'Start your streak today.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {xp === 0 && streak === 0 ? (
            <div className="flex items-center gap-1.5 bg-secondary/50 text-muted-foreground px-3 py-1.5 rounded-full text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> Start earning XP
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-xs font-bold">
              <Zap className="w-3.5 h-3.5" />
              {xp} XP
            </div>
          )}
          <div
            className="h-10 w-10 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow-md cursor-pointer overflow-hidden"
            onClick={() => navigate('/profile')}
          >
            {profileStats?.avatar_url ? (
              <img src={profileStats.avatar_url} alt={userName} className="w-full h-full object-cover" />
            ) : (
              userName.charAt(0)
            )}
          </div>
        </div>
      </motion.div>

      {/* Continue Where You Left Off — 40% of screen importance */}
      {activeChapter && (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-[#242424] to-[#121212] p-6 sm:p-10 border border-white/10 shadow-2xl cursor-pointer group min-h-[260px] flex flex-col justify-end"
            onClick={() => navigate(`/chapter/${activeChapter.id}`)}
          >
            {/* Cinematic Background Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/20 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-3 text-white tracking-tight drop-shadow-md">
                Chapter {activeChapter.order}: {activeChapter.title}
              </h2>
              
              <p className="text-sm text-gray-300 font-medium mb-8 max-w-xl">
                You're {Math.round((activeChapter.completedSteps / activeChapter.totalSteps) * 100)}% through this chapter. Don't stop now.
              </p>

              <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all group-hover:-translate-y-1">
                Continue Learning <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
      )}

      {/* Today's Goal */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-glass rounded-2xl p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Today's Goal
          </h3>
          <span className="text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            ~30 min
          </span>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
              <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-foreground">Complete: {nextStepName}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex-shrink-0 rounded-full bg-secondary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Make progress on your journey</p>
          </div>
        </div>
        <div className="mt-3.5 h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-golden rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '50%' }}
            transition={{ duration: 0.8, delay: 0.5 }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">1 of 2 completed today</p>
      </motion.div>

      {/* Phase Overview — Horizontal Scroll */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm font-bold text-foreground mb-3 px-0.5">Your Path to Mastery</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {phases.map((phase, i) => {
            const isLocked = i > 0 && phase.progressPercent === 0;

            return (
              <motion.div
                key={phase.id}
                whileTap={{ scale: isLocked ? 1 : 0.98 }}
                onClick={() => !isLocked && navigate('/chapters')}
                className={cn(
                  "flex-shrink-0 w-[200px] sm:w-[220px] rounded-2xl p-4 border transition-all relative overflow-hidden",
                  i === 0
                    ? 'bg-primary/5 border-primary/20 shadow-sm cursor-pointer'
                    : 'bg-secondary/30 border-border/50',
                  isLocked && 'cursor-not-allowed border-border/30 opacity-80'
                )}
              >
                {isLocked && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-4">
                     <Lock className="w-6 h-6 text-muted-foreground mb-2 opacity-50" />
                     <p className="text-[11px] font-bold text-foreground">Unlocks after Phase 1</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phase {i + 1}</span>
                  {!isLocked && <span className="text-[10px] font-bold text-primary">{phase.progressPercent}%</span>}
                </div>
                <h4 className="text-sm font-bold text-foreground mb-2 leading-tight">{phase.title}</h4>
                
                {!isLocked ? (
                  <>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-golden rounded-full transition-all"
                        style={{ width: `${phase.progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {phase.missionsCompleted}/{phase.missionsTotal} chapters
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">
                      {phase.missionsTotal} chapters
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Community Feed */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card-glass rounded-2xl p-4 sm:p-5 border border-border/40"
      >
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Others on the same journey
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {communityFeed.map((item, i) => {
            let icon = null;
            let bgColor = "bg-secondary";
            let textColor = "text-muted-foreground";

            switch (item.type) {
              case 'completed':
                icon = <Trophy className="w-4 h-4 text-emerald-500" />;
                bgColor = "bg-emerald-500/10";
                textColor = "text-emerald-500";
                break;
              case 'shared':
                icon = <Linkedin className="w-4 h-4 text-blue-500" />;
                bgColor = "bg-[#0A66C2]/10";
                textColor = "text-[#0A66C2]";
                break;
              case 'streak':
                icon = <Flame className="w-4 h-4 text-orange-500" />;
                bgColor = "bg-orange-500/10";
                textColor = "text-orange-500";
                break;
              case 'started':
                icon = <Zap className="w-4 h-4 text-yellow-500" />;
                bgColor = "bg-yellow-500/10";
                textColor = "text-yellow-500";
                break;
            }

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="flex items-center gap-4 py-3 px-4 rounded-xl bg-background/60 hover:bg-background border border-border/30 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    <span className="font-bold">{item.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.action}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] text-muted-foreground/70">{item.time}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{item.city}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
