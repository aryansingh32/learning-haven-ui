import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { ChapterCta } from './ChapterCta';

type CompleteStepSectionProps = {
  title: string;
  xp: number;
  badgeName: string;
  message?: string;
  onCelebrate: () => void;
};

export function CompleteStepSection({
  title,
  xp,
  badgeName,
  message,
  onCelebrate,
}: CompleteStepSectionProps) {
  return (
    <motion.div
      className="mt-4 py-12 flex flex-col items-center text-center space-y-8 bg-gradient-to-b from-transparent to-orange-500/5 rounded-3xl"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 rounded-full bg-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] flex items-center justify-center"
      >
        <Trophy className="w-12 h-12 text-white" />
      </motion.div>

      <motion.div className="space-y-2">
        <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight">
          Chapter Complete!
        </h2>
        <p className="text-xl text-orange-500 font-bold">+{xp} XP</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {message || (
            <>
              You unlocked the <span className="text-foreground font-bold">{badgeName}</span> milestone
              in <span className="text-foreground font-bold">{title}</span>.
            </>
          )}
        </p>
      </motion.div>

      <ChapterCta variant="celebrate" onClick={onCelebrate}>
        Celebrate &amp; Share
      </ChapterCta>
    </motion.div>
  );
}
