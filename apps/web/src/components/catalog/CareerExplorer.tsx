import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CareerItem = {
  id: string;
  title: string;
  salary: string;
  jobs: string;
  skills?: string[];
  image?: string;
  description?: string;
};

type Props = {
  title: string;
  careers: CareerItem[];
  onCareerClick?: (career: CareerItem) => void;
  onExploreAllClick?: () => void;
};

export function CareerExplorer({ title, careers, onCareerClick, onExploreAllClick }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-section-title font-bold">{title}</h2>
        <Button variant="link" onClick={onExploreAllClick} className="text-primary font-semibold p-0 text-meta shrink-0">
          Explore all <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x scrollbar-thin">
        {careers.map((career) => (
          <button
            key={career.id}
            type="button"
            onClick={() => onCareerClick?.(career)}
            className={cn(
              'min-w-[280px] max-w-[280px] snap-start rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-md p-5 flex flex-col',
              'text-left hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group'
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1.5">
                <h3 className="font-display font-semibold text-base leading-tight group-hover:text-primary transition-colors">{career.title}</h3>
                <p className="text-xs font-medium text-reward flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-reward animate-pulse"></span>
                  {career.salary} Avg. Salary
                </p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              <strong className="text-foreground">{career.jobs}</strong> open positions
            </p>
            
            {career.skills && career.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-border/50">
                {career.skills.slice(0, 3).map((s) => (
                  <span key={s} className="text-[11px] px-2.5 py-1 rounded-md bg-secondary/80 font-medium text-foreground">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
