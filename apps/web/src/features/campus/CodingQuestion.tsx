import { useState } from 'react';
import { CheckCircle2, Code2, FlaskConical, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorPanel } from '@/modules/CodeExecutor/components/EditorPanel';
import type { SupportedLanguage } from '@/modules/CodeExecutor';
import { CampusApiError, type CodeLanguage, type CodeRunResult, type ExamQuestion } from '@/services/campus.service';

// A coding question inside a college test: statement and sample tests on the
// left, the editor and sample-run results on the right. Running only checks
// the samples; hidden tests are judged on the server after submitting.

const LANGUAGE_LABEL: Record<CodeLanguage, string> = { python: 'Python', java: 'Java', cpp: 'C++', javascript: 'JavaScript' };

const VERDICT_TONE: Record<CodeRunResult['verdict'], string> = {
  Accepted: 'text-success',
  'Wrong Answer': 'text-red-600 dark:text-red-400',
  'Runtime Error': 'text-red-600 dark:text-red-400',
  'Compilation Error': 'text-reward',
  'Time Limit Exceeded': 'text-reward',
};

export function CodingQuestion({
  q, index, total, language, code, onCode, onLanguage, onReset, run,
}: {
  q: ExamQuestion;
  index: number;
  total: number;
  language: CodeLanguage;
  code: string;
  onCode: (code: string) => void;
  onLanguage: (language: CodeLanguage) => void;
  onReset: () => void;
  run: (code: string, language: CodeLanguage) => Promise<CodeRunResult>;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const samples = q.samples ?? [];

  const onRun = async () => {
    if (running) return;
    if (!code.trim()) { setRunError('Write some code first.'); return; }
    setRunning(true);
    setRunError(null);
    try {
      setResult(await run(code, language));
    } catch (e) {
      setResult(null);
      setRunError(e instanceof CampusApiError || e instanceof Error ? e.message : 'Could not run your code.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="lg:h-full grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:divide-x divide-border/60">
      {/* Statement */}
      <section className="lg:overflow-y-auto p-4 sm:p-6 space-y-5" aria-label="Problem">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-foreground">Question {index + 1} <span className="text-muted-foreground font-medium">of {total}</span></span>
          {q.section && <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">{q.section}</span>}
          <span className="px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">+{q.marks}</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1"><Code2 className="w-3 h-3" /> Coding</span>
        </div>

        <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">{q.body}</p>

        {samples.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Examples</p>
            {samples.map((s, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-secondary/30 p-3 text-sm space-y-1.5">
                <p className="text-[11px] font-bold text-muted-foreground">Example {i + 1}</p>
                <p><span className="text-muted-foreground">Input: </span><code className="font-mono text-foreground break-all">{s.input}</code></p>
                <p><span className="text-muted-foreground">Output: </span><code className="font-mono text-foreground break-all">{s.expected}</code></p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Run</strong> checks your code on the examples. When you submit, it is also checked on hidden tests — you get marks for every test that passes.</p>
          <p>Your code saves automatically. Keep the function name from the starter code.</p>
        </div>
      </section>

      {/* Editor + results */}
      <section className="flex flex-col min-h-0 h-[70vh] lg:h-full" aria-label="Your solution">
        <div className="flex-1 min-h-[260px]">
          <EditorPanel
            language={language as SupportedLanguage}
            setLanguage={(l) => onLanguage(l as CodeLanguage)}
            languages={(q.languages ?? []) as SupportedLanguage[]}
            code={code}
            setCode={onCode}
            theme={theme}
            toggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            onRun={() => void onRun()}
            onSubmit={() => undefined}
            onReset={onReset}
            isExecuting={running}
            showSubmit={false}
            allowFullscreen={false}
            allowLanguageSwitch={(q.languages?.length ?? 0) > 1}
          />
        </div>

        <div className="border-t border-border/60 bg-card max-h-[45%] overflow-y-auto p-4 text-sm" aria-live="polite">
          {running ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Running on the examples…</p>
          ) : runError ? (
            <p className="text-red-600 dark:text-red-400">{runError}</p>
          ) : result ? (
            <RunResult result={result} samples={samples} />
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <FlaskConical className="w-4 h-4" /> Press <strong className="text-foreground">Run</strong> to try your {LANGUAGE_LABEL[language]} code on the examples.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function RunResult({ result, samples }: { result: CodeRunResult; samples: Array<{ input: string; expected: string }> }) {
  return (
    <div className="space-y-3">
      <p className={cn('font-bold', VERDICT_TONE[result.verdict])}>
        {result.verdict === 'Accepted' ? 'All examples pass' : result.verdict}
        <span className="ml-2 text-xs font-medium text-muted-foreground">{result.passed}/{result.total} examples · {result.timeMs} ms</span>
      </p>
      {result.message && (
        <pre className="whitespace-pre-wrap break-words rounded-lg bg-secondary/50 p-3 font-mono text-xs text-foreground">{result.message}</pre>
      )}
      {!result.message && result.tests.map((t) => (
        <div key={t.index} className="rounded-lg border border-border/50 p-3 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            {t.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
            Example {t.index + 1}
          </p>
          {samples[t.index] && (
            <p className="text-xs"><span className="text-muted-foreground">Expected: </span><code className="font-mono break-all">{samples[t.index].expected}</code></p>
          )}
          {t.error ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-600 dark:text-red-400">{t.error}</pre>
          ) : (
            <p className="text-xs"><span className="text-muted-foreground">Your output: </span><code className="font-mono break-all">{t.actual ?? '—'}</code></p>
          )}
        </div>
      ))}
    </div>
  );
}
