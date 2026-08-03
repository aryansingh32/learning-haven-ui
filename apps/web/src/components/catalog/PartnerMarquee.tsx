import { cn } from '@/lib/utils';

export type Partner = { name: string; logo: string; courses: number };

type Props = {
  title?: string;
  partners: Partner[];
  onPartnerClick?: (partner: Partner) => void;
  className?: string;
};

export function PartnerMarquee({ title, partners, onPartnerClick, className }: Props) {
  const doubled = [...partners, ...partners];

  return (
    <section className={cn('py-4 border-y border-border/60 bg-secondary/30 overflow-hidden', className)}>
      {title && (
        <p className="text-center text-meta font-semibold text-muted-foreground mb-3 px-4">
          {title}
        </p>
      )}
      <div className="group/marquee relative">
        <div className="flex animate-marquee group-hover/marquee:[animation-play-state:paused] w-max gap-10 px-4">
          {doubled.map((p, i) => (
            <button
              key={`${p.name}-${i}`}
              type="button"
              onClick={() => onPartnerClick?.(p)}
              className="flex flex-col items-center gap-1.5 shrink-0 opacity-70 hover:opacity-100 grayscale hover:grayscale-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg px-3 py-2"
              title={`${p.courses} courses`}
            >
              <img src={p.logo} alt={p.name} className="h-5 md:h-6 w-auto max-w-[100px] object-contain" />
              <span className="text-caption font-semibold text-muted-foreground whitespace-nowrap">
                {p.name} · {p.courses} courses
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
