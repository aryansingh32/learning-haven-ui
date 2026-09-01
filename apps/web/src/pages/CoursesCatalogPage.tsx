import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPhases } from '@/data/chapters';
import { api } from '@/services/api.svc';
import { useCatalogSettings } from '@/hooks/useCatalogSettings';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowRight, BookOpen, Compass, GraduationCap, Layers, Sparkles } from 'lucide-react';
import { HeroCarousel } from '@/components/catalog/HeroCarousel';
import { PartnerMarquee } from '@/components/catalog/PartnerMarquee';
import { YourPathSection } from '@/components/catalog/YourPathSection';
import { CatalogSearch } from '@/components/catalog/CatalogSearch';
import { PremiumCourseCard } from '@/components/catalog/PremiumCourseCard';
import { TrendingLists } from '@/components/catalog/TrendingLists';
import { CareerExplorer } from '@/components/catalog/CareerExplorer';
import { EnrolledPaths } from '@/components/catalog/EnrolledPaths';
import { AIRecommendations } from '@/components/catalog/AIRecommendations';
import { fetchMyCourseEnrollments } from '@/data/chapters';
import { chapterCount, derivedTopics, type CatalogCourse, type HeroSlide } from '@/components/catalog/catalog-utils';
import { CourseCheckoutModal } from '@/components/CourseCheckoutModal';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'free' | 'premium';

function buildHeroSlides(layout: any, courses: CatalogCourse[]): HeroSlide[] {
  if (layout?.sliderActive && Array.isArray(layout?.sliderBanners) && layout.sliderBanners.length > 0) {
    return layout.sliderBanners.map((slide: any, i: number) => ({
      id: slide.id || `slide-${i}`,
      title: slide.title,
      subtitle: slide.subtitle,
      buttonText: slide.buttonText || 'Explore courses',
      buttonLink: slide.buttonLink || '/courses',
      image: slide.image,
      backgroundImage: slide.backgroundImage,
      variant: i === 0 ? 'primary' : i % 2 === 0 ? 'accent' : 'dark',
      tags: slide.tags,
      stat: slide.stat,
    })) as HeroSlide[];
  }

  if (!courses.length) return [];
  const totalChapters = courses.reduce((sum, c) => sum + chapterCount(c), 0);
  return [
    {
      id: 'catalog',
      title: 'Learn the skills that get you hired',
      subtitle: 'Structured learning paths with guided chapters, hands-on practice and AI feedback at every step.',
      tags: courses.slice(0, 4).map((c) => c.title),
      stat: `${courses.length} learning path${courses.length === 1 ? '' : 's'}${totalChapters ? ` · ${totalChapters} chapters` : ''}`,
      buttonText: 'Browse paths',
      buttonLink: '/courses',
      variant: 'primary',
    },
  ];
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All paths' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'free', label: 'Free' },
  { id: 'premium', label: 'Premium' },
];

function StatPill({ icon: Icon, value, label }: { icon: typeof BookOpen; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-card-title font-bold leading-none">{value}</p>
        <p className="text-caption text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

export default function CoursesCatalogPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const [checkoutCourse, setCheckoutCourse] = useState<CatalogCourse | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: layout } = useCatalogSettings();
  const {
    data: phases, isLoading: isCoursesLoading, isError, refetch,
  } = useQuery({
    queryKey: ['learn-phases'],
    queryFn: async () => {
      const courses = await fetchPhases();
      if (!Array.isArray(courses)) return [];
      return (courses as CatalogCourse[]).filter(c => chapterCount(c) > 0);
    },
    staleTime: 60_000,
  });

  const { data: enrollmentsData } = useQuery({
    queryKey: ['my-course-enrollments'],
    queryFn: async () => {
      try {
        const res: any = await fetchMyCourseEnrollments();
        return res?.enrollments || [];
      } catch (e) {
        return [];
      }
    },
  });

  const enrollments = enrollmentsData || [];

  const allCourses = useMemo(() => (phases || []) as CatalogCourse[], [phases]);

  const visibleCourses = useMemo(() => {
    let list = allCourses;
    const q = query.toLowerCase().trim();
    if (q) {
      const fuse = new Fuse(list, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'description', weight: 2 },
          { name: 'difficulty_level', weight: 1 },
          { name: 'slug', weight: 1 }
        ],
        threshold: 0.4,
      });
      list = fuse.search(q).map(res => res.item);
    }
    if (filter === 'free') list = list.filter((c) => !c.is_premium);
    else if (filter === 'premium') list = list.filter((c) => c.is_premium);
    else if (filter !== 'all') list = list.filter((c) => (c.difficulty_level || '').toLowerCase() === filter);
    return list;
  }, [allCourses, query, filter]);

  const heroSlides = useMemo(() => buildHeroSlides(layout, allCourses), [layout, allCourses]);
  const partners = useMemo(() => {
    const raw = layout?.sections?.universities?.partners;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    const logos = layout?.sections?.universities?.logos;
    if (Array.isArray(logos) && logos.length > 0) {
      return logos.map((logo: string, i: number) => ({ name: `Partner ${i+1}`, logo, courses: 10 }));
    }
    return [];
  }, [layout]);
  const careers = useMemo(
    () =>
      (Array.isArray(layout?.sections?.careers?.items) ? layout.sections.careers.items : []).map(
        (c: any, i: number) => ({
          id: c.id || `career-${i}`,
          title: c.title,
          salary: c.salary,
          jobs: c.jobs,
          skills: c.skills,
          image: c.image,
          description: c.description,
        })
      ),
    [layout]
  );
  const topics = useMemo(() => derivedTopics(allCourses), [allCourses]);
  const totalChapters = useMemo(
    () => allCourses.reduce((sum, c) => sum + chapterCount(c), 0),
    [allCourses]
  );
  const isFiltering = Boolean(query.trim()) || filter !== 'all';
  const shouldPaginate = !showAll && !isFiltering;
  const displayedCourses = shouldPaginate ? visibleCourses.slice(0, 12) : visibleCourses;

  const aiRecommendations = useMemo(() => {
    if (enrollments.length < 3 || allCourses.length === 0) return [];
    const enrolledCourseIds = new Set(enrollments.map((e: any) => e.course_id));
    return allCourses.filter(c => !enrolledCourseIds.has(c.id)).slice(0, 4);
  }, [allCourses, enrollments]);
  // BH-010 (updated): Three-way branch for course navigation:
  // 1. Free / entitled user                    → navigate to course chapters
  // 2. Individually purchasable with price      → open per-course checkout modal
  // 3. Premium plan-gated only                  → navigate to subscription page with course context
  const goToCourse = (id: string) => {
    const course = allCourses.find((c) => c.id === id);
    const isEnrolled = enrollments.some((e: any) => e.course_id === id);

    if (!course || !course.is_premium || isEnrolled) {
      navigate(`/course/${id}/chapters`);
    } else if (course.is_individually_purchasable && course.price) {
      setCheckoutCourse(course);
    } else {
      navigate(`/subscription?course_id=${id}&ref=catalog`);
    }
  };

  if (isCoursesLoading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-[260px] w-full rounded-none md:rounded-3xl md:max-w-7xl md:mx-auto" />
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-10">
      {/* Per-course checkout modal */}
      {checkoutCourse && (
        <CourseCheckoutModal
          open={Boolean(checkoutCourse)}
          onClose={() => setCheckoutCourse(null)}
          course={{
            id: checkoutCourse.id,
            title: checkoutCourse.title,
            description: checkoutCourse.description,
            price: checkoutCourse.price!,
            currency: checkoutCourse.currency,
          }}
        />
      )}

      {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

      {Array.isArray(partners) && partners.length > 0 && (
        <PartnerMarquee
          title={layout?.sections?.universities?.text}
          partners={partners}
          onPartnerClick={(p) => {
            if (p.name) {
              setQuery(p.name);
              setShowAll(true);
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8 md:space-y-12">
        {/* Catalog stats — derived from live data */}
        {allCourses.length > 0 && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatPill icon={Layers} value={allCourses.length} label="Learning paths" />
            <StatPill icon={BookOpen} value={totalChapters} label="Guided chapters" />
            <StatPill
              icon={GraduationCap}
              value={allCourses.filter((c) => !c.is_premium).length}
              label="Free to start"
            />
            <StatPill
              icon={Sparkles}
              value={allCourses.filter((c) => c.is_premium).length}
              label="Premium paths"
            />
          </section>
        )}

        {enrollments.length > 0 ? (
          <EnrolledPaths enrollments={enrollments} />
        ) : (
          <YourPathSection />
        )}

        {/* Search + filters */}
        <section className="space-y-4">
          <CatalogSearch query={query} onQueryChange={setQuery} topics={topics} />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter courses">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'h-9 px-4 rounded-full text-meta font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  filter === f.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-[var(--shadow-card)]'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* Error state */}
        {isError && (
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
            <h2 className="font-display text-section-title font-bold">We couldn't load the catalog</h2>
            <p className="text-meta text-muted-foreground">Check your connection and try again.</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </section>
        )}

        {/* Course grid */}
        {!isError && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-section-title font-bold">
                  {isFiltering ? 'Search results' : layout?.sections?.jobReady?.title || 'Explore learning paths'}
                </h2>
                <p className="text-meta text-muted-foreground mt-0.5">
                  {isFiltering
                    ? `${visibleCourses.length} path${visibleCourses.length === 1 ? '' : 's'} found`
                    : layout?.sections?.jobReady?.subtitle || 'Guided, chapter-by-chapter paths built for real interviews.'}
                </p>
              </div>
              {isFiltering && (
                <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>
                  Clear filters
                </Button>
              )}
            </div>

            {visibleCourses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
                <Compass className="w-8 h-8 mx-auto text-muted-foreground" />
                <h3 className="font-display text-card-title font-bold">
                  {allCourses.length === 0 ? 'No courses published yet' : 'No paths match your filters'}
                </h3>
                <p className="text-meta text-muted-foreground">
                  {allCourses.length === 0
                    ? 'New learning paths appear here as soon as they are published.'
                    : 'Try a different keyword or clear the filters.'}
                </p>
                {allCourses.length > 0 && (
                  <Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>
                    Show all paths
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {displayedCourses.map((course, i) => (
                    <PremiumCourseCard
                      key={course.id}
                      course={course}
                      index={i}
                      onClick={() => goToCourse(course.id)}
                      className="min-w-0 max-w-none"
                      isEnrolled={enrollments.some((e: any) => e.course_id === course.id)}
                    />
                  ))}
                </div>
                {shouldPaginate && visibleCourses.length > 12 && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" size="lg" className="rounded-full px-8 font-bold border-border hover:border-primary hover:text-primary transition-colors bg-card shadow-[var(--shadow-card)]" onClick={() => setShowAll(true)}>
                      Explore all paths <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Trending */}
        {!isFiltering && allCourses.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-display text-section-title font-bold">
              {layout?.sections?.newAndPopular?.title || 'New and popular'}
            </h2>
            <TrendingLists
              columns={
                layout?.sections?.newAndPopular?.columns?.length
                  ? layout.sections.newAndPopular.columns
                  : [
                      { id: 'popular', title: 'Most popular' },
                      { id: 'new', title: 'Recently added' },
                      { id: 'advanced', title: 'Level up' },
                    ]
              }
              courses={allCourses}
              onCourseClick={goToCourse}
              enrollments={enrollments}
            />
          </section>
        )}

        {/* CMS-managed careers */}
        {careers.length > 0 && layout?.sections?.careers?.active !== false && (
          <CareerExplorer
            title={layout?.sections?.careers?.title || 'Explore careers'}
            careers={careers}
            onCareerClick={(c) => {
              setQuery(c.title.split(' ')[0]);
              setShowAll(true);
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }}
            onExploreAllClick={() => {
              setShowAll(true);
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }}
          />
        )}

        {aiRecommendations.length > 0 && (
          <AIRecommendations recommendations={aiRecommendations} />
        )}

        {/* AI coach CTA */}
        <section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-reward/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="font-display text-section-title font-bold text-foreground">Not sure where to start?</h2>
            <p className="text-meta text-muted-foreground mt-1 max-w-lg">
              Your AI coach reviews your progress and recommends the next path, chapter and practice set.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0"
            onClick={() => navigate('/ai-coach')}
          >
            Get recommendations <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </section>
      </div>
    </div>
  );
}
