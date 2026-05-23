import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { ChapterCta } from './ChapterCta';

type VisualizerSectionProps = {
  url?: string;
  task?: string;
  notes?: string;
  onMarkDone?: () => void;
};

export function VisualizerSection({ url, task, notes, onMarkDone }: VisualizerSectionProps) {
  return (
    <motion.div className="mt-4 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {task && (
        <p className="text-sm font-semibold text-foreground leading-relaxed">{task}</p>
      )}
      {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-2.5 text-sm font-bold text-orange-600 hover:bg-orange-500/10 transition-colors"
        >
          Open visualizer <ExternalLink className="h-4 w-4" />
        </a>
      )}
      {onMarkDone && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
}
