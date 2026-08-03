import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { X, Download, Copy, Linkedin, ArrowRight, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
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
      return;
    }

    document.body.style.overflow = 'hidden';
    const duration = 1600;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 50,
        origin: { x: 0, y: 0.7 },
        colors: ['#f97316', '#fbbf24'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 50,
        origin: { x: 1, y: 0.7 },
        colors: ['#f97316', '#fbbf24'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    const controls = animate(0, xpEarned, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayXp(Math.floor(v)),
    });

    return () => {
      document.body.style.overflow = '';
      controls.stop();
    };
  }, [isOpen, xpEarned]);

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
            className="absolute inset-0 bg-black/55 backdrop-blur-xl"
            onClick={onClose}
          />

          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              className="pointer-events-auto w-full max-w-[400px] max-h-[min(92vh,720px)] flex flex-col rounded-2xl border border-white/10 bg-[#121212] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header — close always visible */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#121212]">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                    Chapter complete
                  </p>
                  <h2 id="celebration-title" className="text-lg font-bold text-white truncate">
                    You leveled up 🚀
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
                <div className="text-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-500/25 px-3 py-1 text-sm font-bold text-orange-400">
                    +{displayXp} XP · {chapterTitle}
                  </span>
                </div>

                <p className="text-center text-[11px] text-white/40 -mt-1">
                  Download or share this card on LinkedIn
                </p>

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

                <button
                  type="button"
                  onClick={() => void downloadCard()}
                  disabled={downloading || sharing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 text-sm font-bold disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download card (PNG)
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyCaption()}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy caption
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareLinkedIn()}
                    disabled={sharing || downloading}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] py-2.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Linkedin className="w-3.5 h-3.5" />}
                    Share on LinkedIn
                  </button>
                </div>

                {onNext ? (
                  <button
                    type="button"
                    onClick={onNext}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white"
                  >
                    Next chapter <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
};
