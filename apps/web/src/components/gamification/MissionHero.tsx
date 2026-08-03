import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Target, Briefcase, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mission } from '@/lib/gamification';

type Props = {
  mission: Mission;
  className?: string;
};

export function MissionHero({ mission, className }: Props) {
  const career = mission.career;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl overflow-hidden border border-primary/20',
        'bg-gradient-to-br from-[#020817] via-[#071126] to-[#0B1730] p-6 sm:p-8 shadow-2xl',
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,hsl(221_83%_53%/0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <p className="text-meta font-semibold uppercase tracking-widest text-primary">
            Your Current Mission
          </p>
          <h1 className="font-display text-page-title text-white">{mission.pathTitle}</h1>

          <div className="space-y-2 max-w-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-secondary">Progress</span>
              <span className="font-bold text-primary">{mission.progress}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${mission.progress}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {mission.currentStage && (
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <p className="text-meta text-neutral-secondary mb-1">Current Stage</p>
                <p className="font-semibold text-white">{mission.currentStage}</p>
              </div>
            )}
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-meta text-neutral-secondary mb-1">Next Task</p>
              <p className="font-semibold text-white line-clamp-2">{mission.nextTask}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-reward/15 border border-reward/30 px-4 py-2">
              <Target className="w-4 h-4 text-reward" />
              <span className="text-sm font-bold text-reward">{mission.reward.label}</span>
            </div>
            <Link
              to={mission.continueUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-reward hover:bg-reward/90 text-reward-foreground px-6 py-3 text-sm font-bold shadow-[0_0_20px_hsl(32_100%_50%/0.35)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reward focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]"
            >
              Continue Mission <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {career && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 min-w-[240px] space-y-4">
            <p className="text-meta font-semibold uppercase tracking-widest text-neutral-secondary flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" /> Career Outcome
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-secondary">Skills Learned</span>
                <span className="font-bold text-white">{career.skillsLearned}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-secondary">Projects Built</span>
                <span className="font-bold text-white">{career.projectsBuilt}</span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-secondary">Interview Ready</span>
                  <span className="font-bold text-success">{career.interviewReadiness}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${career.interviewReadiness}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 text-sm">
                <TrendingUp className="w-4 h-4 text-reward" />
                <span className="text-neutral-secondary">Expected:</span>
                <span className="font-bold text-reward">{career.salaryBand}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
