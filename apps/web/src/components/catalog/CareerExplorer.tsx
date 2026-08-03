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
};

export function CareerExplorer({ title, careers, onCareerClick }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-section-title font-bold">{title}</h2>
        <Button variant="link" className="text-primary font-semibold p-0 text-meta shrink-0">
          Explore all <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x scrollbar-thin">
        {careers.map((career) => (
          <button
            key={career.id}
            type="button"
            onClick={() => onCareerClick?.(career)}
            className={cn(
              'min-w-[220px] max-w-[220px] snap-start rounded-xl border border-border/60 bg-card overflow-hidden',
              'text-left hover:border-primary/35 hover:shadow-md transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
          >
            <div className="h-[100px] relative overflow-hidden bg-primary/5">
              {career.image && (
                <img src={career.image} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-3.5 space-y-2">
              <h3 className="font-bold text-card-title leading-tight">{career.title}</h3>
              <p className="text-meta font-semibold text-reward">{career.salary}</p>
              <p className="text-caption text-muted-foreground">{career.jobs}</p>
              {career.skills && career.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {career.skills.slice(0, 3).map((s) => (
                    <span key={s} className="text-caption px-2 py-0.5 rounded-full bg-secondary font-medium text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-meta text-primary font-semibold pt-0.5">View learning path →</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
