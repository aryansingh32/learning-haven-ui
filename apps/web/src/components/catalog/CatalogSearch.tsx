import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  topics?: string[];
};

export function CatalogSearch({ query, onQueryChange, topics = [] }: Props) {
  return (
    <section className="space-y-3">
      <div className="relative bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] overflow-hidden focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search courses, skills, or career paths..."
          aria-label="Search courses"
          className="pl-12 pr-12 py-6 text-body border-0 shadow-none focus-visible:ring-0 h-auto bg-transparent"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta font-semibold text-muted-foreground">Popular:</span>
          {topics.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onQueryChange(term)}
              className="text-meta font-medium px-3 py-1 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
