import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { courseInitials, COVER_GRADIENTS, accentIndex, type CatalogCourse } from './catalog-utils';
import { useNavigate } from 'react-router-dom';

type EnrolledPathsProps = {
  enrollments: any[];
};

export function EnrolledPaths({ enrollments }: EnrolledPathsProps) {
  const navigate = useNavigate();

  if (!enrollments || enrollments.length === 0) return null;

  return (
    <section className="space-y-4 animate-fade-slide-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-section-title font-bold text-foreground">Learning Paths</h2>
          <p className="text-meta text-muted-foreground mt-0.5">Follow structured paths to build strong foundations and advanced skills.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x scrollbar-thin">
        {enrollments.map((enrollment) => {
          const course = enrollment.courses as CatalogCourse;
          if (!course) return null;
          
          const gradient = COVER_GRADIENTS[accentIndex(course.id, COVER_GRADIENTS.length)];
          const progress = enrollment.progress_percentage || 0;
          
          return (
            <button
              key={enrollment.id}
              type="button"
              onClick={() => navigate(`/course/${course.id}/chapters`)}
              className={cn(
                'min-w-[300px] max-w-[300px] snap-start rounded-2xl border border-border/50 bg-card p-5 flex flex-col',
                'text-left hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group'
              )}
            >
              <div className="flex items-start gap-4 mb-5">
                {course.cover_image ? (
                  <img
                    src={course.cover_image}
                    alt={course.title}
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm"
                  />
                ) : (
                  <div className={cn('w-12 h-12 rounded-xl flex shrink-0 items-center justify-center font-display font-bold text-lg text-white shadow-inner bg-gradient-to-br', gradient)}>
                    {courseInitials(course.title)}
                  </div>
                )}
                <div>
                  <h3 className="font-display font-bold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-1 tracking-wide uppercase">
                    {course.difficulty_level || 'Beginner'}
                  </p>
                </div>
              </div>
              
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
