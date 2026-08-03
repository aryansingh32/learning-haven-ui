import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDot, Lock, Settings2, BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { stageStatus, type StageProgressStatus } from './utils';
import { useState } from 'react';

type Stage = {
  id: string;
  stage_number: number;
  title: string;
};

type Props = {
  slug: string;
  challengeTitle: string;
  language?: string;
  stages: Stage[];
  enrollment?: { current_stage: number; completed_stages?: number[] } | null;
  activeView: 'setup' | number;
  onSelectSetup: () => void;
  onSelectStage: (stageNumber: number) => void;
};

function StatusIcon({ status }: { status: StageProgressStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === 'in_progress') return <CircleDot className="h-4 w-4 text-primary" />;
  if (status === 'locked') return <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />;
  return <span className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground/50">○</span>;
}

export function BuildStageSidebar({
  slug,
  challengeTitle,
  language,
  stages,
  enrollment,
  activeView,
  onSelectSetup,
  onSelectStage,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Group stages by section (using simple grouping: every 3-4 stages)
  // In CodeCrafters these are grouped by feature area — we'll use stage titles
  const completedCount = enrollment?.completed_stages?.length || 0;
  const totalCount = stages.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col border-r border-border/60 bg-card/30">
        <div className="flex h-14 items-center justify-center border-b border-border/60">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <nav className="flex flex-col items-center gap-1 py-3" aria-label="Stages">
            <button
              type="button"
              onClick={onSelectSetup}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                activeView === 'setup'
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              )}
              title="Local setup"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            {stages.map((stage) => {
              const st = stageStatus(stage.stage_number, enrollment);
              const active = activeView === stage.stage_number;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onSelectStage(stage.stage_number)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    active
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : st === 'completed'
                        ? 'text-success hover:bg-success/10'
                        : st === 'locked'
                          ? 'text-muted-foreground/40'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                  )}
                  title={stage.title}
                >
                  <StatusIcon status={st} />
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
    );
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-card/30">
      {/* Header */}
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center justify-between">
          <Link to={`/projects/${slug}`} className="text-xs font-medium text-primary hover:underline">
            ← Overview
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
        <h1 className="mt-2.5 font-display text-sm font-bold leading-snug text-foreground">
          {challengeTitle}
        </h1>
        {language && (
          <p className="mt-1 text-xs text-muted-foreground">
            using <span className="capitalize font-medium text-foreground">{language}</span>
          </p>
        )}
        {/* Progress bar */}
        {enrollment && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{completedCount}/{totalCount} stages</span>
              <span>{progressPct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage list */}
      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-0.5 p-2" aria-label="Stages">
          {/* Setup */}
          <button
            type="button"
            onClick={onSelectSetup}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
              activeView === 'setup'
                ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            )}
          >
            <Settings2 className={cn('h-4 w-4 shrink-0', activeView === 'setup' ? 'text-primary' : '')} />
            <span className="font-medium">Local setup</span>
          </button>

          {/* Stages */}
          {stages.map((stage) => {
            const st = stageStatus(stage.stage_number, enrollment);
            const active = activeView === stage.stage_number;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.stage_number)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
                  active
                    ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                    : st === 'completed'
                      ? 'text-foreground hover:bg-success/5'
                      : st === 'locked'
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={st} />
                </span>
                <span className="leading-snug">{stage.title}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border/60 p-3">
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <BookOpen className="h-3 w-3" />
          Push to <code className="rounded bg-secondary/80 px-1 py-0.5 text-foreground">main</code> to run tests
        </p>
      </div>
    </aside>
  );
}
