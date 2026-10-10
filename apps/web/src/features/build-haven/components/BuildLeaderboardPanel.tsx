import { Trophy, Sparkles, TrendingUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Row = {
  rank: number;
  user_id: string;
  display_name?: string;
  github_username?: string | null;
  progress_percentage?: number;
  stages_completed?: number;
  current_stage?: number;
  updated_at?: string;
};

type Props = {
  language?: string;
  rows: Row[];
  currentUserId?: string;
  rankHint?: string;
};

export function BuildLeaderboardPanel({ language, rows, currentUserId, rankHint }: Props) {
  return (
    <aside className="hidden h-full w-[280px] shrink-0 flex-col border-l border-border/60 bg-card/20 xl:flex">
      {/* Header */}
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {(language || 'Global').toUpperCase()} Leaderboard
          </h3>
        </div>
        {rankHint && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary" />
            {rankHint}
          </p>
        )}
      </div>

      {/* Leaderboard list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-3">
          {rows.slice(0, 20).map((row) => {
            const isYou = currentUserId && row.user_id === currentUserId;
            return (
              <div
                key={`${row.user_id}-${row.rank}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors',
                  isYou
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-secondary/40'
                )}
              >
                {/* Rank */}
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    row.rank <= 3
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {row.rank}
                </span>

                {/* Avatar + name */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/60 to-primary text-[10px] font-bold text-white">
                    {(isYou ? 'U' : (row.display_name || row.user_id).charAt(0)).toUpperCase()}
                  </div>
                  <span
                    className={cn('truncate', isYou ? 'font-medium text-primary' : 'text-foreground')}
                    title={row.github_username || undefined}
                  >
                    {isYou ? 'You' : row.display_name || `${String(row.user_id).slice(0, 8)}…`}
                  </span>
                </div>

                {/* Score */}
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(Number(row.progress_percentage || 0))}%
                </span>
              </div>
            );
          })}

          {!rows.length && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                No leaderboard data yet.
                <br />
                Be the first to push!
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
