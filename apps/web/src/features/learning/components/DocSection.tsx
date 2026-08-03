import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ChapterCta } from './ChapterCta';

type DocSectionProps = {
  markdown: string;
  onMarkDone?: () => void;
};

export function DocSection({ markdown, onMarkDone }: DocSectionProps) {
  if (!markdown?.trim()) return null;

  return (
    <motion.div className="mt-4 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="rounded-2xl bg-secondary/40 border border-border/50 p-4 space-y-2">
        <motion.div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </motion.div>
      </motion.div>
      {onMarkDone && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
}
