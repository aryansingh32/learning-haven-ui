import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import {
  X, Download, Copy, Linkedin, ArrowRight, Loader2, Trophy, Zap, Flame, Share2, ChevronDown,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LinkedInAchievementCard } from './LinkedInAchievementCard';

export interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  xpEarned: number;
  badgeName: string;
  skills: string[];
  streakDay: number;
  userName: string;
  linkedInText?: string;
  chapterNumber?: number;
  courseTitle?: string;
  onNext?: () => void;
}

function buildLinkedInCaption(props: {
  userName: string;
  chapterTitle: string;
  xpEarned: number;
  streakDay: number;
  badgeName: string;
  skills: string[];
  custom?: string;
}) {
  if (props.custom?.trim()) return props.custom.trim();

  const tags = ['#LearningInPublic', '#DSA', '#SoftwareEngineering', '#Placements']
    .concat(props.skills.filter(Boolean).slice(0, 2).map((s) => `#${s.replace(/[^a-zA-Z0-9]/g, '')}`))
    .join(' ');

  return `🎉 I just completed "${props.chapterTitle}" on Learning Haven!

✅ Milestone: ${props.badgeName}
⚡ +${props.xpEarned} XP earned
🔥 ${props.streakDay}-day learning streak

Structured DSA courses built for engineers from Tier 2/3 colleges — if you're preparing for tech interviews, this platform is worth exploring.

${tags}`;
}

export default function CelebrationOverlay({
  isOpen,
  onClose,
  chapterTitle,
  xpEarned,
  badgeName,
  skills,
  streakDay,
  userName,
  linkedInText,
  chapterNumber,
  courseTitle,
  onNext,
}: CelebrationOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [displayXp, setDisplayXp] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const caption = buildLinkedInCaption({
    userName,
    chapterTitle,
    xpEarned,
    streakDay,
    badgeName,
    skills,
    custom: linkedInText,
  });

  useEffect(() => {
    if (!isOpen) {
      setDisplayXp(0);
      setShareOpen(false);
      return;
    }

    document.body.style.overflow = 'hidden';

    // Respect users who prefer reduced motion — skip the confetti burst.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    if (!prefersReduced) {
      const end = Date.now() + 1600;
      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#f97316', '#fbbf24', '#10b981'],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#f97316', '#fbbf24', '#10b981'],
        });
        if (Date.now() < end) raf = requestAnimationFrame(frame);
      };
      frame();
    }

    const controls = animate(0, xpEarned, {
      duration: prefersReduced ? 0 : 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayXp(Math.floor(v)),
    });

    return () => {
      document.body.style.overflow = '';
      controls.stop();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isOpen, xpEarned]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const generatePng = useCallback(async () => {
    if (!cardRef.current) throw new Error('Card not ready');
    const node = cardRef.current;
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ea580c',
      width: node.offsetWidth,
      height: node.offsetHeight,
      skipFonts: true,
    });
  }, []);

  const downloadCard = useCallback(async () => {
    setDownloading(true);
    try {
      const dataUrl = await generatePng();
      const link = document.createElement('a');
      const slug = chapterTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      link.download = `learning-haven-${slug}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Achievement card downloaded!');
      return dataUrl;
    } catch (e) {
      console.error(e);
      toast.error('Could not generate image. Try again.');
      return null;
    } finally {
      setDownloading(false);
    }
  }, [chapterTitle, generatePng]);

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption copied to clipboard.');
    } catch {
      toast.error('Could not copy caption.');
    }
  }, [caption]);

  const shareLinkedIn = useCallback(async () => {
    setSharing(true);
    try {
      await copyCaption();
      const dataUrl = await generatePng();
      if (!dataUrl) return;

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'learning-haven-achievement.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Learning Haven — Chapter complete',
          text: caption,
          files: [file],
        });
        toast.success('Shared! If LinkedIn did not open, use Download + paste caption.');
        return;
      }

      const link = document.createElement('a');
      link.download = `learning-haven-${chapterTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.open(
        `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`,
        '_blank',
        'noopener,noreferrer'
      );
      toast.success('Image downloaded & caption copied. Attach the image in your LinkedIn post.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        toast.error('Share failed. Try Download card + Copy caption.');
      }
    } finally {
      setSharing(false);
    }
  }, [caption, chapterTitle, copyCaption, generatePng]);

  const stats = [
    { icon: Zap, label: 'XP earned', value: `+${displayXp}`, tone: 'text-reward' },
    { icon: Flame, label: 'Day streak', value: String(streakDay), tone: 'text-orange-500' },
    { icon: Trophy, label: 'Milestone', value: badgeName, tone: 'text-primary' },
  ];

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200]"
        >
          <button
            type="button"
            aria-label="Close celebration"
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="pointer-events-auto flex w-full max-w-[460px] max-h-[min(94vh,780px)] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Hero — the achievement itself leads */}
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 px-6 pb-6 pt-7 text-center text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.28),transparent_55%)]" />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/35"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>

                <motion.div
                  initial={{ scale: 0, rotate: -18 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 14 }}
                  className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 ring-4 ring-white/25 backdrop-blur-sm"
                >
                  <Trophy className="h-8 w-8" />
                </motion.div>

                <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                  {chapterNumber ? `Chapter ${chapterNumber} complete` : 'Chapter complete'}
                </p>
                <h2 id="celebration-title" className="relative mt-1 text-2xl font-extrabold leading-tight">
                  {chapterTitle}
                </h2>
                {courseTitle && (
                  <p className="relative mt-1 text-xs font-medium text-white/75">{courseTitle}</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {stats.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.07 }}
                      className="rounded-xl border border-border/50 bg-secondary/30 p-3 text-center"
                    >
                      <s.icon className={cn('mx-auto mb-1.5 h-4 w-4', s.tone)} />
                      <p className="truncate font-display text-base font-bold leading-tight text-foreground" title={s.value}>
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{s.label}</p>
                    </motion.div>
                  ))}
                </div>

                {skills.filter(Boolean).length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {skills.filter(Boolean).slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Primary action — keep learning */}
                {onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-amber-600 hover:shadow-xl"
                  >
                    Continue to next chapter <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary"
                >
                  Back to chapter
                </button>

                {/* Sharing — secondary, collapsed by default */}
                <div className="rounded-xl border border-border/60 bg-secondary/20">
                  <button
                    type="button"
                    onClick={() => setShareOpen((v) => !v)}
                    aria-expanded={shareOpen}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Share2 className="h-4 w-4 text-primary" />
                      Share your achievement
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        shareOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {shareOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 border-t border-border/50 p-4">
                          <LinkedInAchievementCard
                            ref={cardRef}
                            userName={userName}
                            chapterTitle={chapterTitle}
                            xpEarned={xpEarned}
                            streakDay={streakDay}
                            badgeName={badgeName}
                            skills={skills}
                            chapterNumber={chapterNumber}
                            courseTitle={courseTitle}
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => void downloadCard()}
                              disabled={downloading || sharing}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                            >
                              {downloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              Download PNG
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyCaption()}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy caption
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => void shareLinkedIn()}
                            disabled={sharing || downloading}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#095196] disabled:opacity-60"
                          >
                            {sharing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Linkedin className="h-3.5 w-3.5" />
                            )}
                            Share on LinkedIn
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
