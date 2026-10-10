import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuildDifficultyBadge } from './BuildDifficultyBadge';
import { accentIndex, courseInitials, COVER_GRADIENTS } from '@/components/catalog/catalog-utils';

export interface BuildChallengeCardData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  short_tagline?: string;
  thumbnail_url?: string | null;
  difficulty_level?: string;
  supported_languages?: string[];
  stages_count?: number;
  is_free?: boolean;
  available_modes?: ('traditional' | 'vibe')[];
}

const LANGUAGE_COLORS: Record<string, string> = {
  python: 'bg-[#3776AB]/15 text-[#3776AB] dark:text-[#5B9BD5]',
  javascript: 'bg-[#F7DF1E]/20 text-[#8a7c00] dark:text-[#F7DF1E]',
  java: 'bg-[#E76F00]/15 text-[#E76F00]',
  go: 'bg-[#00ADD8]/15 text-[#00ADD8]',
  rust: 'bg-[#DEA584]/25 text-[#8a5a35] dark:text-[#DEA584]',
  c: 'bg-[#555]/15 text-muted-foreground',
  cpp: 'bg-[#00599C]/15 text-[#00599C] dark:text-[#4FA8DC]',
};

export function BuildChallengeCard({ challenge, index = 0 }: { challenge: BuildChallengeCardData; index?: number }) {
  const gradient = COVER_GRADIENTS[accentIndex(challenge.id, COVER_GRADIENTS.length)];
  const isVibeEnabled = challenge.available_modes?.includes('vibe');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
    >
      <Link
        to={`/projects/${challenge.slug}`}
        aria-label={`Open ${challenge.title}`}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card',
          'shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        {/* Cover */}
        <div className="relative h-[150px] shrink-0 overflow-hidden bg-secondary">
          {challenge.thumbnail_url ? (
            <img
              src={challenge.thumbnail_url}
              alt={challenge.title}
              loading="lazy"
              width={400}
              height={150}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
              <span className="font-display text-3xl font-bold tracking-tight text-primary-foreground/95">
                {courseInitials(challenge.title)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {challenge.difficulty_level && <BuildDifficultyBadge difficulty={challenge.difficulty_level} />}
            {isVibeEnabled && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                <Sparkles className="h-2.5 w-2.5" /> Vibe Coded
              </span>
            )}
          </div>
          {challenge.is_free && (
            <span className="absolute right-2 top-2 rounded-md bg-success/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
              Free
            </span>
          )}
          {challenge.stages_count ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-card/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-sm">
              <Layers className="h-2.5 w-2.5" /> {challenge.stages_count} stages
            </span>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-base font-bold leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary">
            {challenge.title}
          </h3>
          {challenge.short_tagline ? (
            <p className="text-xs font-medium text-primary/90 line-clamp-1">{challenge.short_tagline}</p>
          ) : challenge.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{challenge.description}</p>
          ) : null}

          {(challenge.supported_languages?.length ?? 0) > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {challenge.supported_languages!.slice(0, 4).map((lang) => (
                <span
                  key={lang}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize',
                    LANGUAGE_COLORS[lang] || 'bg-secondary text-muted-foreground'
                  )}
                >
                  {lang}
                </span>
              ))}
            </div>
          )}

          <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary transition-all group-hover:gap-2">
            Start building <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
