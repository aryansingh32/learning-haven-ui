import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { api, del, patch, post, put } from '@/api/client';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const LANGS = [['python', 'Python'], ['java', 'Java'], ['cpp', 'C++'], ['javascript', 'JavaScript']] as const;
type Lang = (typeof LANGS)[number][0];
interface TestCase { input: string; expected: string; isSample: boolean; explanation?: string }
interface ProblemForm {
  title: string; description: string; difficulty: 'easy' | 'medium' | 'hard'; topic: string; constraints: string; hints: string;
  compare: 'exact' | 'unordered' | 'unordered_deep'; editorial: string; starterCode: Partial<Record<Lang, string>>; tests: TestCase[];
}
interface ProblemDetail extends Omit<ProblemForm, 'hints' | 'constraints' | 'editorial'> { id: string; hints: string[]; constraints: string | null; editorial: string | null; published: boolean }

const blank: ProblemForm = {
  title: '', description: '', difficulty: 'easy', topic: '', constraints: '', hints: '', compare: 'exact', editorial: '',
  starterCode: { python: 'class Solution:\n    def solve(self, nums):\n        pass\n' },
  tests: [{ input: 'nums = [1,2,3]', expected: '6', isSample: true }],
};

/**
 * A practice problem the college owns, judged like Forge's: students write a function,
 * inputs are "name = value" pairs, outputs are compared exactly or ignoring order.
 */
export default function ProblemEditor() {
  const { orgId, problemId } = useParams();
  const isNew = !problemId || problemId === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = `/orgs/${orgId}/content/problems`;
  const q = useQuery({ queryKey: ['own-problem', problemId], queryFn: () => api<ProblemDetail>(`${base}/${problemId}`), enabled: !isNew });
  const [f, setF] = useState<ProblemForm>(blank);
  const [lang, setLang] = useState<Lang>('python');
  useEffect(() => {
    if (q.data) setF({ ...q.data, hints: q.data.hints.join('\n'), constraints: q.data.constraints ?? '', editorial: q.data.editorial ?? '', compare: q.data.compare ?? 'exact' });
  }, [q.data]);

  const payload = () => ({
    title: f.title, description: f.description, difficulty: f.difficulty, topic: f.topic, constraints: f.constraints || null,
    hints: f.hints.split('\n').map((h) => h.trim()).filter(Boolean), compare: f.compare, editorial: f.editorial || null,
    starterCode: Object.fromEntries(Object.entries(f.starterCode).filter(([, v]) => v?.trim())), tests: f.tests,
  });
  const save = useMutation({
    mutationFn: () => (isNew ? post<{ id: string }>(base, payload()) : put(`${base}/${problemId}`, payload())),
    onSuccess: (r) => {
      toast.success(isNew ? 'Problem created as a draft. Publish it when ready.' : 'Saved');
      qc.invalidateQueries({ queryKey: ['own-problems', orgId] });
      if (isNew && r && typeof r === 'object' && 'id' in r) navigate(`../content/problems/${(r as { id: string }).id}`, { replace: true });
      else qc.invalidateQueries({ queryKey: ['own-problem', problemId] });
    },
    onError: (e) => toast.error(e.message),
  });
  const publish = useMutation({
    mutationFn: (published: boolean) => patch(`${base}/${problemId}`, { published }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['own-problem', problemId] }); qc.invalidateQueries({ queryKey: ['own-problems', orgId] }); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del(`${base}/${problemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['own-problems', orgId] }); navigate('../content?tab=problems'); },
    onError: (e) => toast.error(e.message),
  });

  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const setTest = (i: number, t: TestCase) => setF({ ...f, tests: f.tests.map((x, j) => (j === i ? t : x)) });

  return (
    <>
      <Link to="../content?tab=problems" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Practice problems</Link>
      <PageHeader title={isNew ? 'New practice problem' : f.title || 'Problem'}
        actions={!isNew && <label className="flex items-center gap-2 text-sm">Published<Switch checked={q.data?.published ?? false} onCheckedChange={(v) => publish.mutate(v)} aria-label="Published" /></label>} />
      <form className="space-y-5" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
        <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><Field label="Title" htmlFor="p-title"><Input id="p-title" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Difficulty" htmlFor="p-diff">
            <select id="p-diff" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as ProblemForm['difficulty'] })}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Topic" htmlFor="p-topic"><Input id="p-topic" required placeholder="Arrays, Strings, DP…" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
          <Field label="Compare output" htmlFor="p-cmp">
            <select id="p-cmp" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.compare} onChange={(e) => setF({ ...f, compare: e.target.value as ProblemForm['compare'] })}>
              <option value="exact">Exactly</option><option value="unordered">Ignoring order</option><option value="unordered_deep">Ignoring order at every level</option>
            </select>
          </Field>
          <div className="sm:col-span-3"><Field label="Statement (Markdown)" htmlFor="p-desc"><Textarea id="p-desc" required rows={8} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          <div className="sm:col-span-3"><Field label="Constraints" htmlFor="p-cons"><Textarea id="p-cons" rows={3} value={f.constraints} onChange={(e) => setF({ ...f, constraints: e.target.value })} /></Field></div>
          <div className="sm:col-span-3"><Field label="Hints" htmlFor="p-hints" hint="One per line"><Textarea id="p-hints" rows={3} value={f.hints} onChange={(e) => setF({ ...f, hints: e.target.value })} /></Field></div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium">Starter code</h2>
          <p className="mb-3 text-xs text-muted-foreground">Students only see languages that have starter code. Write a function inside class Solution; tests call it with the named inputs.</p>
          <div className="mb-2 flex flex-wrap gap-1" role="tablist">
            {LANGS.map(([id, label]) => (
              <Button key={id} type="button" size="sm" variant={lang === id ? 'default' : 'outline'} role="tab" aria-selected={lang === id} onClick={() => setLang(id)}>
                {label}{f.starterCode[id]?.trim() ? ' ✓' : ''}
              </Button>
            ))}
          </div>
          <Textarea aria-label={`Starter code (${lang})`} rows={8} className="font-mono text-xs" value={f.starterCode[lang] ?? ''}
            onChange={(e) => setF({ ...f, starterCode: { ...f.starterCode, [lang]: e.target.value } })} />
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-medium">Tests</h2>
          <p className="mb-3 text-xs text-muted-foreground">Samples are shown to students; the rest stay hidden and decide the verdict. Input like <code>nums = [2,7,11,15], target = 9</code>.</p>
          <div className="space-y-2">
            {f.tests.map((t, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input aria-label={`Test ${i + 1} input`} placeholder="Input" className="font-mono text-xs" value={t.input} onChange={(e) => setTest(i, { ...t, input: e.target.value })} />
                <Input aria-label={`Test ${i + 1} expected output`} placeholder="Expected output" className="font-mono text-xs" value={t.expected} onChange={(e) => setTest(i, { ...t, expected: e.target.value })} />
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={t.isSample} onCheckedChange={(v) => setTest(i, { ...t, isSample: v })} aria-label={`Test ${i + 1} is a sample`} />Sample</label>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove test ${i + 1}`} disabled={f.tests.length === 1} onClick={() => setF({ ...f, tests: f.tests.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setF({ ...f, tests: [...f.tests, { input: '', expected: '', isSample: false }] })}><Plus className="mr-1.5 h-4 w-4" />Add test</Button>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <Field label="Editorial (shown on the Solution tab)" htmlFor="p-edit"><Textarea id="p-edit" rows={5} value={f.editorial} onChange={(e) => setF({ ...f, editorial: e.target.value })} /></Field>
        </section>

        <div className="flex justify-between">
          {!isNew ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('Delete this problem?')) remove.mutate(); }}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button> : <span />}
          <Button type="submit" disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" />{isNew ? 'Create problem' : 'Save'}</Button>
        </div>
      </form>
    </>
  );
}
