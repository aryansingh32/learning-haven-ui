import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChapterCta } from './ChapterCta';
import type { VisualizerFrame } from '@/data/chapters';

type VisualizerSectionProps = {
  url?: string;
  task?: string;
  notes?: string;
  title?: string;
  frames?: VisualizerFrame[];
  onMarkDone?: () => void;
};

const FRAME_INTERVAL_MS = 1600;

function InteractiveVisualizer({ title, frames }: { title?: string; frames: VisualizerFrame[] }) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frame = frames[index];
  const isLast = index === frames.length - 1;

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setIndex((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, FRAME_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, frames.length]);

  const goTo = (next: number) => {
    setIsPlaying(false);
    setIndex(Math.max(0, Math.min(frames.length - 1, next)));
  };

  const togglePlay = () => {
    if (isLast) {
      setIndex(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => !p);
  };

  const pointerLabelsByIndex = new Map<number, string[]>();
  Object.entries(frame.pointer_labels || {}).forEach(([label, idx]) => {
    const list = pointerLabelsByIndex.get(idx) || [];
    list.push(label);
    pointerLabelsByIndex.set(idx, list);
  });

  return (
    <div className="rounded-2xl bg-secondary/40 border border-border/50 p-5 space-y-5">
      {title && <p className="text-sm font-bold text-foreground">{title}</p>}

      <div className="rounded-xl bg-background/70 border border-border/40 p-6 min-h-[140px] flex flex-col items-center justify-center gap-4">
        {frame.array && frame.array.length > 0 && (
          <div className="flex flex-wrap items-end justify-center gap-2">
            {frame.array.map((value, i) => {
              const isHighlighted = frame.highlight?.includes(i);
              const isSwapped = frame.swapped?.includes(i);
              const labels = pointerLabelsByIndex.get(i);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  {labels && (
                    <div className="flex gap-1">
                      {labels.map((l) => (
                        <span key={l} className="text-[9px] font-bold uppercase text-orange-500 bg-orange-500/10 rounded px-1.5 py-0.5">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                  <motion.div
                    layout
                    animate={{
                      scale: isSwapped ? [1, 1.15, 1] : 1,
                      backgroundColor: isHighlighted ? 'rgb(249 115 22 / 0.18)' : 'transparent',
                    }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'flex items-center justify-center h-12 min-w-[3rem] px-2 rounded-lg border-2 font-bold text-sm transition-colors',
                      isHighlighted ? 'border-orange-500 text-orange-600' : 'border-border/60 text-foreground'
                    )}
                  >
                    {value}
                  </motion.div>
                  <span className="text-[9px] text-muted-foreground">{i}</span>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm text-center text-foreground font-medium max-w-md"
          >
            {frame.caption}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full bg-orange-500"
            animate={{ width: `${((index + 1) / frames.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Step {index + 1} / {frames.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="p-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => goTo(index + 1)} disabled={isLast} className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors">
              <SkipForward className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => goTo(0)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Restart">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisualizerSection({ url, task, notes, title, frames, onMarkDone }: VisualizerSectionProps) {
  const hasInteractive = Array.isArray(frames) && frames.length > 0;

  return (
    <motion.div className="mt-4 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {task && (
        <p className="text-sm font-semibold text-foreground leading-relaxed">{task}</p>
      )}

      {hasInteractive ? (
        <InteractiveVisualizer title={title} frames={frames!} />
      ) : (
        <>
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
        </>
      )}

      {onMarkDone && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
}
