import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, CircleDashed, X } from 'lucide-react';
import { api, put } from '@/api/client';
import type { Marking as MarkingData, MarkingAnswer, MarkingQuestion, MarkingScript } from '@/api/types';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/**
 * Evaluators mark written answers question by question (the fairest way:
 * one rubric in mind at a time), optionally without names, and can override
 * a fill-in-the-blank that automatic checking got wrong.
 */
export default function Marking() {
  const { orgId, assignmentId } = useParams();
  const [blind, setBlind] = useState(() => {
    try { return localStorage.getItem('campus-blind-marking') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('campus-blind-marking', blind ? '1' : '0'); } catch { /* private mode */ } }, [blind]);
  const key = ['marking', assignmentId, blind];
  const data = useQuery({ queryKey: key, queryFn: () => api<MarkingData>(`/orgs/${orgId}/assignments/${assignmentId}/marking${blind ? '?blind=1' : ''}`) });
  const [tab, setTab] = useState<string | null>(null);
  // Open the first question with unmarked answers once, then stay put while marking.
  useEffect(() => {
    if (tab || !data.data) return;
    setTab(data.data.questions.find((q) => q.pending > 0)?.id ?? data.data.questions[0]?.id ?? 'overall');
  }, [data.data, tab]);

  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorNote error={data.error} />;
  const d = data.data!;
  const current = tab ?? d.questions.find((q) => q.pending > 0)?.id ?? d.questions[0]?.id ?? 'overall';
  const nextPending = d.questions.find((q) => q.pending > 0 && q.id !== current);
  const question = d.questions.find((q) => q.id === current);
  const pendingTotal = d.questions.reduce((n, q) => n + q.pending, 0);

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={`Marking · ${d.assignment.title}`}
        description={pendingTotal ? `${pendingTotal} written ${pendingTotal === 1 ? 'answer' : 'answers'} still to mark.` : 'Every written answer is marked.'}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blind} onCheckedChange={setBlind} aria-label="Hide student names" /> Hide names
          </label>
        } />

      {d.questions.length === 0 && d.scripts.length === 0 ? (
        <EmptyState title="Nothing to mark">This test has no written or fill-in-the-blank questions, or nobody has submitted yet.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Questions">
            {d.questions.map((q) => (
              <button key={q.id} role="tab" aria-selected={current === q.id} onClick={() => setTab(q.id)}
                className={`rounded-md px-3 py-1.5 ${current === q.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                Q{q.number} {q.type === 'fib' ? 'blank' : 'written'}
                {q.pending > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning">{q.pending}</span>}
              </button>
            ))}
            <button role="tab" aria-selected={current === 'overall'} onClick={() => setTab('overall')}
              className={`rounded-md px-3 py-1.5 ${current === 'overall' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
              Overall feedback
            </button>
          </div>
          {question
            ? <>
                <QuestionMarking key={question.id} orgId={orgId!} assignmentId={assignmentId!} q={question} onSaved={() => data.refetch()} />
                {question.pending === 0 && nextPending && (
                  <p className="mt-4 text-sm">All answers here are marked. <button className="font-medium text-primary hover:underline" onClick={() => setTab(nextPending.id)}>Next: question {nextPending.number} ({nextPending.pending} to mark)</button></p>
                )}
              </>
            : <OverallFeedback orgId={orgId!} assignmentId={assignmentId!} scripts={d.scripts} onSaved={() => data.refetch()} />}
        </>
      )}
    </>
  );
}

function QuestionMarking({ orgId, assignmentId, q, onSaved }: { orgId: string; assignmentId: string; q: MarkingQuestion; onSaved: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question {q.number} · {q.marks} marks</p>
          <p className="mt-1 whitespace-pre-wrap">{q.body}</p>
          {q.maxWords && <p className="mt-2 text-xs text-muted-foreground">Word limit: {q.maxWords}</p>}
        </div>
        {q.type === 'descriptive' ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-medium">Rubric</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{q.rubric || 'No rubric was written for this question.'}</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p className="font-medium">Accepted answers</p>
            <p className="mt-1 text-muted-foreground">{(q.acceptedAnswers ?? []).join(' · ')}</p>
            <p className="mt-2 text-xs text-muted-foreground">These were checked automatically. Give marks only to override a near miss.</p>
          </div>
        )}
      </aside>
      <ol className="space-y-3">
        {q.answers.length === 0 && <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nobody answered this question.</li>}
        {q.answers.map((a) => <AnswerCard key={`${q.id}:${a.attemptId}`} orgId={orgId} assignmentId={assignmentId} q={q} a={a} onSaved={onSaved} />)}
      </ol>
    </div>
  );
}

function AnswerCard({ orgId, assignmentId, q, a, onSaved }: { orgId: string; assignmentId: string; q: MarkingQuestion; a: MarkingAnswer; onSaved: () => void }) {
  const [marks, setMarks] = useState(a.marks?.toString() ?? '');
  const [feedback, setFeedback] = useState(a.feedback ?? '');
  useEffect(() => { setMarks(a.marks?.toString() ?? ''); setFeedback(a.feedback ?? ''); }, [a.marks, a.feedback]);
  const save = useMutation({
    mutationFn: () => put<{ score: number; totalMarks: number }>(`/orgs/${orgId}/assignments/${assignmentId}/attempts/${a.attemptId}/marks`, {
      questionId: q.id, marks: marks.trim() === '' ? null : Number(marks), feedback: feedback.trim() || null,
    }),
    onSuccess: (r) => { toast.success(`Saved · ${a.student} now has ${r.score}/${r.totalMarks}`); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const words = a.text.trim().split(/\s+/).filter(Boolean).length;
  const unmarked = q.type === 'descriptive' && a.marks === null;
  return (
    <li className={`rounded-lg border bg-card p-4 ${unmarked ? 'border-warning/50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{a.student}</span>
        {a.rollNumber && <span className="tabular text-xs text-muted-foreground">{a.rollNumber}</span>}
        {q.type === 'fib' && a.autoCorrect !== undefined && (
          a.autoCorrect
            ? <Badge variant="secondary"><Check className="mr-1 h-3 w-3" /> Matched</Badge>
            : <Badge variant="outline"><X className="mr-1 h-3 w-3" /> Didn't match</Badge>
        )}
        {unmarked && <span className="inline-flex items-center gap-1 text-xs text-warning"><CircleDashed className="h-3 w-3" /> Not marked</span>}
        <span className="ml-auto text-xs text-muted-foreground">{words} {words === 1 ? 'word' : 'words'}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap rounded-md bg-secondary/40 p-3 text-sm">{a.text}</p>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Marks <span className="font-normal text-muted-foreground">/ {q.marks}</span></span>
          <Input type="number" min={0} max={q.marks} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} className="w-24"
            aria-label={`Marks for ${a.student}`} placeholder={q.type === 'fib' ? 'auto' : ''} />
        </label>
        <label className="min-w-56 flex-1 text-sm">
          <span className="mb-1 block font-medium">Comment for the student <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Textarea rows={1} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label={`Comment for ${a.student}`} />
        </label>
        <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
      </form>
    </li>
  );
}

function OverallFeedback({ orgId, assignmentId, scripts, onSaved }: { orgId: string; assignmentId: string; scripts: MarkingScript[]; onSaved: () => void }) {
  if (scripts.length === 0) return <EmptyState title="No submissions yet" />;
  return (
    <ul className="space-y-3">
      {scripts.map((s) => <ScriptFeedback key={s.attemptId} orgId={orgId} assignmentId={assignmentId} s={s} onSaved={onSaved} />)}
    </ul>
  );
}

function ScriptFeedback({ orgId, assignmentId, s, onSaved }: { orgId: string; assignmentId: string; s: MarkingScript; onSaved: () => void }) {
  const [text, setText] = useState(s.feedback ?? '');
  const save = useMutation({
    mutationFn: () => put(`/orgs/${orgId}/assignments/${assignmentId}/attempts/${s.attemptId}/feedback`, { feedback: text.trim() || null }),
    onSuccess: () => { toast.success('Feedback saved'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <li className="rounded-lg border bg-card p-4">
      <p className="text-sm"><span className="font-medium">{s.student}</span>{s.rollNumber && <span className="ml-2 tabular text-xs text-muted-foreground">{s.rollNumber}</span>}
        <span className="ml-2 text-muted-foreground">{s.score}/{s.totalMarks}</span></p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Textarea rows={2} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} className="min-w-64 flex-1"
          aria-label={`Overall feedback for ${s.student}`} placeholder="What went well, and what to work on next" />
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>Save</Button>
      </form>
    </li>
  );
}
