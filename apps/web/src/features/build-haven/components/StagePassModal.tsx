import { useState } from 'react';
import { Trophy, CheckCircle2, Code2, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageTitle?: string;
  stageNumber?: number;
  newRank?: number | null;
  previousRank?: number | null;
  onRefactor: () => void;
  onMarkComplete: () => void;
};

/**
 * Two-step completion modal matching CodeCrafters' dopamine loop:
 * Phase 1 — "Tests Passed!" with refactor/mark-complete options
 * Phase 2 — "Stage Complete!" with rank display + confetti trigger
 */
export function StagePassModal({
  open,
  onOpenChange,
  stageTitle,
  stageNumber,
  newRank,
  previousRank,
  onRefactor,
  onMarkComplete,
}: Props) {
  const [phase, setPhase] = useState<1 | 2>(1);

  const handleMarkComplete = () => {
    setPhase(2);
    onMarkComplete();
  };

  const handleClose = () => {
    setPhase(1);
    onOpenChange(false);
  };

  const handleRefactor = () => {
    setPhase(1);
    onOpenChange(false);
    onRefactor();
  };

  const handleViewNext = () => {
    handleClose();
  };

  const rankJump =
    previousRank && newRank && previousRank > newRank
      ? previousRank - newRank
      : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'sm:max-w-md border-border/50 bg-card/95 backdrop-blur-xl p-0 overflow-hidden',
          'shadow-2xl shadow-primary/5'
        )}
      >
        {phase === 1 ? (
          /* ── Phase 1: Tests Passed ─────────────────────────── */
          <div className="px-6 py-8 text-center space-y-6">
            {/* Success icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 ring-4 ring-success/20">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Tests passed!
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                You can now mark this stage as complete.
              </p>
            </div>

            {/* Two action buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRefactor}
                className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Code2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Refactor code{' '}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edit your code before moving to the next stage
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </button>

              <button
                type="button"
                onClick={handleMarkComplete}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-success/30 bg-success/5 px-4 py-3.5 text-left transition-all hover:border-success/50 hover:bg-success/10 group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Mark stage as complete
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submit code and proceed to the next stage
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-success/50 group-hover:text-success transition-colors" />
              </button>
            </div>
          </div>
        ) : (
          /* ── Phase 2: Stage Complete ───────────────────────── */
          <div className="px-6 py-8 text-center space-y-6">
            {/* Trophy icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
              <Trophy className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Stage complete!
              </DialogTitle>
              {stageTitle && (
                <p className="text-sm text-muted-foreground">
                  {stageTitle}
                </p>
              )}
            </div>

            {/* Rank display */}
            {newRank && (
              <div className="space-y-2 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your leaderboard rank is
                </p>
                <p className="font-display text-4xl font-extrabold text-primary tabular-nums">
                  #{newRank.toLocaleString()}
                </p>
                {rankJump && rankJump > 0 && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-success">
                    <Sparkles className="h-3 w-3" />
                    Jumped {rankJump.toLocaleString()} places!
                  </p>
                )}
                {/* Decorative dashes */}
                <div className="flex items-center justify-center gap-1 pt-1">
                  <span className="h-px w-8 bg-primary/20" />
                  <span className="h-px w-6 bg-primary/15" />
                  <span className="h-px w-4 bg-primary/10" />
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              className="w-full gradient-golden text-primary-foreground shadow-lg shadow-primary/15"
              size="lg"
              onClick={handleViewNext}
            >
              View next stage
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
