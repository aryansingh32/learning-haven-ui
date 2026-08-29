import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { tracker } from '@/lib/tracker';
import { accentIndex, courseInitials, COVER_GRADIENTS } from '@/components/catalog/catalog-utils';

export interface ApprenticeshipCardData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  difficulty_level?: string;
  total_projects?: number;
  duration_days?: number;
  tech_stack?: string[];
  price_inr?: number;
  original_price_inr?: number | null;
}

export function ApprenticeshipCard({ program, index = 0 }: { program: ApprenticeshipCardData; index?: number }) {
  const gradient = COVER_GRADIENTS[accentIndex(program.id, COVER_GRADIENTS.length)];

  return (
    <Link
      to={`/jobs/apprenticeships/${program.slug}`}
      onClick={() => tracker.track('program_page_viewed', { program_id: program.id, slug: program.slug })}
      aria-label={`Open ${program.title}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card',
        'shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5'
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* Cover */}
      <div className="relative h-[160px] shrink-0 overflow-hidden bg-secondary">
        {program.thumbnail_url ? (
          <img
            src={program.thumbnail_url}
            alt={program.title}
            loading="lazy"
            width={400}
            height={160}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn('relative flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
            <Briefcase className="absolute h-16 w-16 text-primary-foreground/15" />
            <span className="relative font-display text-3xl font-bold tracking-tight text-primary-foreground/95">
              {courseInitials(program.title)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {program.difficulty_level && (
          <Badge variant="outline" className="absolute left-2 top-2 capitalize bg-card/85 backdrop-blur-sm">
            {program.difficulty_level}
          </Badge>
        )}
        {program.total_projects ? (
          <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-white drop-shadow">
            {program.total_projects} Projects
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="mb-1 text-xl font-bold leading-snug transition-colors group-hover:text-primary line-clamp-2">
            {program.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
        </div>

        {(program.tech_stack?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {program.tech_stack!.slice(0, 3).map((tech) => (
              <Badge key={tech} variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10">
                {tech}
              </Badge>
            ))}
            {program.tech_stack!.length > 3 && (
              <span className="self-center text-xs font-medium text-muted-foreground">
                +{program.tech_stack!.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-primary/10 pt-4 transition-colors group-hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="flex items-center text-xs font-medium text-muted-foreground">
              <Clock className="mr-1.5 h-3.5 w-3.5 text-primary" />
              {program.duration_days ? `${program.duration_days} days` : 'Self-paced'}
            </span>
            {typeof program.price_inr === 'number' && (
              <div className="text-right">
                <span className="text-lg font-black">₹{(program.price_inr / 100).toLocaleString('en-IN')}</span>
                {program.original_price_inr ? (
                  <span className="ml-1.5 text-xs text-muted-foreground line-through">
                    ₹{(program.original_price_inr / 100).toLocaleString('en-IN')}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all group-hover:gap-3 group-hover:bg-primary/90">
            View Details <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
