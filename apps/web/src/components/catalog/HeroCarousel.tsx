import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import type { HeroSlide } from './catalog-utils';

const VARIANT_STYLES: Record<HeroSlide['variant'], string> = {
  primary: 'from-primary/95 via-primary/80 to-primary/40 dark:from-primary dark:via-primary/60 dark:to-background',
  dark: 'from-slate-900 via-slate-800 to-primary/50 dark:from-slate-950 dark:via-slate-900 dark:to-primary/20',
  accent: 'from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-950 dark:via-purple-900/80 dark:to-pink-900/30',
};

type Props = { slides: HeroSlide[] };

export function HeroCarousel({ slides }: Props) {
  const navigate = useNavigate();
  const autoplay = useMemo(() => Autoplay({ delay: 6500, stopOnInteraction: true }), []);
  const multiple = slides.length > 1;

  return (
    <section className="w-full mb-6 md:mb-8">
      <Carousel plugins={multiple ? [autoplay] : []} className="w-full relative" opts={{ loop: multiple }}>
        <CarouselContent className="-ml-0">
          {slides.map((slide, index) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div
                className={cn(
                  'relative w-full overflow-hidden rounded-none md:rounded-3xl md:mx-auto md:max-w-7xl',
                  'border border-border/40 shadow-[var(--shadow-card-hover)]',
                  !slide.backgroundImage && 'bg-gradient-to-br',
                  !slide.backgroundImage && (VARIANT_STYLES[slide.variant] || VARIANT_STYLES.primary)
                )}
                style={
                  slide.backgroundImage 
                    ? { backgroundImage: `url(${slide.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
                    : undefined
                }
              >
                {slide.backgroundImage && (
                  <div className="absolute inset-0 bg-black/40 md:bg-gradient-to-r md:from-black/90 md:to-black/30 z-0" />
                )}
                {!slide.backgroundImage && (
                  <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px] z-0" aria-hidden />
                )}
                <div className="relative z-10 px-5 md:px-10 py-8 md:py-12 grid md:grid-cols-[1fr_300px] gap-8 items-center min-h-[240px] md:min-h-[300px]">
                  <div className="text-white space-y-3.5 z-10">
                    <h1 className="font-display text-2xl md:text-4xl font-bold leading-tight max-w-2xl drop-shadow-md">{slide.title}</h1>
                    <p className="text-body text-white/90 max-w-xl drop-shadow-sm">{slide.subtitle}</p>
                    {slide.tags && slide.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {slide.tags.map((tag) => (
                          <span key={tag} className="text-caption font-semibold px-2.5 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {slide.stat && <p className="text-meta font-semibold text-white/95 drop-shadow-sm">{slide.stat}</p>}
                    <Button
                      size="lg"
                      className="mt-2 bg-white text-black hover:bg-white/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 font-bold rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] dark:shadow-[0_4px_14px_0_rgba(var(--primary),0.3)] transition-all"
                      onClick={() => navigate(slide.buttonLink)}
                    >
                      {slide.buttonText} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                  {slide.image && (
                    <div className="hidden md:block relative h-[220px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 dark:shadow-[0_0_40px_rgba(255,255,255,0.08)] z-10">
                      <img
                        src={slide.image}
                        alt=""
                        aria-hidden
                        width={300}
                        height={220}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        decoding="async"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {multiple && (
          <div className="absolute bottom-4 right-6 md:right-12 flex gap-2 z-20">
            <CarouselPrevious className="static translate-y-0 h-10 w-10 bg-black/20 hover:bg-black/40 dark:bg-white/10 dark:hover:bg-white/20 border-0 text-white rounded-full backdrop-blur-sm transition-all" />
            <CarouselNext className="static translate-y-0 h-10 w-10 bg-black/20 hover:bg-black/40 dark:bg-white/10 dark:hover:bg-white/20 border-0 text-white rounded-full backdrop-blur-sm transition-all" />
          </div>
        )}
      </Carousel>
    </section>
  );
}
