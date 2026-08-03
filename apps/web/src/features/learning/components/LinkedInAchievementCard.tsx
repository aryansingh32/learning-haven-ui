import { forwardRef } from 'react';
import { Sparkles } from 'lucide-react';

export type LinkedInAchievementCardProps = {
  userName: string;
  chapterTitle: string;
  xpEarned: number;
  streakDay: number;
  badgeName: string;
  skills: string[];
  chapterNumber?: number;
  courseTitle?: string;
};

function MedalIcon() {
  return (
    <svg viewBox="0 0 120 140" className="w-[88px] h-[100px] drop-shadow-2xl" aria-hidden>
      <defs>
        <linearGradient id="lh-ribbon-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="lh-ribbon-r" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id="lh-medal-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path d="M38 8 L60 28 L82 8 L74 42 L96 48 L60 52 L24 48 L46 42 Z" fill="url(#lh-ribbon-l)" />
      <path d="M60 28 L82 8 L88 38 L60 52 Z" fill="url(#lh-ribbon-r)" opacity="0.95" />
      <circle cx="60" cy="88" r="38" fill="url(#lh-medal-g)" stroke="#fff" strokeWidth="3" />
      <circle cx="60" cy="88" r="30" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      <path
        d="M60 68 L66 82 L82 84 L70 94 L74 110 L60 102 L46 110 L50 94 L38 84 L54 82 Z"
        fill="#fff"
        opacity="0.95"
      />
    </svg>
  );
}

export const LinkedInAchievementCard = forwardRef<HTMLDivElement, LinkedInAchievementCardProps>(
  function LinkedInAchievementCard(
    { userName, chapterTitle, xpEarned, streakDay, badgeName, skills, chapterNumber, courseTitle },
    ref
  ) {
    const firstName = userName.split(' ')[0] || userName;
    const skillTags = skills.filter(Boolean).slice(0, 3);
    const hashtags = [
      '#LearningInPublic',
      '#DSA',
      '#SoftwareEngineering',
      ...skillTags.map((s) => `#${s.replace(/[^a-zA-Z0-9]/g, '')}`),
    ].slice(0, 5);

    return (
      <div className="w-full max-w-[380px] mx-auto">
        <div
          ref={ref}
          id="linkedin-achievement-card"
          className="relative overflow-hidden rounded-[28px] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            background: 'linear-gradient(145deg, #fb923c 0%, #f97316 35%, #ea580c 70%, #c2410c 100%)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 12px,
                rgba(255,255,255,0.35) 12px,
                rgba(255,255,255,0.35) 24px
              )`,
            }}
          />
          <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full bg-amber-300/20 blur-2xl" />

          <div className="relative px-8 pt-10 pb-8 text-center">
            <Sparkles className="absolute top-6 left-8 w-5 h-5 text-amber-200/80" />
            <Sparkles className="absolute top-14 right-10 w-4 h-4 text-white/60" />

            <div className="flex justify-center mb-4">
              <MedalIcon />
            </div>

            <h2 className="text-[2rem] font-extrabold tracking-tight leading-tight mb-3 drop-shadow-sm">
              Congratulations!
            </h2>

            <p className="text-[15px] leading-relaxed text-white/95 font-medium px-1 mb-5">
              <span className="font-bold text-white">{firstName}</span> completed{' '}
              <span className="font-bold text-white">&ldquo;{chapterTitle}&rdquo;</span>
              {chapterNumber != null && courseTitle ? (
                <>
                  {' '}
                  — Chapter {chapterNumber} on {courseTitle}.
                </>
              ) : (
                <> on Learning Haven.</>
              )}{' '}
              Another step toward interview-ready DSA skills.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 border border-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                ⚡ +{xpEarned} XP
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 border border-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                🔥 Day {streakDay} streak
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 border border-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm max-w-[220px] truncate">
                🏆 {badgeName}
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mb-6">
              {hashtags.map((tag) => (
                <span key={tag} className="text-[10px] font-semibold text-white/80">
                  {tag}
                </span>
              ))}
            </div>

            <div className="rounded-2xl bg-black/25 border border-white/15 px-4 py-3 backdrop-blur-md text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/90 mb-0.5">
                Learning Haven
              </p>
              <p className="text-[11px] text-white/75 leading-snug">
                Structured DSA courses · Placement-ready projects · Built for Tier 2/3 engineers
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
