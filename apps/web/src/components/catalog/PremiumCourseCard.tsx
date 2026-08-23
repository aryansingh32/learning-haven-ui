import { ArrowRight, BookOpen, Clock, Crown, Tag, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  accentIndex, chapterCount, COVER_GRADIENTS, courseCover, courseDifficulty, courseDuration,
  courseInitials, difficultyClass, formatCount, type CatalogCourse,
} from './catalog-utils';

type Props = {
  course: CatalogCourse;
  index?: number;
  onClick: () => void;
  variant?: 'vertical' | 'horizontal';
  className?: string;
  isEnrolled?: boolean;
};

function Cover({ course, className }: { course: CatalogCourse; className?: string }) {
  const cover = courseCover(course);
  const gradient = COVER_GRADIENTS[accentIndex(course.id, COVER_GRADIENTS.length)];

  if (cover) {
    return (
      <img
        src={cover}
        alt={course.title}
        loading="lazy"
        className={cn('w-full h-full object-cover transition-transform duration-500 group-hover:scale-105', className)}
      />
    );
  }
  return (
    <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', gradient, className)}>
      <span className="font-display text-3xl font-bold text-primary-foreground/95 tracking-tight">
        {courseInitials(course.title)}
      </span>
    </div>
  );
}

export function PremiumCourseCard({ course, index = 0, onClick, variant = 'vertical', className, isEnrolled }: Props) {
  const difficulty = courseDifficulty(course);
  const duration = courseDuration(course);
  const chapters = chapterCount(course);
  const learners = course.enrolled_count || 0;

  if (variant === 'horizontal') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${course.title}`}
        className={cn(
          'group w-full flex gap-3 p-2 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <div className="w-[76px] h-[64px] shrink-0 rounded-lg overflow-hidden bg-secondary">
          <Cover course={course} />
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <h4 className="text-meta font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {course.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-caption text-muted-foreground">
            {difficulty && <span className="font-medium">{difficulty}</span>}
            {chapters > 0 && <span>{chapters} chapters</span>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      tabIndex={0}
      role="button"
      aria-label={`Open ${course.title}`}
      className={cn(
        'group flex h-full flex-col rounded-2xl border border-border/60 bg-card overflow-hidden cursor-pointer',
        'shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-primary/40 hover:-translate-y-1',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div className="relative h-[132px] overflow-hidden bg-secondary">
        <Cover course={course} />
        {course.is_premium && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-reward text-reward-foreground text-caption font-bold shadow-sm">
              <Crown className="w-3 h-3" /> Premium
            </span>
            {course.is_individually_purchasable && course.price && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card/90 text-foreground text-[10px] font-bold shadow-sm border border-border/60 backdrop-blur-sm">
                <Tag className="w-2.5 h-2.5 text-primary" />
                {`₹${(course.price / 100).toLocaleString('en-IN')}`}
              </span>
            )}
          </div>
        )}
        {difficulty && (
          <span className={cn('absolute bottom-2 left-2 px-1.5 py-0 rounded border text-[10px] tracking-wide font-bold backdrop-blur-sm bg-card/85', difficultyClass(course.difficulty_level))}>
            {difficulty}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="font-display font-semibold text-base text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground pt-0.5">
          {chapters > 0 && (
            <span className="inline-flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {chapters} chapters</span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {duration}</span>
          )}
          {learners > 0 && (
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {formatCount(learners)}</span>
          )}
        </div>
        <span className="mt-auto inline-flex items-center gap-1 text-meta font-bold text-primary pt-2 group-hover:gap-2 transition-all">
          {isEnrolled
            ? 'Continue learning'
            : (course.is_individually_purchasable && course.price)
              ? `Buy \u20b9${(course.price / 100).toLocaleString('en-IN')}`
              : 'Start learning'}{' '}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.article>
  );
}
