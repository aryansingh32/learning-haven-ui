import { Loader2, Copy, ChevronUp, ChevronDown, CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  verdict: string;
  isVerifying: boolean;
  activeCommitHash?: string | null;
  stageNumber?: number;
  testOutput?: string | null;
  showLogs: boolean;
  onToggleLogs: () => void;
  onCopyLogs?: () => void;
  onNextStage?: () => void;
};

export function BuildTestRunner({
  verdict,
  isVerifying,
  activeCommitHash,
  stageNumber,
  testOutput,
  showLogs,
  onToggleLogs,
  onCopyLogs,
  onNextStage,
}: Props) {
  const passed = verdict === 'passed';
  const failed = verdict === 'failed';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Expandable log output */}
      {showLogs && testOutput && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md">
          <pre className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground/80">
            {testOutput}
          </pre>
        </div>
      )}

      {/* Status bar */}
      <div
        className={cn(
          'flex items-center justify-between border-t px-4 py-2.5 text-sm transition-colors duration-300',
          isVerifying && 'border-primary/40 bg-primary/5',
          passed && 'border-success/40 bg-success/10',
          failed && 'border-destructive/40 bg-destructive/5',
          !isVerifying && !passed && !failed && 'border-border/60 bg-card/80'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Status icon */}
          {isVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : passed ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : failed ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
          )}

          {/* Status text */}
          {isVerifying ? (
            <span className="font-medium text-primary">
              Running tests{activeCommitHash ? ` for commit ${activeCommitHash.substring(0, 7)}` : ''}…
            </span>
          ) : passed ? (
            <span className="font-medium text-success">
              Tests passed{stageNumber ? ` · Stage ${stageNumber}` : ''}
            </span>
          ) : failed ? (
            <span className="font-medium text-destructive">
              Tests failed{stageNumber ? ` · Stage ${stageNumber}` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">Waiting for your first push…</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {passed && onNextStage && (
            <Button
              type="button"
              className="h-7 gap-1.5 text-xs bg-success hover:bg-success/90 text-white"
              size="sm"
              onClick={onNextStage}
            >
              Next Stage
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
          {testOutput && onCopyLogs && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onCopyLogs}>
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-primary"
            onClick={onToggleLogs}
          >
            {showLogs ? (
              <>
                Hide logs
                <ChevronDown className="h-3 w-3" />
              </>
            ) : (
              <>
                Show logs
                <ChevronUp className="h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
