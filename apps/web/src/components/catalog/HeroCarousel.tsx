import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import type { HeroSlide } from './catalog-utils';

const VARIANT_STYLES: Record<HeroSlide['variant'], string> = {
  primary: 'from-primary via-primary/85 to-primary/60',
  dark: 'from-foreground via-foreground/95 to-primary/70',
  accent: 'from-primary/90 via-primary/70 to-reward/70',
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
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div
                className={cn(
                  'relative w-full overflow-hidden rounded-none md:rounded-3xl md:mx-auto md:max-w-7xl',
                  'bg-gradient-to-br border border-border/40 shadow-[var(--shadow-card-hover)]',
                  VARIANT_STYLES[slide.variant] || VARIANT_STYLES.primary
                )}
              >
                <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" aria-hidden />
                <div className="relative px-5 md:px-10 py-8 md:py-12 grid md:grid-cols-[1fr_300px] gap-8 items-center min-h-[240px] md:min-h-[300px]">
                  <div className="text-primary-foreground space-y-3.5 z-10">
                    <h1 className="font-display text-2xl md:text-4xl font-bold leading-tight max-w-2xl">{slide.title}</h1>
                    <p className="text-body text-primary-foreground/85 max-w-xl">{slide.subtitle}</p>
                    {slide.tags && slide.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {slide.tags.map((tag) => (
                          <span key={tag} className="text-caption font-semibold px-2.5 py-1 rounded-full bg-primary-foreground/15 border border-primary-foreground/25">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {slide.stat && <p className="text-meta font-semibold text-reward-foreground/90">{slide.stat}</p>}
                    <Button
                      size="lg"
                      className="mt-2 bg-card text-primary hover:bg-card/90 font-bold rounded-xl shadow-lg"
                      onClick={() => navigate(slide.buttonLink)}
                    >
                      {slide.buttonText} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                  {slide.image && (
                    <div className="hidden md:block relative h-[220px] rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/15">
                      <img src={slide.image} alt="" aria-hidden className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {multiple && (
          <div className="absolute bottom-4 right-6 md:right-12 flex gap-2 z-20">
            <CarouselPrevious className="static translate-y-0 h-10 w-10 bg-primary-foreground/20 hover:bg-primary-foreground/35 border-0 text-primary-foreground rounded-full" />
            <CarouselNext className="static translate-y-0 h-10 w-10 bg-primary-foreground/20 hover:bg-primary-foreground/35 border-0 text-primary-foreground rounded-full" />
          </div>
        )}
      </Carousel>
    </section>
  );
}
