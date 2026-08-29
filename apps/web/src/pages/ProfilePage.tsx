import { motion } from 'framer-motion';
import { Award, Flame, Zap, Target, BookOpen, Code, Calendar, Share2, ExternalLink, Star, Trophy, Briefcase, TrendingUp, Brain, AlertTriangle, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { useRoadmap } from '@/context/RoadmapContext';
import { useState } from 'react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [copiedProfile, setCopiedProfile] = useState(false);

  // Keep ALL existing API calls
  const { data: profileStats, isLoading } = useApiQuery<any>(
    ['user-profile-stats'],
    '/users/me/stats'
  );

  const userName = profileStats?.full_name || (user as any)?.full_name || 'Learner';
  const firstName = userName.split(' ')[0];
  const streak = profileStats?.current_streak || 0;
  const xp = profileStats?.xp || 0;
  const apprenticeshipXp = profileStats?.apprenticeship_xp || 0;
  const level = profileStats?.level || 1;
  const totalSolved = profileStats?.total_solved || 0;
  const chaptersCompleted = profileStats?.chapters_completed || 0;
  const college = profileStats?.college_name || (user as any)?.college_name || 'Your College';

  // Build badges from completed chapters
  const earnedBadges = profileStats?.badges || [];

  // Activity timeline from completed chapters
  const activityTimeline = profileStats?.timeline || [];

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
              <img
                src={profileStats.avatar_url}
                alt={userName}
                loading="lazy"
                decoding="async"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              firstName.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">{userName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {college}
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
          <button
            onClick={async () => {
              const profileUrl = `${window.location.origin}/profile/${user?.id}`;
              try {
                await navigator.clipboard.writeText(profileUrl);
                setCopiedProfile(true);
                setTimeout(() => setCopiedProfile(false), 2000);
              } catch {
                window.prompt('Copy your profile link:', profileUrl);
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-foreground font-bold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors"
          >
            {copiedProfile ? <Check className="w-3 h-3 text-green-500" /> : <Share2 className="w-3 h-3" />}
            {copiedProfile ? 'Link Copied!' : 'Share Profile'}
          </button>
          <button
            onClick={() => window.open(`${window.location.origin}/profile/${user?.id}`, '_blank')}
            className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground font-bold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors"
          >
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

      {apprenticeshipXp > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="card-glass rounded-2xl p-4 sm:p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Apprenticeship XP
          </h3>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-2xl font-display font-bold text-foreground">{apprenticeshipXp}</p>
            <p className="text-xs text-muted-foreground mt-1">
              XP earned from verified apprenticeship project stages and completions.
            </p>
          </div>
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

      {/* Career Readiness */}
      <ProfileCareerWidget />

      {/* Knowledge Map */}
      <ProfileKnowledgeWidget />

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

// ─── Profile Career Readiness Widget ─────────────────────────────────────────
function ProfileCareerWidget() {
  const { careerReadiness, momentum, isLoading } = useRoadmap();
  if (isLoading || !careerReadiness) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent p-5"
    >
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-purple-500" />
        Career Readiness
      </h3>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex flex-col items-center justify-center">
          <span className="text-2xl font-display font-bold text-foreground">{careerReadiness.readinessPercent}%</span>
          <span className="text-[9px] text-muted-foreground font-medium">Ready</span>
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">{careerReadiness.targetRole}</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-reward" />
              <span className="text-[10px] font-bold text-reward">{careerReadiness.salaryBand}</span>
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${careerReadiness.readinessPercent}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/30 p-3 text-center">
          <p className="font-bold text-foreground">{careerReadiness.skillsLearned}</p>
          <p className="text-[10px] text-muted-foreground">Skills</p>
        </div>
        <div className="rounded-xl bg-secondary/30 p-3 text-center">
          <p className="font-bold text-foreground">{careerReadiness.projectsBuilt}</p>
          <p className="text-[10px] text-muted-foreground">Projects</p>
        </div>
        <div className="rounded-xl bg-secondary/30 p-3 text-center">
          <p className="font-bold text-foreground">{careerReadiness.interviewReadiness}%</p>
          <p className="text-[10px] text-muted-foreground">Interviews</p>
        </div>
      </div>

      {careerReadiness.skillsMissing.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-500/15 bg-orange-500/5 p-3">
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Skills to Develop
          </p>
          <div className="flex flex-wrap gap-1.5">
            {careerReadiness.skillsMissing.map(s => (
              <span key={s} className="text-[10px] px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold">{s}</span>
            ))}
          </div>
        </div>
      )}

      {momentum && momentum.churnRisk !== 'low' && (
        <div className={cn(
          'mt-3 rounded-xl p-3 text-[11px] font-medium',
          momentum.churnRisk === 'high'
            ? 'bg-destructive/10 text-destructive border border-destructive/20'
            : 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
        )}>
          {momentum.churnRisk === 'high'
            ? `⚠️ ${momentum.daysInactive} days inactive — your career readiness growth has stalled`
            : '💡 Stay consistent! Practice daily to accelerate your career readiness.'
          }
        </div>
      )}
    </motion.div>
  );
}

// ─── Profile Knowledge Map Widget ────────────────────────────────────────────
function ProfileKnowledgeWidget() {
  const { knowledgeGraph, isLoading } = useRoadmap();
  if (isLoading || knowledgeGraph.length === 0) return null;

  const sorted = [...knowledgeGraph].sort((a, b) => b.proficiency - a.proficiency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="card-glass rounded-2xl p-4 sm:p-5"
    >
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        Knowledge Map ({knowledgeGraph.length} topics)
      </h3>
      <div className="space-y-2.5">
        {sorted.slice(0, 8).map((topic, i) => (
          <motion.div
            key={topic.topic}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.03 }}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-foreground truncate max-w-[180px] flex items-center gap-1">
                {topic.proficiency < 30 && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                {topic.topic}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{topic.solved}/{topic.total}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  topic.proficiency >= 70 ? 'bg-success' : topic.proficiency >= 40 ? 'bg-primary' : 'bg-orange-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${topic.proficiency}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
