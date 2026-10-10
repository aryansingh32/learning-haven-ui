import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronRight, ClipboardList, Code2, GraduationCap } from 'lucide-react';
import { api } from '@/services/api.svc';
import { useCampusMe } from '@/hooks/useCampus';
import { cn } from '@/lib/utils';

/**
 * Content a learner's college made for its own students, shown above the search on
 * Learn, Practice and Test Series. Only that college's students get anything back from
 * these endpoints (the server checks membership), so other learners see nothing here.
 */
export interface CollegeTagInfo { id: string; name: string; slug?: string; logoUrl?: string | null; brandColor?: string | null }

export function CollegeTag({ college, className }: { college: CollegeTagInfo; className?: string }) {
  const color = college.brandColor || '#2563eb';
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14`, color }}>
      {college.logoUrl
        ? <img src={college.logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm object-contain" />
        : <GraduationCap className="h-3.5 w-3.5" aria-hidden />}
      <span className="truncate">{college.name}</span>
    </span>
  );
}

function SectionHeader({ college, icon: Icon, label }: { college: CollegeTagInfo; icon: typeof BookOpen; label: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-bold text-foreground">{label}</h2>
      <CollegeTag college={college} />
      <span className="text-xs text-muted-foreground">Only students of your college see these</span>
    </div>
  );
}

interface CollegeCourse { id: string; title: string; description: string | null; difficulty_level: string | null; chapter_count: number; enrolled: boolean }

export function FromYourCollegeCourses() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['college-courses'],
    queryFn: async () => (await api.get('/courses/college')) as unknown as { college: CollegeTagInfo; courses: CollegeCourse[] }[],
    staleTime: 60_000,
  });
  if (!data?.length) return null;
  return (
    <div className="space-y-6">
      {data.map(({ college, courses }) => (
        <section key={college.id} aria-label={`Courses from ${college.name}`}>
          <SectionHeader college={college} icon={BookOpen} label="From your college" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <button key={c.id} onClick={() => navigate(`/course/${c.id}/chapters`)}
                className="card-glass rounded-2xl border border-border/50 p-4 text-left transition hover:border-primary/40">
                <div className="mb-2"><CollegeTag college={college} /></div>
                <h3 className="font-semibold text-foreground">{c.title}</h3>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                <p className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{c.difficulty_level ?? 'course'} · {c.chapter_count} chapters</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">{c.enrolled ? 'Continue' : 'Start'}<ChevronRight className="h-3.5 w-3.5" /></span>
                </p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface CollegeProblem { id: string; slug: string; title: string; difficulty: string; topic: string; solved: boolean }

export function FromYourCollegeProblems({ search = '', difficulty = 'all' }: { search?: string; difficulty?: string }) {
  const navigate = useNavigate();
  const { colleges } = useCampusMe();
  const results = useQueries({
    queries: colleges.map((c) => ({
      queryKey: ['college-problems', c.orgId],
      queryFn: async () => ((await api.get(`/problems?college=${c.orgId}&limit=100`)) as unknown as { problems: CollegeProblem[] }).problems,
      staleTime: 60_000,
    })),
  });
  const needle = search.trim().toLowerCase();
  const sections = colleges
    .map((c, i) => ({
      college: { id: c.orgId, name: c.orgName, logoUrl: c.logoUrl, brandColor: c.brandColor } as CollegeTagInfo,
      problems: (results[i]?.data ?? []).filter((p) => (difficulty === 'all' || p.difficulty === difficulty)
        && (!needle || p.title.toLowerCase().includes(needle) || p.topic?.toLowerCase().includes(needle))),
    }))
    .filter((s) => s.problems.length > 0);
  if (!sections.length) return null;
  return (
    <div className="space-y-5">
      {sections.map(({ college, problems }) => (
        <section key={college.id} aria-label={`Practice problems from ${college.name}`}>
          <SectionHeader college={college} icon={Code2} label="Practice from your college" />
          <ul className="card-glass divide-y divide-border/40 rounded-2xl border border-border/50">
            {problems.map((p) => (
              <li key={p.id}>
                <button onClick={() => navigate(`/problems/${p.slug}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40">
                  <span className="flex min-w-0 items-center gap-2">
                    {p.solved ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Solved" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden />}
                    <span className="truncate font-medium text-foreground">{p.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">· {p.topic}</span>
                  </span>
                  <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold capitalize',
                    p.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-600' : p.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600')}>{p.difficulty}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface CollegeSeries { id: string; title: string; description: string | null; category: string | null; tests: { id: string; title: string; durationSeconds: number }[] }

export function FromYourCollegeSeries() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['college-test-series'],
    queryFn: async () => (await api.get('/test-series/college')) as unknown as { college: CollegeTagInfo; series: CollegeSeries[] }[],
    staleTime: 60_000,
  });
  if (!data?.length) return null;
  return (
    <div className="space-y-6">
      {data.map(({ college, series }) => (
        <section key={college.id} aria-label={`Test series from ${college.name}`}>
          <SectionHeader college={college} icon={ClipboardList} label="From your college" />
          <div className="grid gap-3 sm:grid-cols-2">
            {series.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2"><CollegeTag college={college} />{s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}</div>
                <h3 className="font-semibold">{s.title}</h3>
                {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                <ul className="mt-3 space-y-1.5">
                  {s.tests.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => navigate(`/test-series/tests/${t.id}`)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary/40">
                        <span>{t.title}</span><span className="text-xs text-muted-foreground">{Math.round(t.durationSeconds / 60)} min</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
