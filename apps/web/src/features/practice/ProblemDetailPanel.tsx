import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lightbulb, BookOpen, FileText, Lock, CheckCircle2, Building2, Gauge, Bot, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { QuestionData } from '@/modules/CodeExecutor';
import { fetchHints, fetchSolution, type ProblemDetail } from './practice.service';

type Tab = 'description' | 'hints' | 'solution';

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function Description({ problem, question }: { problem: ProblemDetail; question: QuestionData }) {
  return (
    <div className="px-6 py-6 space-y-7">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', DIFF_STYLE[question.difficulty])}>{question.difficulty}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{problem.topic}</span>
          {problem.solved && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Solved
            </span>
          )}
        </div>
        <h2 className="text-2xl font-display font-bold tracking-tight text-zinc-100">{problem.title}</h2>
        {!!problem.companies?.length && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
            <Building2 className="w-3.5 h-3.5 text-zinc-500" /> Asked at
            {problem.companies.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>

      <div className="prose prose-invert prose-p:text-zinc-300 prose-code:text-emerald-400 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none max-w-none text-[15px] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
      </div>

      {question.examples.length > 0 && (
        <div className="space-y-4">
          {question.examples.map((ex, idx) => (
            <div key={idx} className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-200">Example {idx + 1}</p>
              <div className="grid gap-2 text-sm font-mono">
                <div><span className="text-zinc-500 text-[11px] font-sans font-bold uppercase tracking-wider mr-2">Input</span><span className="text-zinc-200">{ex.input}</span></div>
                <div><span className="text-zinc-500 text-[11px] font-sans font-bold uppercase tracking-wider mr-2">Output</span><span className="text-emerald-400">{ex.output}</span></div>
              </div>
              {ex.explanation && <p className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3">{ex.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      {question.constraints.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-zinc-200 mb-3">Constraints</h3>
          <ul className="space-y-2">
            {question.constraints.map((c, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                <span className="font-mono text-[13px] text-zinc-300">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {problem.judged && (
        <p className="text-xs text-zinc-500">
          <span className="font-semibold text-zinc-400">Run</span> checks the {problem.sample_tests.length} examples.{' '}
          <span className="font-semibold text-zinc-400">Submit</span> judges all {problem.test_count} tests, including hidden ones.
        </p>
      )}

      {problem.solved && problem.time_complexity && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
          <Gauge className="w-4 h-4 text-emerald-400 mt-0.5" />
          <p className="text-sm text-zinc-300">
            Target complexity: <span className="font-mono text-emerald-400">{problem.time_complexity}</span> time
            {problem.space_complexity ? <>, <span className="font-mono text-emerald-400">{problem.space_complexity}</span> space</> : null}.
          </p>
        </div>
      )}
    </div>
  );
}

function Hints({ problem }: { problem: ProblemDetail }) {
  const [shown, setShown] = useState(0);
  const query = useQuery({ queryKey: ['problem-hints', problem.id], queryFn: () => fetchHints(problem.id), enabled: shown > 0, retry: false });
  const hints = query.data?.hints ?? [];
  const total = problem.hint_count;

  if (total === 0) return <p className="px-6 py-8 text-sm text-zinc-400">No hints for this problem yet.</p>;
  if (query.isError) {
    return (
      <div className="px-6 py-8 space-y-3 text-sm text-zinc-400">
        <Lock className="w-5 h-5 text-amber-400" />
        <p>{(query.error as Error)?.message?.includes('Premium') ? 'Hints for this problem are part of Forge Pro.' : 'Could not load hints right now.'}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-3">
      <p className="text-xs text-zinc-500">Reveal one hint at a time — try again after each one.</p>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn('rounded-xl border p-4', i < shown ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-zinc-900/40')}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5">Hint {i + 1}</p>
          {i < shown ? (
            query.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : <p className="text-sm text-zinc-200">{hints[i]}</p>
          ) : i === shown ? (
            <Button size="sm" variant="secondary" className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200" onClick={() => setShown(i + 1)}>
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Show hint {i + 1}
            </Button>
          ) : (
            <p className="text-sm text-zinc-600 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Reveal the previous hint first</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Solution({ problem }: { problem: ProblemDetail }) {
  const [revealed, setRevealed] = useState(problem.solved);
  const query = useQuery({ queryKey: ['problem-solution', problem.id], queryFn: () => fetchSolution(problem.id), enabled: revealed, retry: false });

  if (!revealed) {
    return (
      <div className="px-6 py-10 text-center space-y-3">
        <BookOpen className="w-8 h-8 mx-auto text-zinc-500" />
        <p className="text-sm text-zinc-300 font-semibold">Give it a real try first</p>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">The solution unlocks when you solve it. Stuck? Use the hints, or reveal it now.</p>
        <Button size="sm" variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200" onClick={() => setRevealed(true)}>Reveal solution</Button>
      </div>
    );
  }
  if (query.isLoading) return <div className="px-6 py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;
  const explanation = query.data?.solution_explanation;
  const codes = Object.entries(query.data?.solution_code ?? {}).filter(([, c]) => Boolean(c));
  if (query.isError || (!explanation && codes.length === 0)) {
    return (
      <div className="px-6 py-10 space-y-3">
        <p className="text-sm text-zinc-300 font-semibold">No written solution yet</p>
        <p className="text-sm text-zinc-500">Ask the AI mentor to walk you through the approach for <span className="text-zinc-300">{problem.title}</span>.</p>
        <Link to="/ai-coach" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><Bot className="w-4 h-4" /> Open the mentor</Link>
      </div>
    );
  }
  return (
    <div className="px-6 py-6 space-y-5">
      {explanation && (
        <div className="prose prose-invert max-w-none text-[15px] prose-p:text-zinc-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
        </div>
      )}
      {codes.map(([lang, code]) => (
        <div key={lang}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">{lang}</p>
          <pre className="text-xs font-mono text-zinc-200 bg-black/40 border border-white/5 rounded-lg p-3 overflow-x-auto">{code}</pre>
        </div>
      ))}
    </div>
  );
}

export function ProblemDetailPanel({ problem, question }: { problem: ProblemDetail; question: QuestionData }) {
  const [tab, setTab] = useState<Tab>('description');
  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: 'description', label: 'Description', icon: FileText },
    { key: 'hints', label: `Hints${problem.hint_count ? ` (${problem.hint_count})` : ''}`, icon: Lightbulb },
    { key: 'solution', label: 'Solution', icon: BookOpen },
  ];
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div role="tablist" className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-zinc-900/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {tab === 'description' && <Description problem={problem} question={question} />}
        {tab === 'hints' && <Hints problem={problem} />}
        {tab === 'solution' && <Solution problem={problem} />}
      </ScrollArea>
    </div>
  );
}
