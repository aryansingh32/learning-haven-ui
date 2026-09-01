import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, RotateCcw, CheckCircle2, XCircle, Lightbulb, FileText, BookPlus, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoTimelineEvent } from '@/data/chapters';
import { appendChapterNoteHighlight } from '@/data/notebook';
import { parseEntitlementError } from '@/lib/entitlementError';
import { toast } from 'sonner';

type VideoTimelinePanelProps = {
  events: VideoTimelineEvent[];
  currentTime: number;
  chapterId: string;
  chapterTitle?: string;
};

const typeMeta: Record<VideoTimelineEvent['type'], { label: string; icon: typeof Sparkles; color: string }> = {
  flashcard: { label: 'Flashcard', icon: Sparkles, color: 'text-purple-500' },
  note: { label: 'Note', icon: FileText, color: 'text-blue-500' },
  quiz: { label: 'Quick Check', icon: CheckCircle2, color: 'text-emerald-500' },
  doc: { label: 'Quick Read', icon: FileText, color: 'text-orange-500' },
  message: { label: 'Tip', icon: Lightbulb, color: 'text-amber-500' },
};

function findActiveEvent(events: VideoTimelineEvent[], currentTime: number): VideoTimelineEvent | null {
  const sorted = [...events].sort((a, b) => a.start_sec - b.start_sec);
  let active: VideoTimelineEvent | null = null;
  for (const ev of sorted) {
    if (currentTime < ev.start_sec) break;
    if (ev.end_sec !== undefined && currentTime >= ev.end_sec) continue;
    active = ev;
  }
  return active;
}

function FlashcardCard({ event }: { event: VideoTimelineEvent }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="w-full text-left rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 min-h-[90px] flex flex-col justify-center"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1.5">
        {flipped ? 'Answer — tap to flip back' : 'Flashcard — tap to reveal'}
      </p>
      <p className="text-sm font-semibold text-foreground">{flipped ? event.body : event.front || event.title || event.body}</p>
    </button>
  );
}

function QuizCard({ event }: { event: VideoTimelineEvent }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect = selected !== null && selected === event.correct_index;

  return (
    <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Quick Check</p>
      <p className="text-sm font-semibold text-foreground">{event.body}</p>
      <div className="space-y-1.5">
        {(event.options || []).map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = selected !== null && i === event.correct_index;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                'w-full text-left rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                showCorrect
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700'
                  : isSelected
                    ? 'border-red-400 bg-red-500/10 text-red-600'
                    : 'border-border/50 bg-background hover:border-emerald-400/50'
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <p className={cn('text-xs font-bold flex items-center gap-1', isCorrect ? 'text-emerald-600' : 'text-red-500')}>
          {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {isCorrect ? 'Correct!' : 'Not quite — keep watching.'}
        </p>
      )}
    </div>
  );
}

export function VideoTimelinePanel({ events, currentTime, chapterId, chapterTitle }: VideoTimelinePanelProps) {
  const navigate = useNavigate();
  const active = useMemo(() => findActiveEvent(events, currentTime), [events, currentTime]);

  const saveMutation = useMutation({
    mutationFn: (text: string) => appendChapterNoteHighlight(chapterId, text, chapterTitle),
    onSuccess: () => toast.success('Saved to your notebook'),
    onError: (err) => {
      const { denied } = parseEntitlementError(err);
      if (denied) {
        toast.error('Saving video highlights to your notebook is a Pro feature.', {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      } else {
        toast.error('Could not save. Try again.');
      }
    },
  });

  if (!events.length) return null;

  const meta = active ? typeMeta[active.type] : null;
  const Icon = meta?.icon || RotateCcw;

  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 min-h-[110px]">
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key={`${active.start_sec}-${active.type}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest', meta?.color)}>
                <Icon className="h-3.5 w-3.5" /> {meta?.label}
              </span>
              <button
                type="button"
                onClick={() => saveMutation.mutate(`${active.title ? `**${active.title}**\n` : ''}${active.body}`)}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-orange-600 transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookPlus className="h-3 w-3" />}
                Save
              </button>
            </div>

            {active.type === 'flashcard' && <FlashcardCard event={active} />}
            {active.type === 'quiz' && <QuizCard event={active} />}
            {active.type === 'note' && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                {active.title && <p className="text-sm font-bold text-foreground mb-1">{active.title}</p>}
                <p className="text-sm text-foreground/90 leading-relaxed">{active.body}</p>
              </div>
            )}
            {active.type === 'doc' && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                {active.title && <p className="text-sm font-bold text-foreground mb-1">{active.title}</p>}
                <p className="text-sm text-foreground/90 leading-relaxed">{active.body}</p>
              </div>
            )}
            {active.type === 'message' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-medium text-foreground">
                {active.body}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center py-6"
          >
            Interactive flashcards, notes, and quick checks will appear here as the video plays.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
