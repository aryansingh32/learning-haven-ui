import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Highlighter, BookPlus, Loader2 } from 'lucide-react';
import { MarkdownContent } from '@/features/build-haven/components/MarkdownContent';
import { ChapterCta } from './ChapterCta';
import { appendChapterNoteHighlight } from '@/data/notebook';
import { parseEntitlementError } from '@/lib/entitlementError';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type DocSectionProps = {
  markdown: string;
  chapterId?: string;
  chapterTitle?: string;
  onMarkDone?: () => void;
};

export function DocSection({ markdown, chapterId, chapterTitle, onMarkDone }: DocSectionProps) {
  const navigate = useNavigate();
  const [selectedText, setSelectedText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const appendMutation = useMutation({
    mutationFn: (text: string) => appendChapterNoteHighlight(chapterId!, text, chapterTitle),
    onSuccess: () => toast.success('Added to your notebook'),
    onError: (err) => {
      const { denied } = parseEntitlementError(err);
      if (denied) {
        toast.error('Adding highlights to your notebook is a Pro feature.', {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      } else {
        toast.error('Could not add to notebook. Try again.');
      }
    },
  });

  if (!markdown?.trim()) return null;

  const handleSelection = () => {
    const selection = window.getSelection()?.toString().trim() || '';
    setSelectedText(selection);
  };

  return (
    <motion.div className="mt-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        ref={containerRef}
        onMouseUp={handleSelection}
        className="rounded-2xl bg-secondary/40 border border-border/50 p-4 space-y-2"
      >
        <MarkdownContent content={markdown} />
      </motion.div>

      {chapterId && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedText && (
            <button
              type="button"
              onClick={() => appendMutation.mutate(selectedText)}
              disabled={appendMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-600 px-3 py-1.5 text-xs font-bold hover:bg-orange-500/20 transition-colors disabled:opacity-50"
            >
              {appendMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Highlighter className="h-3.5 w-3.5" />
              )}
              Add selection to Notebook
            </button>
          )}
          <button
            type="button"
            onClick={() => appendMutation.mutate(markdown)}
            disabled={appendMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 text-muted-foreground px-3 py-1.5 text-xs font-bold hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <BookPlus className="h-3.5 w-3.5" />
            Save entire doc to Notebook
          </button>
        </div>
      )}

      {onMarkDone && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
}
