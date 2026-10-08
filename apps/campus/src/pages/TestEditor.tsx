import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Plus, Trash2, X } from 'lucide-react';
import { api, del, patch, post } from '@/api/client';
import type { Question, TestDetail } from '@/api/types';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABEL: Record<Question['type'], string> = { mcq: 'Single choice', msq: 'Multiple choice', nat: 'Numeric answer' };

export default function TestEditor() {
  const { orgId, testId } = useParams();
  const qc = useQueryClient();
  const key = ['test', orgId, testId];
  const test = useQuery({ queryKey: key, queryFn: () => api<TestDetail>(`/orgs/${orgId}/tests/${testId}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['tests', orgId] }); };

  const publish = useMutation({
    mutationFn: (published: boolean) => patch(`/orgs/${orgId}/tests/${testId}`, { published }),
    onSuccess: (_d, published) => { toast.success(published ? 'Published — you can assign it now' : 'Moved back to draft'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (questionId: string) => del(`/orgs/${orgId}/tests/${testId}/questions/${questionId}`),
    onSuccess: () => { toast.success('Question removed'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (test.isLoading) return <Loading />;
  if (test.error) return <ErrorNote error={test.error} />;
  const t = test.data!;
  const totalMarks = t.questions.reduce((s, q) => s + q.marks, 0);

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tests
      </Link>
      <PageHeader
        title={t.title}
        description={`${t.questions.length} questions · ${totalMarks} marks · ${t.durationMinutes} minutes`}
        actions={
          <>
            <Badge variant={t.published ? 'secondary' : 'outline'}>{t.published ? 'Published' : 'Draft'}</Badge>
            <Button variant={t.published ? 'outline' : 'default'} disabled={publish.isPending} onClick={() => publish.mutate(!t.published)}>
              {t.published ? 'Unpublish' : 'Publish'}
            </Button>
          </>
        }
      />
      {t.published && <p className="-mt-3 mb-5 text-sm text-muted-foreground">Students already taking this test keep the questions they started with; edits apply to attempts that start afterwards.</p>}

      <ol className="space-y-3">
        {t.questions.map((q, i) => (
          <li key={q.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap">{q.body}</p>
                {q.options && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((o) => {
                      const right = q.correctOptions?.includes(o.id);
                      return (
                        <li key={o.id} className={right ? 'font-medium text-success' : 'text-muted-foreground'}>
                          {right ? <Check className="mr-1 inline h-3.5 w-3.5" aria-label="Correct" /> : <span className="mr-1 inline-block w-3.5" />}
                          {o.text}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {q.type === 'nat' && <p className="mt-2 text-sm font-medium text-success">Answer: {q.natAnswer}{q.natTolerance ? ` ± ${q.natTolerance}` : ''}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {TYPE_LABEL[q.type]} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}{q.negativeMarks ? ` · −${q.negativeMarks} if wrong` : ''}
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => remove.mutate(q.id)} disabled={remove.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <AddQuestion orgId={orgId!} testId={testId!} onAdded={refresh} number={t.questions.length + 1} />
    </>
  );
}

function AddQuestion({ orgId, testId, onAdded, number }: { orgId: string; testId: string; onAdded: () => void; number: number }) {
  const [type, setType] = useState<Question['type']>('mcq');
  const [body, setBody] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState<number[]>([]);
  const [natAnswer, setNatAnswer] = useState('');
  const [natTolerance, setNatTolerance] = useState('0');
  const [marks, setMarks] = useState('1');
  const [negative, setNegative] = useState('0');

  const reset = () => { setBody(''); setOptions(['', '', '', '']); setCorrect([]); setNatAnswer(''); setNatTolerance('0'); };
  const add = useMutation({
    mutationFn: () => {
      const filled = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      return post(`/orgs/${orgId}/tests/${testId}/questions`, type === 'nat'
        ? { type, body, natAnswer: Number(natAnswer), natTolerance: Number(natTolerance), marks: Number(marks) }
        : {
            type, body, marks: Number(marks), negativeMarks: Number(negative),
            options: filled.map((x) => x.o),
            correct: correct.map((c) => filled.findIndex((x) => x.i === c)).filter((c) => c >= 0),
          });
    },
    onSuccess: () => { toast.success('Question added'); reset(); onAdded(); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (i: number) => setCorrect((c) => type === 'mcq' ? [i] : c.includes(i) ? c.filter((x) => x !== i) : [...c, i]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (type !== 'nat' && correct.length === 0) { toast.error('Mark the correct answer.'); return; }
    add.mutate();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-dashed bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Question {number}</h2>
        <div className="flex rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Question type">
          {(['mcq', 'msq', 'nat'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t}
              onClick={() => { setType(t); setCorrect([]); }}
              className={`rounded px-3 py-1 ${type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Question" htmlFor="q-body">
        <Textarea id="q-body" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      {type !== 'nat' ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Options <span className="font-normal text-muted-foreground">— {type === 'mcq' ? 'tick the one correct answer' : 'tick every correct answer'}</span></legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type={type === 'mcq' ? 'radio' : 'checkbox'} name="correct" aria-label={`Option ${i + 1} is correct`}
                checked={correct.includes(i)} onChange={() => toggle(i)} disabled={!o.trim()} className="h-4 w-4 accent-[var(--color-primary)]" />
              <Input value={o} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 && (
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove option ${i + 1}`}
                  onClick={() => { setOptions(options.filter((_, j) => j !== i)); setCorrect([]); }}><X className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ''])}><Plus className="mr-1 h-4 w-4" /> Add option</Button>
          )}
        </fieldset>
      ) : (
        <div className="flex flex-wrap gap-4">
          <Field label="Correct answer" htmlFor="q-nat"><Input id="q-nat" type="number" step="any" required value={natAnswer} onChange={(e) => setNatAnswer(e.target.value)} className="w-40" /></Field>
          <Field label="Allowed error (±)" htmlFor="q-tol"><Input id="q-tol" type="number" step="any" min={0} value={natTolerance} onChange={(e) => setNatTolerance(e.target.value)} className="w-32" /></Field>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <Field label="Marks" htmlFor="q-marks"><Input id="q-marks" type="number" step="0.5" min={0.5} max={100} required value={marks} onChange={(e) => setMarks(e.target.value)} className="w-24" /></Field>
        {type === 'mcq' && (
          <Field label="Negative marks" htmlFor="q-neg" hint="Deducted for a wrong answer.">
            <Input id="q-neg" type="number" step="0.25" min={0} max={100} value={negative} onChange={(e) => setNegative(e.target.value)} className="w-24" />
          </Field>
        )}
      </div>

      <Button type="submit" disabled={add.isPending}>Add question</Button>
    </form>
  );
}
