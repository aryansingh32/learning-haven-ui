import { cn } from '@/lib/utils';

type Lang = { language: string; starter_repo_url?: string };

export function BuildLanguageGrid({
  languages,
  selected,
  onSelect,
}: {
  languages: Lang[];
  selected: string;
  onSelect: (lang: string) => void;
}) {
  if (!languages.length) {
    return <p className="text-sm text-muted-foreground">No languages configured yet — admins can add starters in the panel.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {languages.map((item) => {
        const active = selected === item.language;
        return (
          <button
            key={item.language}
            type="button"
            onClick={() => onSelect(item.language)}
            className={cn(
              'rounded-2xl border p-5 text-left transition-all',
              active
                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/30'
                : 'border-border/60 bg-card/80 hover:border-primary/40 hover:shadow-sm'
            )}
          >
            <div className="font-display text-lg font-semibold capitalize text-foreground">{item.language}</div>
            {item.starter_repo_url ? (
              <p className="mt-2 line-clamp-2 font-mono text-[10px] text-muted-foreground">{item.starter_repo_url}</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
