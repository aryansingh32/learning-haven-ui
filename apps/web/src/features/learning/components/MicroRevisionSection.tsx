import { motion } from 'framer-motion';
import { ChapterCta } from './ChapterCta';

type MicroRevisionSectionProps = {
  connectionMap?: string;
  recallQuestions?: string[];
  identityAffirmation?: string;
  streakReminder?: string;
  onCelebrate: () => void;
};

export function MicroRevisionSection({
  connectionMap,
  recallQuestions = [],
  identityAffirmation,
  streakReminder,
  onCelebrate,
}: MicroRevisionSectionProps) {
  return (
    <motion.div className="mt-4 space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {connectionMap && (
        <motion.div className="rounded-2xl bg-orange-500/5 border border-orange-500/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">
            Connection map
          </p>
          <p className="text-sm text-foreground leading-relaxed">{connectionMap}</p>
        </motion.div>
      )}

      {recallQuestions.length > 0 && (
        <motion.div className="rounded-2xl bg-secondary/40 border border-border/50 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Quick recall
          </p>
          <ul className="space-y-2">
            {recallQuestions.map((q) => (
              <li key={q} className="text-sm text-foreground rounded-lg bg-background/70 px-3 py-2 border border-border/40">
                {q}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {identityAffirmation && (
        <motion.div className="relative p-6 px-8 rounded-2xl bg-orange-500/5 border border-orange-500/20">
          <motion.div className="absolute -top-4 -left-1 text-[80px] text-orange-500/10 font-serif leading-none select-none pointer-events-none">
            &ldquo;
          </motion.div>
          <p className="text-[15px] font-medium text-foreground leading-relaxed relative z-10">
            {identityAffirmation}
          </p>
        </motion.div>
      )}

      {streakReminder && (
        <p className="text-xs text-muted-foreground text-center">{streakReminder}</p>
      )}

      <ChapterCta variant="celebrate" onClick={onCelebrate} className="w-full justify-center">
        Celebrate &amp; Share
      </ChapterCta>
    </motion.div>
  );
}
