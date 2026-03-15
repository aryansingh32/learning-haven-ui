import { motion } from 'framer-motion';
import { Award, Flame, Zap, Target, BookOpen, Code, Calendar, Share2, ExternalLink, Star, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { phaseOne } from '@/data/chapters';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keep ALL existing API calls
  const { data: profileStats, isLoading } = useApiQuery<any>(
    ['user-profile-stats'],
    '/users/me/stats'
  );

  const userName = profileStats?.full_name || (user as any)?.full_name || 'Learner';
  const firstName = userName.split(' ')[0];
  const streak = profileStats?.current_streak || 0;
  const xp = profileStats?.xp || 0;
  const level = profileStats?.level || 1;
  const totalSolved = profileStats?.total_solved || 0;
  const chaptersCompleted = phaseOne.missions.filter(m => m.completedSteps >= m.totalSteps).length;
  const college = profileStats?.college_name || (user as any)?.college_name || 'Your College';

  // Build badges from completed chapters
  const earnedBadges = phaseOne.missions
    .filter(m => m.completedSteps >= m.totalSteps)
    .map(m => ({ name: m.reward.badge, xp: m.reward.xp, chapter: m.title }));

  // Activity timeline from completed chapters
  const activityTimeline = phaseOne.missions
    .filter(m => m.completedSteps > 0)
    .map((m, i) => ({
      day: i + 1,
      action: m.completedSteps >= m.totalSteps ? `Completed "${m.title}"` : `Started "${m.title}"`,
      done: m.completedSteps >= m.totalSteps,
    }));

  if (isLoading) {
    return (
    <div className="max-w-7xl mx-auto space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass rounded-2xl p-5 sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-golden flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg overflow-hidden flex-shrink-0">
            {profileStats?.avatar_url ? (
              <img src={profileStats.avatar_url} alt={userName} className="w-full h-full object-cover" />
            ) : (
              firstName.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">{userName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {college} • Phase {phaseOne.missionsCompleted >= phaseOne.missionsTotal ? 2 : 1}
            </p>
            {/* Level progress */}
            <div className="mt-2.5 max-w-[200px]">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full gradient-golden rounded-full"
                  style={{ width: `${profileStats?.level_progress || 40}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {profileStats?.xp_to_next_level ? `${profileStats.xp_to_next_level} XP to Level ${level + 1}` : 'Keep going!'}
              </p>
            </div>
          </div>
        </div>

        {/* Share profile */}
        <div className="mt-4 flex items-center gap-2">
          <button className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-foreground font-bold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors">
            <Share2 className="w-3 h-3" /> Share Profile
          </button>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground font-bold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors">
            <ExternalLink className="w-3 h-3" /> Public Profile
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      {xp === 0 && totalSolved === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 p-6 sm:p-8 text-white shadow-lg"
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
             <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
               <Target className="w-8 h-8 text-white" />
             </div>
             <div className="text-center sm:text-left flex-1">
                <h3 className="text-xl font-bold mb-2">Ready to start your journey?</h3>
                <p className="text-sm text-white/90 font-medium mb-5 max-w-md">
                  You haven't solved any problems yet. That's exactly why you're here. Let's fix that.
                </p>
                <button 
                  onClick={() => navigate('/chapters')}
                  className="bg-white text-indigo-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
                >
                  Start First Mission
                </button>
             </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {[
            { icon: Zap, label: 'Total XP', value: xp, color: 'text-primary' },
            { icon: Flame, label: 'Day Streak', value: streak, color: 'text-destructive' },
            { icon: Target, label: 'Problems', value: totalSolved, color: 'text-info' },
            { icon: BookOpen, label: 'Chapters', value: chaptersCompleted, color: 'text-success' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="card-glass rounded-xl p-3 text-center"
            >
              <stat.icon className={cn('w-5 h-5 mx-auto mb-1.5', stat.color)} />
              <p className="font-display text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Badge Wall */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-glass rounded-2xl p-4 sm:p-5"
      >
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          Badges Earned ({earnedBadges.length})
        </h3>
        {earnedBadges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {earnedBadges.map((badge, i) => (
              <motion.div
                key={badge.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-center"
              >
                <div className="w-10 h-10 rounded-full gradient-golden flex items-center justify-center text-white mx-auto mb-2 shadow-md">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-foreground">{badge.name}</p>
                <p className="text-[10px] text-muted-foreground">{badge.xp} XP</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/60 bg-secondary/10">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">No badges yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Complete your first chapter to earn your beginner badge. It will appear right here.
            </p>
          </div>
        )}
      </motion.div>

      {/* Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-glass rounded-2xl p-4 sm:p-5"
      >
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Activity Timeline
        </h3>
        {activityTimeline.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
            <div className="space-y-3">
              {activityTimeline.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="flex items-start gap-3 relative"
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                    item.done ? 'bg-success' : 'bg-primary'
                  )}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Day {item.day}</p>
                    <p className="text-[11px] text-muted-foreground">{item.action}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/60 bg-secondary/10">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">Your timeline is empty</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Every problem you solve and chapter you complete will be recorded here to track your consistency.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ProfilePage;
