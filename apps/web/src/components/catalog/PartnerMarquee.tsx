import { cn } from '@/lib/utils';

export type Partner = { name: string; logo: string; courses: number };

type Props = {
  title?: string;
  partners: Partner[];
  onPartnerClick?: (partner: Partner) => void;
  className?: string;
};

export function PartnerMarquee({ title, partners, onPartnerClick, className }: Props) {
  // Filter out partners that have an empty name and 0 courses
  const validPartners = partners.filter(p => p.name || p.courses > 0);
  
  if (validPartners.length === 0) return null;

  // Triple the items to ensure it covers very wide screens and loops seamlessly
  const trippled = [...validPartners, ...validPartners, ...validPartners];

  return (
    <section className={cn('py-4 overflow-hidden relative', className)}>
      {title && (
        <p className="text-center text-meta font-semibold text-muted-foreground mb-4 px-4">
          {title}
        </p>
      )}
      
      {/* 
        mask-image creates the seamless fade effect at the edges 
        so the start/end bounds aren't visible as hard rectangles
      */}
      <div 
        className="group/marquee relative flex overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
        }}
      >
        <div className="flex animate-marquee group-hover/marquee:[animation-play-state:paused] w-max gap-12 pr-12">
          {trippled.map((p, i) => (
            <button
              key={`${p.name || 'partner'}-${i}`}
              type="button"
              onClick={() => onPartnerClick?.(p)}
              className="flex flex-col items-center gap-2 shrink-0 opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg px-2 py-1"
              title={`${p.courses || 0} courses`}
            >
              <img src={p.logo} alt={p.name} className="h-6 md:h-7 w-auto max-w-[120px] object-contain" />
              {(p.name || p.courses > 0) && (
                <span className="text-caption font-semibold text-muted-foreground whitespace-nowrap">
                  {p.name}
                  {p.name && p.courses > 0 && ' · '}
                  {p.courses > 0 && `${p.courses} courses`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
