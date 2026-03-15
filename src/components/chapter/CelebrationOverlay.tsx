import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Share2, ArrowRight, X, Flame, Zap } from 'lucide-react';

interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  xpEarned: number;
  badgeName: string;
  skills: string[];
  streakDay: number;
  userName: string;
  onNext?: () => void;
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
  onNext,
}: CelebrationOverlayProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 400);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen]);

  const linkedInText = `🎉 Just completed "${chapterTitle}" on DSA OS!\n\nSkills learned: ${skills.join(', ')}\n📊 ${xpEarned} XP earned · Day ${streakDay} streak 🔥\n\nIf you're from a Tier 3/4 college, this step-by-step approach is worth checking out.\n\n#DSA #CodingJourney #Placements #LearningInPublic`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Confetti effect (CSS-based) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'][i % 6],
                }}
                initial={{ top: '-10%', rotate: 0, opacity: 1 }}
                animate={{
                  top: '110%',
                  rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                  opacity: 0,
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Content */}
          <motion.div
            initial={{ scale: 0.8, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 40, opacity: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative bg-white dark:bg-card rounded-3xl p-6 sm:p-8 w-full max-w-md text-center shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Badge animation */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl shadow-orange-500/20 mb-5"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>

            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-1">
                    Chapter Complete! 🎉
                  </h2>
                  <p className="text-base font-bold text-primary mb-4">{chapterTitle}</p>

                  {/* Skills tags */}
                  <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                    {skills.map((skill) => (
                      <span key={skill} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <Zap className="w-4 h-4 text-primary" /> +{xpEarned} XP
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <Flame className="w-4 h-4 text-destructive" /> Day {streakDay}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <Star className="w-4 h-4 text-primary" /> {badgeName}
                    </div>
                  </div>

                  {/* LinkedIn card preview */}
                  <div className="bg-slate-50 dark:bg-secondary/50 rounded-xl p-4 mb-5 text-left border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-xs">
                        {userName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{userName}</p>
                        <p className="text-[10px] text-muted-foreground">DSA OS Student</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">
                      {linkedInText.substring(0, 150)}...
                    </p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`, '_blank')}
                    className="w-full py-3 bg-[#0077B5] text-white rounded-xl font-bold text-sm mb-3 hover:bg-[#006699] transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Share on LinkedIn
                  </button>

                  {onNext && (
                    <button
                      onClick={onNext}
                      className="w-full py-3 gradient-golden text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      Go to Next Chapter <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip for now
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
