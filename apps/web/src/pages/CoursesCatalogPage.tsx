import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPhases } from '@/data/chapters';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, Briefcase, Code, LineChart, ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { HeroCarousel } from '@/components/catalog/HeroCarousel';
import { PartnerMarquee } from '@/components/catalog/PartnerMarquee';
import { PathActionCards } from '@/components/catalog/PathActionCards';
import { YourPathSection } from '@/components/catalog/YourPathSection';
import { CatalogSearch } from '@/components/catalog/CatalogSearch';
import { PremiumCourseCard } from '@/components/catalog/PremiumCourseCard';
import { TrendingLists } from '@/components/catalog/TrendingLists';
import { CareerExplorer } from '@/components/catalog/CareerExplorer';
import {
  DEFAULT_CAREERS, DEFAULT_HERO_SLIDES, DEFAULT_PARTNERS, type HeroSlide,
} from '@/components/catalog/catalog-utils';

const IconMap: Record<string, typeof Code> = {
  Briefcase, Brain, LineChart, Code,
};

function buildHeroSlides(layout: any): HeroSlide[] {
  if (layout?.sliderActive && layout?.sliderBanners?.length > 0) {
    return layout.sliderBanners.map((slide: any, i: number) => {
      const isLight = slide.bgColor?.includes('slate-100') || slide.bgColor?.includes('white');
      return {
        id: slide.id || `slide-${i}`,
        title: slide.title,
        subtitle: slide.subtitle,
        buttonText: slide.buttonText,
        buttonLink: slide.buttonLink || '/courses',
        image: slide.image,
        variant: isLight ? 'dark' : (i === 0 ? 'primary' : 'dark'),
        tags: slide.tags,
        stat: slide.stat,
      } as HeroSlide;
    });
  }
  return [];
}

function buildPartners(layout: any) {
  const partners = layout?.sections?.universities?.partners;
  if (partners && Array.isArray(partners) && partners.length > 0) return partners;
  return [];
}

function buildCareers(layout: any) {
  const items = layout?.sections?.careers?.items;
  if (!items?.length) return [];
  return items.map((c: any, i: number) => ({
    id: c.id || `career-${i}`,
    title: c.title,
    salary: c.salary,
    jobs: c.jobs,
    skills: c.skills,
    image: c.image,
    description: c.description,
  }));
}

export default function CoursesCatalogPage() {
  const [query, setQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: layout, isLoading: isLayoutLoading } = useCatalogSettings();
  const { data: phases, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['learn-phases'],
    queryFn: async () => {
      const courses = await fetchPhases();
      return Array.isArray(courses) ? courses : [];
    },
    staleTime: 60_000,
  });

  const courses = useMemo(() => {
    let list = (phases || []) as any[];
    const q = (query || '').toLowerCase().trim();
    if (q) {
      list = list.filter((item) =>
        `${item.title} ${item.description || ''} ${item.slug || ''}`.toLowerCase().includes(q)
      );
    }
    if (partnerFilter) {
      list = list.filter((_, i) =>
        DEFAULT_PARTNERS[i % DEFAULT_PARTNERS.length].name === partnerFilter
      );
    }
    return list;
  }, [phases, query, partnerFilter]);

  const heroSlides = useMemo(() => buildHeroSlides(layout), [layout]);
  const partners = useMemo(() => buildPartners(layout), [layout]);
  const careers = useMemo(() => buildCareers(layout), [layout]);

  const goToCourse = (id: string) => navigate(`/course/${id}/chapters`);

  if (isLayoutLoading || isCoursesLoading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-[280px] w-full rounded-none md:rounded-2xl md:max-w-7xl md:mx-auto" />
        <Skeleton className="h-16 w-full" />
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const allCourses = (phases || []) as any[];
  const categories = layout?.sections?.categories;
  const jobReady = layout?.sections?.jobReady;
  const newAndPopular = layout?.sections?.newAndPopular;
  const trendingColumns = newAndPopular?.columns?.length
    ? newAndPopular.columns
    : [
        { id: 'popular', title: 'Most popular' },
        { id: 'hot', title: 'Hot new releases' },
        { id: 'trending', title: 'Trending now' },
      ];

  return (
    <div className="pb-20 md:pb-8">
      {/* 1. Hero — transformation slides, always high contrast */}
      {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

      {/* 2. Partner marquee — dense trust strip */}
      <PartnerMarquee
        title={layout?.sections?.universities?.text || 'Learn from courses inspired by industry leaders'}
        partners={partners}
        onPartnerClick={(p) => {
          setPartnerFilter(partnerFilter === p.name ? null : p.name);
          setQuery('');
        }}
      />
      {partnerFilter && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-2 mb-2">
          <p className="text-meta text-muted-foreground">
            Showing courses from <strong className="text-foreground">{partnerFilter}</strong>
            <button type="button" className="ml-2 text-primary font-semibold" onClick={() => setPartnerFilter(null)}>Clear</button>
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8 md:space-y-10">
        {/* 2.5 Your Path Section */}
        <YourPathSection />

        {/* 3. Career path action cards */}
        <PathActionCards />

        {/* 4. Search + trending */}
        <CatalogSearch query={query} onQueryChange={(q) => { setQuery(q); setPartnerFilter(null); }} />

        {query || partnerFilter ? (
          <section className="space-y-4">
            <h2 className="font-display text-section-title font-bold">
              {courses.length} result{courses.length !== 1 ? 's' : ''}
            </h2>
            {courses.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center">No courses match. Try a trending topic above.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                {courses.map((course, i) => (
                  <PremiumCourseCard key={course.id} course={course} index={i} onClick={() => goToCourse(course.id)} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* 5. Categories — compact tags */}
            {categories?.active !== false && (
              <section className="space-y-3">
                <h2 className="font-display text-section-title font-bold">
                  {categories?.title || 'Explore categories'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(categories?.items || [
                    { name: 'Computer Science', icon: 'Code' },
                    { name: 'Data Science', icon: 'LineChart' },
                    { name: 'Artificial Intelligence', icon: 'Brain' },
                    { name: 'Business', icon: 'Briefcase' },
                  ]).map((cat: any, i: number) => {
                    const Icon = IconMap[cat.icon] || Code;
                    return (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="rounded-full h-9 px-4 font-medium hover:bg-primary/5 hover:border-primary/30"
                        onClick={() => setQuery(cat.name || cat.title)}
                      >
                        <Icon className="w-3.5 h-3.5 mr-1.5 text-primary" />
                        {cat.name || cat.title}
                      </Button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 6. Get job ready — horizontal premium carousel, tight padding */}
            {jobReady?.active !== false && allCourses.length > 0 && (
              <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-4 md:p-6 space-y-4">
                <div>
                  <h2 className="font-display text-section-title font-bold">
                    {jobReady?.title || 'Get job-ready for an in-demand career'}
                  </h2>
                  <p className="text-meta text-muted-foreground mt-1">
                    {jobReady?.subtitle || 'Professional certificates with real projects and interview prep.'}
                  </p>
                </div>
                <Tabs defaultValue={jobReady?.tabs?.[0]?.id || 'all'} className="w-full">
                  <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 mb-4 overflow-x-auto gap-0">
                    {(jobReady?.tabs?.length ? jobReady.tabs : [{ id: 'all', label: 'All Paths' }]).map((tab: any) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-meta font-semibold"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {(jobReady?.tabs?.length ? jobReady.tabs : [{ id: 'all', label: 'All' }]).map((tab: any) => (
                    <TabsContent key={tab.id} value={tab.id} className="outline-none mt-0">
                      <div className="flex gap-4 overflow-x-auto pb-2 snap-x -mx-1 px-1">
                        {allCourses.slice(0, 8).map((course, i) => (
                          <PremiumCourseCard key={course.id} course={course} index={i} onClick={() => goToCourse(course.id)} />
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </section>
            )}

            {/* 7. New & popular — Coursera-style compact 3-column lists */}
            {newAndPopular?.active !== false && allCourses.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-display text-section-title font-bold">
                  {newAndPopular?.title || 'New and popular'}
                </h2>
                <TrendingLists
                  columns={trendingColumns}
                  courses={allCourses}
                  onCourseClick={goToCourse}
                />
              </section>
            )}

            {/* 8. All learning paths — Netflix-style row */}
            {allCourses.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-section-title font-bold">All learning paths</h2>
                  <span className="text-meta text-muted-foreground">{allCourses.length} paths</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {allCourses.map((course, i) => (
                    <PremiumCourseCard key={course.id} course={course} index={i} onClick={() => goToCourse(course.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* 9. Career explorer — 6+ cards */}
            {layout?.sections?.careers?.active !== false && (
              <CareerExplorer
                title={layout?.sections?.careers?.title || 'Explore careers'}
                careers={careers}
                onCareerClick={(c) => setQuery(c.title.split(' ')[0])}
              />
            )}

            {/* 10. AI recommended CTA strip */}
            <section className="rounded-2xl bg-gradient-to-r from-[#020817] via-[#071126] to-[#0B1730] border border-primary/20 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-section-title font-bold text-white">AI-recommended for you</h2>
                <p className="text-meta text-white/70 mt-1 max-w-lg">
                  Based on your progress, your mentor suggests starting with structured paths and daily missions.
                </p>
              </div>
              <Button
                className="bg-reward hover:bg-reward/90 text-reward-foreground font-bold shrink-0"
                onClick={() => navigate('/ai-coach')}
              >
                Get Recommendations <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
