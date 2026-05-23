import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { difficultyTone, normalizeDifficulty } from './utils';

const toneClass: Record<ReturnType<typeof difficultyTone>, string> = {
  easy: 'border-success/40 bg-success/10 text-success',
  medium: 'border-primary/40 bg-primary/10 text-primary',
  hard: 'border-destructive/40 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-secondary/60 text-muted-foreground',
};

export function BuildDifficultyBadge({
  difficulty,
  className,
}: {
  difficulty?: string | null;
  className?: string;
}) {
  if (!difficulty) return null;
  const tone = difficultyTone(difficulty);
  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize', toneClass[tone], className)}>
      {normalizeDifficulty(difficulty)}
    </Badge>
  );
}
