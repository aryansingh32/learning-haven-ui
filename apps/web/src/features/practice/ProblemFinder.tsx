import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { findProblems } from './practice.service';

const DIFF: Record<string, string> = {
  easy: 'bg-success/15 text-success border border-success/20',
  medium: 'bg-primary/15 text-primary border border-primary/20',
  hard: 'bg-destructive/15 text-destructive border border-destructive/20',
};

/** Problems matching a title search, company and difficulty — shown above the topic tracks while any filter is set. */
export function ProblemFinder({ search, company, difficulty }: { search: string; company: string; difficulty: string }) {
  const navigate = useNavigate();
  const filters = { search: search.trim() || undefined, company: company || undefined, difficulty: difficulty === 'all' ? undefined : difficulty };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['problem-finder', filters],
    queryFn: () => findProblems(filters),
    placeholderData: (prev) => prev,
  });
  const list = data?.problems ?? [];
  const label = [filters.search && `“${filters.search}”`, filters.company, filters.difficulty].filter(Boolean).join(' · ');

  return (
    <section aria-label="Matching problems" className="card-glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
        <p className="text-sm font-semibold text-foreground">Problems <span className="text-muted-foreground font-normal">· {label}</span></p>
        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{isLoading ? '…' : `${data?.pagination.total ?? 0} found`}</span>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : isError ? (
        <p className="p-6 text-sm text-muted-foreground">Couldn't search problems right now.</p>
      ) : list.length === 0 ? (
        <div className="p-8 text-center">
          <SearchX className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-40" aria-hidden />
          <p className="text-sm text-muted-foreground">No problems match. Try a shorter search or another company.</p>
        </div>
      ) : (
        <ul>
          {list.map((p) => (
            <li key={p.id} className="border-t border-border/20 first:border-t-0">
              <button
                onClick={() => navigate(`/problems/${p.slug}`)}
                className="w-full grid grid-cols-12 gap-2 px-5 py-3 items-center text-left hover:bg-secondary/15 transition-colors"
              >
                <span className="col-span-1">
                  {p.status === 'solved'
                    ? <Check className="h-4 w-4 text-success" aria-label="Solved" />
                    : <span className="block h-4 w-4 rounded border-2 border-border" aria-hidden />}
                </span>
                <span className="col-span-11 sm:col-span-6 min-w-0">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <span className="truncate">{p.title}</span>
                    {p.is_premium && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Forge Pro" />}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{p.topic}</span>
                </span>
                <span className="hidden sm:flex col-span-3 flex-wrap gap-1">
                  {(p.companies ?? []).slice(0, 3).map((c) => (
                    <span key={c} className={cn('text-[10px] px-1.5 py-0.5 rounded', c === filters.company ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground')}>{c}</span>
                  ))}
                </span>
                <span className="hidden sm:block col-span-2 text-right">
                  <span className={cn('text-[10px] px-2.5 py-1 rounded-lg font-semibold capitalize', DIFF[p.difficulty])}>{p.difficulty}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
