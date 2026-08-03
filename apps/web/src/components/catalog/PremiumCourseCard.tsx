import { ArrowRight, Clock, Star, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  courseCover, courseDifficulty, courseDuration, coursePartner, courseRating, formatLearners, learnerCount,
} from './catalog-utils';

type Props = {
  course: any;
  index?: number;
  onClick: () => void;
  variant?: 'vertical' | 'horizontal';
  className?: string;
};

export function PremiumCourseCard({ course, index = 0, onClick, variant = 'vertical', className }: Props) {
  const rating = courseRating(course.id);
  const learners = formatLearners(learnerCount(course));
  const partner = coursePartner(course, index);
  const cover = courseCover(course);
  const difficulty = courseDifficulty(course);
  const duration = courseDuration(course);

  if (variant === 'horizontal') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group w-full flex gap-3 p-2 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          className
        )}
      >
        <div className="w-[88px] h-[72px] shrink-0 rounded-lg overflow-hidden bg-secondary">
          <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-caption font-semibold text-muted-foreground">{partner}</p>
          <h4 className="text-meta font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary">{course.title}</h4>
          <div className="flex items-center gap-2 mt-1 text-caption text-muted-foreground">
            <Star className="w-3 h-3 text-reward fill-reward" /> {rating}
          </div>
        </div>
      </button>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden cursor-pointer',
        'hover:border-primary/35 hover:shadow-lg hover:-translate-y-1 transition-all duration-200',
        'focus-within:ring-2 focus-within:ring-primary min-w-[240px] max-w-[260px] shrink-0 snap-start',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      tabIndex={0}
      role="button"
    >
      <div className="relative h-[140px] overflow-hidden bg-secondary">
        <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/70 text-caption font-bold text-foreground">
          {partner}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="font-display text-card-title font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="font-medium">{difficulty}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {duration}</span>
        </div>
        <div className="flex items-center justify-between text-meta">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="w-3.5 h-3.5 text-reward fill-reward" /> {rating}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> {learners}
          </span>
        </div>
        <span className="mt-auto inline-flex items-center gap-1 text-meta font-bold text-primary group-hover:text-reward transition-colors pt-1">
          Start Learning <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.article>
  );
}
