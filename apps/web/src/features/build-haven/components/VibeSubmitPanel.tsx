import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Link2, Github, Loader2, CheckCircle2, XCircle, Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';

interface JourneyStep {
  action: string;
  target?: string;
  value?: string;
  label?: string;
  admin_only?: boolean;
}

interface Journey {
  id: string;
  label: string;
  public: boolean;
  steps: JourneyStep[];
}

interface GateResult {
  journeyId: string;
  label: string;
  passed: boolean;
  steps_passed: number;
  steps_total: number;
  failure_step?: string;
  failure_reason?: string;
  screenshot_url?: string | null;
}

interface VibeVerificationResult {
  verdict: 'passed' | 'partial' | 'failed' | 'pending_review';
  gates_passed: number;
  gates_total: number;
  score_pct: number;
  gate_results: GateResult[];
  logs_tail: string;
  duration_ms: number;
  submission_source: string;
  submission_ref: string;
}

function describeStep(step: JourneyStep): string {
  switch (step.action) {
    case 'goto':
      return `Go to ${step.target || '/'}`;
    case 'click':
      return `Click "${step.target}"`;
    case 'fill':
      return `Fill "${step.target}" with a value`;
    case 'expect_visible':
      return `"${step.target}" should be visible`;
    case 'expect_hidden':
      return `"${step.target}" should be hidden`;
    case 'reload':
      return 'Reload the page';
    case 'wait':
      return step.target ? `Wait for "${step.target}"` : 'Wait briefly';
    case 'screenshot':
      return 'Take a screenshot';
    default:
      return step.action;
  }
}

function GateResultCard({ gate }: { gate: GateResult }) {
  const [expanded, setExpanded] = useState(!gate.passed);
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        gate.passed ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {gate.passed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className="truncate text-sm font-medium text-foreground">{gate.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
          <span>{gate.steps_passed}/{gate.steps_total} steps</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {expanded && !gate.passed && (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
          {gate.failure_step && (
            <p className="text-xs text-muted-foreground">
              Failed at: <span className="font-mono text-foreground">{gate.failure_step}</span>
            </p>
          )}
          {gate.failure_reason && <p className="text-xs text-destructive">{gate.failure_reason}</p>}
          {gate.screenshot_url && (
            <img
              src={gate.screenshot_url}
              alt={`Screenshot at point of failure for ${gate.label}`}
              className="mt-2 max-h-64 w-full rounded-lg border border-border/50 object-contain object-top"
            />
          )}
        </div>
      )}
    </div>
  );
}

function verdictBanner(result: VibeVerificationResult) {
  if (result.verdict === 'passed') {
    return { icon: CheckCircle2, tone: 'border-success/40 bg-success/10 text-success', text: 'All proof gates passed!' };
  }
  if (result.verdict === 'pending_review') {
    return {
      icon: Clock3,
      tone: 'border-primary/40 bg-primary/10 text-primary',
      text: 'Submitted for manual review — automated repo verification is coming soon.',
    };
  }
  if (result.verdict === 'partial') {
    return {
      icon: XCircle,
      tone: 'border-warning/40 bg-warning/10 text-warning',
      text: `${result.gates_passed}/${result.gates_total} gates passed — keep going.`,
    };
  }
  return { icon: XCircle, tone: 'border-destructive/40 bg-destructive/10 text-destructive', text: 'Gates did not pass yet.' };
}

interface VibeSubmitPanelProps {
  enrollmentId: string;
  stageId: string;
  journeys: Journey[];
  /** Most recent attempt's structured_feedback for this stage, if any. */
  initialResult?: VibeVerificationResult | null;
  onSubmitted?: (result: VibeVerificationResult) => void;
}

export function VibeSubmitPanel({ enrollmentId, stageId, journeys, initialResult, onSubmitted }: VibeSubmitPanelProps) {
  const [source, setSource] = useState<'live_url' | 'github_push'>('live_url');
  const [ref, setRef] = useState('');
  const [result, setResult] = useState<VibeVerificationResult | null | undefined>(initialResult);

  const publicJourneys = journeys.filter((j) => j.public !== false);

  const submitMutation = useMutation({
    mutationFn: () => buildHavenService.vibeSubmitStage(enrollmentId, stageId, ref.trim(), source),
    onSuccess: (data) => {
      const r = (data as any)?.result as VibeVerificationResult;
      if (r) {
        setResult(r);
        onSubmitted?.(r);
      }
    },
  });

  const errorMessage =
    submitMutation.isError && (submitMutation.error as any)?.response?.data?.error?.message
      ? (submitMutation.error as any).response.data.error.message
      : submitMutation.isError
        ? 'Submission failed — please try again.'
        : null;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/50 bg-card/40 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-500">
          <Sparkles className="h-3.5 w-3.5" />
          Product Contract — proof gates
        </h3>
        {publicJourneys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proof gates configured for this stage yet.</p>
        ) : (
          <div className="space-y-3">
            {publicJourneys.map((journey) => (
              <div key={journey.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <p className="text-sm font-medium text-foreground">{journey.label}</p>
                <ol className="mt-2 space-y-1">
                  {journey.steps
                    .filter((s) => !s.admin_only)
                    .map((step, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground">
                        {idx + 1}. {describeStep(step)}
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Submit for verification</h3>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSource('live_url')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              source === 'live_url'
                ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            Live URL
          </button>
          <button
            type="button"
            onClick={() => setSource('github_push')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              source === 'github_push'
                ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <Github className="h-3.5 w-3.5" />
            GitHub repo
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={source === 'live_url' ? 'https://your-app.vercel.app' : 'https://github.com/you/your-app'}
            className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <Button
            type="button"
            disabled={!ref.trim() || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="bg-violet-600 text-white hover:bg-violet-700 shrink-0"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {source === 'live_url' ? 'Running proof gates…' : 'Checking repo…'}
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
        {source === 'live_url' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            We run a real headless browser against this URL — it must be publicly reachable (no localhost or private
            addresses).
          </p>
        )}
        {errorMessage && <p className="mt-2 text-xs text-destructive">{errorMessage}</p>}
      </section>

      {result && (
        <section className="space-y-3">
          {(() => {
            const banner = verdictBanner(result);
            const Icon = banner.icon;
            return (
              <div className={cn('flex items-center gap-2 rounded-xl border p-3 text-sm font-medium', banner.tone)}>
                <Icon className="h-4 w-4 shrink-0" />
                {banner.text}
              </div>
            );
          })()}
          {result.gate_results.length > 0 && (
            <div className="space-y-2">
              {result.gate_results.map((gate) => (
                <GateResultCard key={gate.journeyId} gate={gate} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
