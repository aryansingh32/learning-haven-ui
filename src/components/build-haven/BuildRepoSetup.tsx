import { Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownContent } from './MarkdownContent';

type Props = {
  repoUrl?: string | null;
  setupInstructions?: string | null;
  onCopy: (text: string) => void;
};

export function BuildRepoSetup({ repoUrl, setupInstructions, onCopy }: Props) {
  if (!repoUrl) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Start the challenge from the overview page to provision your private GitHub repository.
      </section>
    );
  }

  const cloneCmd = `git clone ${repoUrl}`;

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Local setup
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Work in your editor locally. Each push to <code className="rounded bg-secondary px-1">main</code> runs stage tests.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Clone repository</p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
          <span className="truncate">{cloneCmd}</span>
          <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => onCopy(cloneCmd)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {setupInstructions ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Setup environment</p>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <MarkdownContent content={setupInstructions} />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {setupInstructions ? '3. Run & submit' : '2. Run & submit'}
        </p>
        <p className="text-xs text-muted-foreground">Commit your changes and push to trigger verification.</p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
          <span className="truncate">git add . && git commit -m &quot;progress&quot; && git push origin main</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            onClick={() => onCopy('git add . && git commit -m "progress" && git push origin main')}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
