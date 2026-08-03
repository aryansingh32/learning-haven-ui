import { useMemo, useRef, useEffect } from 'react';
import {
  Loader2,
  Copy,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
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
  /** Live log lines streamed during verification */
  liveLogLines?: string[];
  /** When true, next stage's tests already pass — proactive detection */
  nextStageAlreadyImplemented?: boolean;
};

/* ── Diff-style error rendering ────────────────────────────────────── */

function DiffLine({ line }: { line: string }) {
  // Expected/Received diff rendering
  if (/^\s*Expected:\s*"/.test(line) || /^\s*Expected:\s*/.test(line)) {
    return (
      <span className="text-success">
        {line}
      </span>
    );
  }
  if (/^\s*Received:\s*"/.test(line) || /^\s*Received:\s*/.test(line)) {
    return (
      <span className="text-destructive">
        {line}
      </span>
    );
  }
  if (/^\s*\^/.test(line) || line.includes('does not match expected value')) {
    return (
      <span className="text-warning font-medium">
        {line}
      </span>
    );
  }
  // Success assertions
  if (line.includes('✓') || line.includes('Test passed')) {
    return (
      <span className="text-success">
        {line}
      </span>
    );
  }
  // Failure
  if (line.includes('Test failed') || line.includes('✗')) {
    return (
      <span className="text-destructive font-medium">
        {line}
      </span>
    );
  }
  // Tester prefix
  if (/^\[tester::/.test(line)) {
    return (
      <span className="text-muted-foreground">
        <span className="text-primary/70">{line.match(/^\[tester::#\w+\]/)?.[0]}</span>
        {line.replace(/^\[tester::#\w+\]/, '')}
      </span>
    );
  }
  // User program prefix
  if (/^\[your-program\]/.test(line)) {
    return (
      <span className="text-foreground">
        <span className="text-cyan-500/70">[your-program]</span>
        {line.replace(/^\[your-program\]/, '')}
      </span>
    );
  }
  // Compile prefix
  if (/^\[compile\]/.test(line)) {
    return (
      <span className="text-muted-foreground">
        <span className="text-amber-500/70">[compile]</span>
        {line.replace(/^\[compile\]/, '')}
      </span>
    );
  }
  // Runner prefix
  if (/^\[runner\]/.test(line)) {
    return (
      <span className="text-muted-foreground italic">
        {line}
      </span>
    );
  }
  return <span>{line}</span>;
}

function FormattedLogOutput({ content }: { content: string }) {
  const lines = useMemo(() => content.split('\n'), [content]);
  return (
    <>
      {lines.map((line, idx) => (
        <div key={idx} className="min-h-[1.25rem]">
          <DiffLine line={line} />
        </div>
      ))}
    </>
  );
}

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
  liveLogLines,
  nextStageAlreadyImplemented,
}: Props) {
  const passed = verdict === 'passed';
  const failed = verdict === 'failed';

  const logContainerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogLines, testOutput, showLogs]);

  // 5-state status bar (CodeCrafters parity)
  const statusState = nextStageAlreadyImplemented
    ? 'next_implemented'
    : isVerifying
      ? 'running'
      : passed
        ? 'passed'
        : failed
          ? 'failed'
          : 'idle';

  const logContent = isVerifying && liveLogLines?.length
    ? liveLogLines.join('\n')
    : testOutput || '';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Expandable log output */}
      {showLogs && logContent && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md">
          <pre ref={logContainerRef} className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground/80 scroll-smooth">
            <FormattedLogOutput content={logContent} />
          </pre>
        </div>
      )}

      {/* Live streaming indicator during verification */}
      {isVerifying && liveLogLines && liveLogLines.length > 0 && !showLogs && (
        <div className="border-t border-primary/20 bg-primary/5 px-4 py-1.5">
          <p className="font-mono text-[11px] text-primary/70 truncate">
            {liveLogLines[liveLogLines.length - 1]}
          </p>
        </div>
      )}

      {/* Status bar */}
      <div
        className={cn(
          'flex items-center justify-between border-t px-4 py-2.5 text-sm transition-colors duration-300',
          statusState === 'running' && 'border-primary/40 bg-primary/5',
          statusState === 'passed' && 'border-success/40 bg-success/10',
          statusState === 'failed' && 'border-destructive/40 bg-destructive/5',
          statusState === 'next_implemented' && 'border-success/40 bg-success/10',
          statusState === 'idle' && 'border-border/60 bg-card/80'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Status icon */}
          {statusState === 'running' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : statusState === 'passed' ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : statusState === 'next_implemented' ? (
            <Sparkles className="h-4 w-4 text-success" />
          ) : statusState === 'failed' ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
          )}

          {/* Status text */}
          {statusState === 'running' ? (
            <span className="font-medium text-primary">
              Running tests{activeCommitHash ? ` for commit ${activeCommitHash.substring(0, 7)}` : ''}…
            </span>
          ) : statusState === 'passed' ? (
            <span className="font-medium text-success">
              Tests passed!{stageNumber ? ` · Stage ${stageNumber}` : ''}
            </span>
          ) : statusState === 'next_implemented' ? (
            <span className="font-medium text-success">
              Next stage already implemented!
            </span>
          ) : statusState === 'failed' ? (
            <span className="font-medium text-destructive">
              Tests failed.{stageNumber ? ` · Stage ${stageNumber}` : ''}
            </span>
          ) : statusState === 'idle' && !logContent ? (
            <span className="text-muted-foreground flex items-center gap-2">
              Waiting for your push: <code className="text-[10px] bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded font-mono text-foreground/80">git push origin main</code>
            </span>
          ) : (
            <span className="text-muted-foreground">Ready to run tests</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(statusState === 'passed' || statusState === 'next_implemented') && onNextStage && (
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
          {logContent && onCopyLogs && (
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
