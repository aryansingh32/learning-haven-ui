import { motion } from 'framer-motion';
import { ChapterCta } from './ChapterCta';

interface StoryHookProps {
  content?: string;
  onMarkDone?: () => void;
}

export const StoryHook: React.FC<StoryHookProps> = ({ content, onMarkDone }) => {
  if (!content) return null;

  return (
    <motion.div className="mt-6 space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="relative p-6 px-8 rounded-2xl bg-orange-500/5 border border-orange-500/20">
        <motion.div className="absolute -top-4 -left-1 text-[80px] text-orange-500/10 font-serif leading-none select-none pointer-events-none">
          &ldquo;
        </motion.div>
        <p className="text-[15px] font-medium text-foreground leading-relaxed relative z-10">
          {content}
        </p>
      </motion.div>

      {onMarkDone && (
        <ChapterCta onClick={onMarkDone}>
          Understood, let&apos;s practice
        </ChapterCta>
      )}
    </motion.div>
  );
};
