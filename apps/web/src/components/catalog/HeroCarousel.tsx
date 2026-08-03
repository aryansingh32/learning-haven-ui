import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Autoplay from 'embla-carousel-autoplay';
import type { HeroSlide } from './catalog-utils';

const VARIANT_STYLES: Record<HeroSlide['variant'], string> = {
  primary: 'from-[#1d4ed8] via-[#2563eb] to-[#1e40af]',
  dark: 'from-[#020817] via-[#071126] to-[#0B1730]',
  accent: 'from-[#0f172a] via-[#1e3a5f] to-[#2563eb]',
};

type Props = {
  slides: HeroSlide[];
};

export function HeroCarousel({ slides }: Props) {
  const navigate = useNavigate();
  const autoplay = useMemo(() => Autoplay({ delay: 6000, stopOnInteraction: true }), []);

  return (
    <section className="w-full mb-6">
      <Carousel plugins={[autoplay]} className="w-full relative" opts={{ loop: true }}>
        <CarouselContent className="-ml-0">
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div
                className={cn(
                  'relative w-full overflow-hidden rounded-none md:rounded-2xl md:mx-auto md:max-w-7xl',
                  'bg-gradient-to-br border border-white/10 shadow-xl',
                  VARIANT_STYLES[slide.variant] || VARIANT_STYLES.dark
                )}
              >
                <div className="px-4 md:px-8 py-6 md:py-8 grid md:grid-cols-[1fr_280px] gap-6 items-center min-h-[240px] md:min-h-[280px]">
                  <div className="text-white space-y-3 z-10">
                    <h1 className="font-display text-2xl md:text-4xl font-bold leading-tight">{slide.title}</h1>
                    <p className="text-body text-white/85 max-w-lg">{slide.subtitle}</p>
                    {slide.tags && slide.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {slide.tags.map((tag) => (
                          <span key={tag} className="text-caption font-semibold px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {slide.stat && (
                      <p className="text-meta font-semibold text-reward">{slide.stat}</p>
                    )}
                    <Button
                      size="lg"
                      className="mt-2 bg-white text-primary hover:bg-white/90 font-bold rounded-xl shadow-lg"
                      onClick={() => navigate(slide.buttonLink)}
                    >
                      {slide.buttonText} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                  <div className="hidden md:block relative h-[220px] rounded-2xl overflow-hidden shadow-2xl border border-white/15">
                    <img
                      src={slide.image}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="absolute bottom-4 right-6 md:right-10 flex gap-2 z-20">
          <CarouselPrevious className="static translate-y-0 h-10 w-10 bg-white/20 hover:bg-white/35 border-0 text-white rounded-full" />
          <CarouselNext className="static translate-y-0 h-10 w-10 bg-white/20 hover:bg-white/35 border-0 text-white rounded-full" />
        </div>
      </Carousel>
    </section>
  );
}
