import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, ShieldCheck, AlertTriangle, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CodeWorkspace, type SupportedLanguage } from '@/modules/CodeExecutor';
import { ProblemDetailPanel } from '@/features/practice/ProblemDetailPanel';
import { fetchProblem, judgeOnServer, JUDGED_LANGUAGES, runOnServer, SERVER_RUN_LANGUAGES, setProblemStatus, toQuestion } from '@/features/practice/practice.service';

const DIFF_STYLE: Record<string, string> = {
  easy: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  hard: 'text-rose-400 bg-rose-500/10',
};

export default function ProblemPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: problem, isLoading, isError, error } = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => fetchProblem(slug!),
    enabled: !!slug,
    retry: 1,
  });

  const question = useMemo(() => (problem ? toQuestion(problem) : null), [problem]);

  const refreshLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['problem', slug] });
    void queryClient.invalidateQueries({ queryKey: ['problems'] });
    void queryClient.invalidateQueries({ queryKey: ['user-profile-stats'] });
  }, [queryClient, slug]);

  const submit = useCallback(async (code: string, language: SupportedLanguage) => {
    const outcome = await judgeOnServer(problem!, code, language);
    if (outcome.result.status === 'Accepted') {
      if (outcome.firstSolve) {
        void confetti({ particleCount: 110, spread: 75, origin: { y: 0.25 } });
        toast.success(outcome.xpGained > 0 ? `Solved! +${outcome.xpGained} XP` : 'Solved!');
      } else {
        toast.success('Accepted again — nice and solid.');
      }
    }
    refreshLists();
    return outcome.result;
  }, [problem, refreshLists]);

  // C++ can't run in the browser: its Run goes to the server (sample tests only).
  const run = useCallback((code: string, language: SupportedLanguage) =>
    (SERVER_RUN_LANGUAGES.includes(language) ? runOnServer(problem!, code, language) : undefined), [problem]);

  const status = useMutation({
    mutationFn: (s: 'tried' | 'revision' | 'solved') => setProblemStatus(problem!.id, s),
    onSuccess: (_d, s) => {
      toast.success(s === 'revision' ? 'Added to your revision list' : s === 'solved' ? 'Marked solved' : 'Updated');
      refreshLists();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not update'),
  });

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (isError || !problem || !question) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
          <p className="font-semibold text-zinc-100">{(error as Error & { status?: number })?.status === 404 ? 'This problem does not exist.' : "We couldn't load this problem."}</p>
          <Button variant="outline" onClick={() => navigate('/topics')}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Practice</Button>
        </div>
      </div>
    );
  }

  // A judged problem offers the languages it has starter code for.
  const languages = problem.judged ? JUDGED_LANGUAGES.filter((l) => problem.starter_code[l]) : undefined;

  const header = (
    <header className="h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-white/5 bg-zinc-900/70 backdrop-blur-xl">
      <Button variant="ghost" size="sm" className="h-8 px-2 text-zinc-400 hover:text-zinc-100" onClick={() => navigate('/topics')}>
        <ArrowLeft className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Practice</span>
      </Button>
      <span className="font-display font-bold text-gradient-golden hidden md:inline">FORGE</span>
      <div className="h-5 w-px bg-zinc-800 hidden md:block" />
      <h1 className="text-sm font-bold text-zinc-100 truncate">{problem.title}</h1>
      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0', DIFF_STYLE[problem.difficulty])}>{problem.difficulty}</span>
      {problem.solved && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 items-center gap-1 shrink-0 hidden sm:inline-flex">
          <CheckCircle2 className="w-3 h-3" /> Solved
        </span>
      )}
      <div className="flex-1" />
      {problem.judged ? (
        <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Judged on {problem.test_count} tests
        </span>
      ) : (
        <Button size="sm" variant="secondary" className="h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs" disabled={status.isPending || problem.solved} onClick={() => status.mutate('solved')}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {problem.solved ? 'Solved' : 'Mark solved'}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className={cn('h-8 text-xs', problem.status === 'revision' ? 'text-purple-300' : 'text-zinc-400 hover:text-zinc-100')}
        disabled={status.isPending || problem.status === 'revision'}
        onClick={() => status.mutate('revision')}
        title="Add to your revision list"
      >
        {problem.status === 'revision' ? <Bookmark className="w-3.5 h-3.5 sm:mr-1.5 fill-current" /> : <RotateCcw className="w-3.5 h-3.5 sm:mr-1.5" />}
        <span className="hidden sm:inline">{problem.status === 'revision' ? 'In revision' : 'Revise later'}</span>
      </Button>
    </header>
  );

  return (
    <CodeWorkspace
      key={problem.id}
      question={question}
      header={header}
      questionPanel={<ProblemDetailPanel problem={problem} question={question} />}
      languages={languages}
      initialLanguage="javascript"
      storageKey={`problem:${problem.slug}`}
      onSubmit={problem.judged ? submit : undefined}
      onRun={problem.judged ? run : undefined}
      showSubmit={problem.judged}
      theme="dark"
    />
  );
}
