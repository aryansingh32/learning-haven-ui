import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyQuests } from '@/lib/gamification';

type Props = {
  data: DailyQuests;
  className?: string;
};

export function DailyQuestsWidget({ data, className }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className={cn('card-glass rounded-2xl p-5 border border-border/40', className)}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-section-title font-display font-bold text-foreground">Today&apos;s Mission</h2>
          <p className="text-meta text-muted-foreground mt-0.5">
            {data.completedCount}/{data.totalCount} complete
          </p>
        </div>
        <div className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
          data.allComplete ? 'bg-reward/15 text-reward' : 'bg-secondary text-muted-foreground'
        )}>
          <Sparkles className="w-3.5 h-3.5" />
          +{data.bonusXp} XP
        </div>
      </div>

      <ul className="space-y-2.5">
        {data.quests.map((quest, i) => (
          <motion.li
            key={quest.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors',
              quest.completed
                ? 'bg-success/5 border-success/20'
                : 'bg-background/50 border-border/50'
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border',
              quest.completed
                ? 'bg-success border-success text-success-foreground'
                : 'border-border bg-secondary/50'
            )}>
              {quest.completed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </div>
            <span className={cn(
              'flex-1 text-body font-medium',
              quest.completed ? 'text-muted-foreground line-through' : 'text-foreground'
            )}>
              {quest.label}
            </span>
            <span className="text-meta font-semibold text-reward">+{quest.xp}</span>
          </motion.li>
        ))}
      </ul>

      {data.allComplete && (
        <motion.p
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 text-center text-sm font-semibold text-reward"
        >
          {data.rewardClaimed ? '🎉 Daily bonus claimed!' : '🎉 All quests complete — bonus XP awarded!'}
        </motion.p>
      )}
    </motion.section>
  );
}
