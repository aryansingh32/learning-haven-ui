import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Monitor, Minimize2 } from 'lucide-react';
import { ChapterCta } from './ChapterCta';
import { cn } from '@/lib/utils';

interface VideoSectionProps {
  videoId: string;
  channel?: string;
  title?: string;
  duration?: number;
  focusNote?: string;
  timestamps?: Array<{ title: string; seconds: number }>;
  cinemaMode?: boolean;
  onCinemaModeChange?: (active: boolean) => void;
  onMarkDone?: () => void;
}

export const VideoSection: React.FC<VideoSectionProps> = ({
  videoId,
  channel,
  title,
  duration,
  focusNote,
  timestamps = [],
  cinemaMode = false,
  onCinemaModeChange,
  onMarkDone,
}) => {
  const [playing, setPlaying] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!videoId) return null;

  const formatDuration = (mins?: number) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const embedBase = `https://www.youtube.com/embed/${videoId}`;
  const embedParams = 'rel=0&modestbranding=1&playsinline=1';

  const startPlay = () => {
    setPlaying(true);
    onCinemaModeChange?.(true);
  };

  const exitCinema = () => {
    setPlaying(false);
    onCinemaModeChange?.(false);
  };

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setHoverPreview(true), 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverPreview(false);
  };

  const previewSrc = hoverPreview && !playing
    ? `${embedBase}?autoplay=1&mute=1&controls=0&${embedParams}`
    : null;

  const playerSrc = playing
    ? `${embedBase}?autoplay=1&${embedParams}`
    : null;

  return (
    <motion.div
      layout
      className={cn('mt-4 space-y-3', cinemaMode && 'mt-0')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {!cinemaMode && (
        <div>
          <p className="text-sm font-semibold text-foreground">{title || 'Watch this lesson'}</p>
          <p className="text-[11px] text-muted-foreground">
            {channel && <span>{channel}</span>}
            {duration ? <span>{channel ? ' · ' : ''}Duration: {formatDuration(duration)}</span> : null}
          </p>
        </div>
      )}

      <motion.div
        layout
        className={cn(
          'relative overflow-hidden bg-black border border-border/50',
          cinemaMode ? 'rounded-2xl w-full' : 'rounded-2xl'
        )}
        transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
      >
        <motion.div
          layout
          className={cn(
            'relative w-full bg-black',
            cinemaMode ? 'aspect-[16/9] min-h-[min(56vw,520px)]' : 'aspect-video'
          )}
        >
          {!playing && (
            <button
              type="button"
              className="absolute inset-0 z-10 w-full h-full group"
              onClick={startPlay}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              aria-label="Play video"
            >
              {previewSrc ? (
                <iframe
                  className="absolute inset-0 w-full h-full pointer-events-none scale-[1.02]"
                  src={previewSrc}
                  title="Preview"
                  allow="autoplay; encrypted-media"
                />
              ) : (
                <img
                  src={thumbUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                  }}
                />
              )}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1" />
                </div>
              </div>
            </button>
          )}

          {playing && playerSrc && (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={playerSrc}
              title={title || 'YouTube Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </motion.div>

        {playing && (
          <div className="absolute top-3 right-3 z-20 flex gap-2">
            {cinemaMode ? (
              <button
                type="button"
                onClick={exitCinema}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-2 backdrop-blur-sm border border-white/10"
              >
                <Minimize2 className="w-3.5 h-3.5" /> Normal layout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onCinemaModeChange?.(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-2 backdrop-blur-sm border border-white/10"
              >
                <Monitor className="w-3.5 h-3.5" /> Cinema mode
              </button>
            )}
          </div>
        )}
      </motion.div>

      {cinemaMode && playing && (
        <p className="text-center text-xs text-muted-foreground">
          Cinema mode — timeline and notes stay below. Use &ldquo;Normal layout&rdquo; to restore the default view.
        </p>
      )}

      {!cinemaMode && focusNote && <p className="text-xs text-muted-foreground">{focusNote}</p>}

      {!cinemaMode && timestamps.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Key moments</h4>
          <ul className="space-y-1">
            {timestamps.map((ts, idx) => (
              <li key={idx}>
                <a
                  href={`https://youtube.com/watch?v=${videoId}&t=${ts.seconds}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 hover:underline"
                >
                  {Math.floor(ts.seconds / 60)}:{(ts.seconds % 60).toString().padStart(2, '0')} — {ts.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onMarkDone && !cinemaMode && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}

      {onMarkDone && cinemaMode && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
};
