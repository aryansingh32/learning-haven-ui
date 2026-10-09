import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Clock, Code2, EyeOff, Layers, Plus, Trash2, X } from 'lucide-react';
import { api, del, patch, post } from '@/api/client';
import type { CodeLanguage, CompareMode, Question, TestDetail, TestSection } from '@/api/types';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImportQuestions } from '@/components/ImportQuestions';

const TYPE_LABEL: Record<Question['type'], string> = { mcq: 'Single choice', msq: 'Multiple choice', nat: 'Numeric answer', coding: 'Coding' };

const LANGUAGES: Array<{ id: CodeLanguage; label: string }> = [
  { id: 'python', label: 'Python' }, { id: 'java', label: 'Java' }, { id: 'cpp', label: 'C++' }, { id: 'javascript', label: 'JavaScript' },
];
// The judge calls the student's function with each test's named inputs, so
// parameter names in the starter code must match the test inputs.
const STARTER: Record<CodeLanguage, string> = {
  python: 'class Solution:\n    def solve(self, nums):\n        pass\n',
  java: 'class Solution {\n    public int solve(int[] nums) {\n        \n    }\n}\n',
  cpp: 'class Solution {\npublic:\n    int solve(vector<int>& nums) {\n        \n    }\n};\n',
  javascript: '/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction solve(nums) {\n  \n}\n',
};
const COMPARE_LABEL: Record<CompareMode, string> = {
  exact: 'Exact output',
  unordered: 'Any order (list items)',
  unordered_deep: 'Any order (nested lists too)',
};

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
  const move = useMutation({
    mutationFn: ({ questionId, sectionId }: { questionId: string; sectionId: string | null }) =>
      patch(`/orgs/${orgId}/tests/${testId}/questions/${questionId}`, { sectionId }),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });

  if (test.isLoading) return <Loading />;
  if (test.error) return <ErrorNote error={test.error} />;
  const t = test.data!;
  // Marks a student can score: pooled sections count only the questions dealt.
  const totalMarks = [
    ...t.sections.map((x) => ({ qs: t.questions.filter((q) => q.sectionId === x.id), draw: x.drawCount })),
    { qs: t.questions.filter((q) => !q.sectionId || !t.sections.some((x) => x.id === q.sectionId)), draw: t.sections.length ? null : t.drawCount },
  ].reduce((sum, g) => sum + (g.draw && g.draw < g.qs.length ? g.draw * (g.qs[0]?.marks ?? 0) : g.qs.reduce((s, q) => s + q.marks, 0)), 0);
  const dealt = [
    ...t.sections.map((x) => Math.min(x.drawCount ?? Infinity, x.questionCount)),
    Math.min(t.sections.length ? Infinity : t.drawCount ?? Infinity, t.questions.filter((q) => !q.sectionId || !t.sections.some((x) => x.id === q.sectionId)).length),
  ].reduce((a, b) => a + b, 0);
  const timedMinutes = t.sections.reduce((s, x) => s + (x.durationMinutes ?? 0), 0);
  // Questions grouped by section, in section order; unsectioned ones last.
  const groups: Array<{ section: TestSection | null; questions: Question[] }> = [
    ...t.sections.map((section) => ({ section, questions: t.questions.filter((q) => q.sectionId === section.id) })),
    { section: null, questions: t.questions.filter((q) => !q.sectionId || !t.sections.some((x) => x.id === q.sectionId)) },
  ].filter((g) => g.section || g.questions.length > 0);
  let number = 0;

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tests
      </Link>
      <PageHeader
        title={t.title}
        description={`${t.questions.length} questions${dealt < t.questions.length ? ` (each student gets ${dealt})` : ''} · ${totalMarks} marks · ${t.sectionTimeLocked ? `${timedMinutes} minutes in timed sections` : `${t.durationMinutes} minutes`}`}
        actions={
          <>
            <ImportQuestions orgId={orgId!} testId={testId!} onImported={refresh} />
            <Badge variant={t.published ? 'secondary' : 'outline'}>{t.published ? 'Published' : 'Draft'}</Badge>
            <Button variant={t.published ? 'outline' : 'default'} disabled={publish.isPending} onClick={() => publish.mutate(!t.published)}>
              {t.published ? 'Unpublish' : 'Publish'}
            </Button>
          </>
        }
      />
      {t.published && <p className="-mt-3 mb-5 text-sm text-muted-foreground">Students already taking this test keep the questions they started with; edits apply to attempts that start afterwards.</p>}

      <SectionsPanel orgId={orgId!} testId={testId!} test={t} onChange={refresh} />

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.section?.id ?? 'none'} aria-label={g.section?.name ?? 'Not in a section'}>
            {(t.sections.length > 0) && (
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {g.section ? g.section.name : 'Not in a section'}
                {g.section?.durationMinutes && t.sectionTimeLocked && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock className="h-3 w-3" />{g.section.durationMinutes} min</span>
                )}
              </h2>
            )}
            {g.questions.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No questions in this section yet.</p>}
            <ol className="space-y-3">
              {g.questions.map((q) => {
                const i = number++;
                return (
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
                        {q.type === 'coding' && <CodingSummary q={q} />}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{TYPE_LABEL[q.type]} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}{q.negativeMarks ? ` · −${q.negativeMarks} if wrong` : ''}</span>
                          {t.sections.length > 0 && (
                            <select aria-label={`Section for question ${i + 1}`} value={q.sectionId ?? ''} disabled={move.isPending}
                              onChange={(e) => move.mutate({ questionId: q.id, sectionId: e.target.value || null })}
                              className="rounded border bg-card px-2 py-0.5 text-xs">
                              <option value="">Not in a section</option>
                              {t.sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => remove.mutate(q.id)} disabled={remove.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <AddQuestion orgId={orgId!} testId={testId!} onAdded={refresh} number={t.questions.length + 1} sections={t.sections} />
    </>
  );
}

function CodingSummary({ q }: { q: Question }) {
  const tests = q.tests ?? [];
  const samples = tests.filter((t) => t.isSample).length;
  return (
    <div className="mt-2 space-y-2 text-sm">
      <p className="text-muted-foreground">
        <Code2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        {LANGUAGES.filter((l) => q.starterCode?.[l.id] !== undefined).map((l) => l.label).join(', ')}
        {' · '}{samples} sample, {tests.length - samples} hidden {tests.length - samples === 1 ? 'test' : 'tests'}
        {' · '}{COMPARE_LABEL[q.compare ?? 'exact']}
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {tests.map((t, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            {!t.isSample && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Hidden from students" />}
            <span>{t.input}</span><span className="text-muted-foreground">→</span><span className="text-success">{t.expected}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TestRow = { input: string; expected: string; isSample: boolean };

function CodingFields({ starter, setStarter, compare, setCompare, tests, setTests }: {
  starter: Partial<Record<CodeLanguage, string>>; setStarter: (s: Partial<Record<CodeLanguage, string>>) => void;
  compare: CompareMode; setCompare: (c: CompareMode) => void;
  tests: TestRow[]; setTests: (t: TestRow[]) => void;
}) {
  const toggleLang = (l: CodeLanguage) => {
    const next = { ...starter };
    if (next[l] !== undefined) delete next[l]; else next[l] = STARTER[l];
    setStarter(next);
  };
  const setTest = (i: number, patch: Partial<TestRow>) => setTests(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">Languages students may use</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {LANGUAGES.map((l) => (
            <label key={l.id} className="flex items-center gap-2">
              <input type="checkbox" checked={starter[l.id] !== undefined} onChange={() => toggleLang(l.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      {LANGUAGES.filter((l) => starter[l.id] !== undefined).map((l) => (
        <Field key={l.id} label={`${l.label} starter code`} htmlFor={`q-starter-${l.id}`}
          hint="Students start from this. Keep the function name and parameter names — tests call it with them.">
          <Textarea id={`q-starter-${l.id}`} rows={6} spellCheck={false} className="font-mono text-xs"
            value={starter[l.id]} onChange={(e) => setStarter({ ...starter, [l.id]: e.target.value })} />
        </Field>
      ))}

      <Field label="How answers are compared" htmlFor="q-compare">
        <select id="q-compare" value={compare} onChange={(e) => setCompare(e.target.value as CompareMode)} className="rounded-md border bg-card px-3 py-2 text-sm">
          {(Object.keys(COMPARE_LABEL) as CompareMode[]).map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
        </select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Test cases <span className="font-normal text-muted-foreground">— inputs as <code>name = value</code>, e.g. <code>nums = [2,7,11,15], target = 9</code>. Samples are shown to students; the rest stay hidden. Marks are split across all tests.</span></legend>
        {tests.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input value={t.input} placeholder="Input, e.g. nums = [1,2,3]" aria-label={`Test ${i + 1} input`} className="min-w-48 flex-1 font-mono text-xs"
              onChange={(e) => setTest(i, { input: e.target.value })} />
            <Input value={t.expected} placeholder="Expected output" aria-label={`Test ${i + 1} expected output`} className="w-48 font-mono text-xs"
              onChange={(e) => setTest(i, { expected: e.target.value })} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={t.isSample} onChange={(e) => setTest(i, { isSample: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
              Sample
            </label>
            {tests.length > 1 && (
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove test ${i + 1}`}
                onClick={() => setTests(tests.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
        {tests.length < 50 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTests([...tests, { input: '', expected: '', isSample: false }])}>
            <Plus className="mr-1 h-4 w-4" /> Add test
          </Button>
        )}
      </fieldset>
    </div>
  );
}

const NEW_TESTS: TestRow[] = [{ input: '', expected: '', isSample: true }, { input: '', expected: '', isSample: false }];

function SectionsPanel({ orgId, testId, test, onChange }: { orgId: string; testId: string; test: TestDetail; onChange: () => void }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const base = `/orgs/${orgId}/tests/${testId}`;
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => { if (ok) toast.success(ok); onChange(); }, (e: Error) => toast.error(e.message));
  const addSection = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void run(() => post(`${base}/sections`, { name: name.trim(), durationMinutes: minutes ? Number(minutes) : null }), 'Section added')
      .then(() => { setName(''); setMinutes(''); });
  };

  return (
    <section className="mb-6 rounded-lg border bg-card p-4" aria-label="Sections">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Layers className="h-4 w-4" /> Sections</h2>
          <p className="text-sm text-muted-foreground">Group questions, e.g. Aptitude, Technical, Coding.</p>
        </div>
        <label className="flex max-w-sm items-start gap-3 text-sm">
          <Switch checked={test.sectionTimeLocked} aria-label="Timed sections"
            onCheckedChange={(v) => void run(() => patch(base, { sectionTimeLocked: v }), v ? 'Timed sections on' : 'Timed sections off')} />
          <span><span className="font-medium">Timed sections</span><span className="block text-xs text-muted-foreground">Students take one section at a time with its own timer and can't go back. The test lasts the sum of the sections.</span></span>
        </label>
      </div>

      {test.sections.length > 0 && (
        <ul className="mt-4 divide-y rounded-md border">
          {test.sections.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Input defaultValue={x.name} aria-label={`Name of section ${x.name}`} className="h-8 max-w-xs"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== x.name) void run(() => patch(`${base}/sections/${x.id}`, { name: v })); }} />
              <Input type="number" min={1} max={1440} defaultValue={x.durationMinutes ?? ''} placeholder="Minutes" aria-label={`Minutes for ${x.name}`} className="h-8 w-28"
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== x.durationMinutes) void run(() => patch(`${base}/sections/${x.id}`, { durationMinutes: v }));
                }} />
              <span className="text-xs text-muted-foreground">min · {x.questionCount} {x.questionCount === 1 ? 'question' : 'questions'}</span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                deal
                <Input type="number" min={1} max={500} defaultValue={x.drawCount ?? ''} placeholder="all" aria-label={`Questions dealt from ${x.name}`} className="h-8 w-16"
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== x.drawCount) void run(() => patch(`${base}/sections/${x.id}`, { drawCount: v }));
                  }} />
                per student
              </label>
              {x.drawCount && x.drawCount > x.questionCount && <Badge variant="outline" className="text-warning">pool too small</Badge>}
              {test.sectionTimeLocked && !x.durationMinutes && <Badge variant="outline" className="text-warning">needs a time limit</Badge>}
              <Button size="icon" variant="ghost" className="ml-auto" aria-label={`Remove section ${x.name}`}
                onClick={() => void run(() => del(`${base}/sections/${x.id}`), 'Section removed — its questions stay in the test')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(() => {
        const loose = test.questions.filter((q) => !q.sectionId || !test.sections.some((x) => x.id === q.sectionId)).length;
        return loose > 0 && test.sections.length === 0 ? (
          <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Question pool:</span> deal
            <Input type="number" min={1} max={500} defaultValue={test.drawCount ?? ''} placeholder="all" aria-label="Questions dealt per student" className="h-8 w-20"
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                if (v !== test.drawCount) void run(() => patch(base, { drawCount: v }), v ? `Each student gets ${v} of ${loose} questions` : 'Every student gets every question');
              }} />
            of {loose} questions to each student <span className="text-xs text-muted-foreground">(different questions per student; give them equal marks)</span>
          </label>
        ) : null;
      })()}
      <p className="mt-2 text-xs text-muted-foreground">Pools: set "deal" to give each student a random subset of a section's questions. Questions in a pool need equal marks.</p>

      <form onSubmit={addSection} className="mt-3 flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New section name" aria-label="New section name" className="h-9 max-w-xs" />
        <Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes" aria-label="New section minutes" className="h-9 w-28" />
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}><Plus className="mr-1 h-4 w-4" /> Add section</Button>
      </form>
    </section>
  );
}

function AddQuestion({ orgId, testId, onAdded, number, sections }: { orgId: string; testId: string; onAdded: () => void; number: number; sections: TestSection[] }) {
  const [type, setType] = useState<Question['type']>('mcq');
  const [sectionId, setSectionId] = useState<string | null | undefined>(undefined); // undefined = not chosen yet
  const [body, setBody] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState<number[]>([]);
  const [natAnswer, setNatAnswer] = useState('');
  const [natTolerance, setNatTolerance] = useState('0');
  const [marks, setMarks] = useState('1');
  const [negative, setNegative] = useState('0');
  const [starter, setStarter] = useState<Partial<Record<CodeLanguage, string>>>({ python: STARTER.python, java: STARTER.java });
  const [compare, setCompare] = useState<CompareMode>('exact');
  const [tests, setTests] = useState<TestRow[]>(NEW_TESTS);

  const reset = () => { setBody(''); setOptions(['', '', '', '']); setCorrect([]); setNatAnswer(''); setNatTolerance('0'); setTests(NEW_TESTS); };
  // Default to the last section, so adding a run of questions to one section is quick.
  const section = sectionId === null ? null
    : sectionId && sections.some((x) => x.id === sectionId) ? sectionId
    : sections.at(-1)?.id ?? null;
  const add = useMutation({
    mutationFn: () => {
      const filled = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      if (type === 'coding') {
        return post(`/orgs/${orgId}/tests/${testId}/questions`, {
          type, body, marks: Number(marks), starterCode: starter, compare, sectionId: section,
          tests: tests.filter((t) => t.input.trim() && t.expected.trim()),
        });
      }
      return post(`/orgs/${orgId}/tests/${testId}/questions`, type === 'nat'
        ? { type, body, natAnswer: Number(natAnswer), natTolerance: Number(natTolerance), marks: Number(marks), sectionId: section }
        : {
            type, body, marks: Number(marks), negativeMarks: Number(negative), sectionId: section,
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
    if (type === 'coding') {
      const filled = tests.filter((t) => t.input.trim() && t.expected.trim());
      if (Object.keys(starter).length === 0) { toast.error('Pick at least one language.'); return; }
      if (filled.length === 0) { toast.error('Add at least one test case with an input and expected output.'); return; }
      if (!filled.some((t) => t.isSample)) { toast.error('Mark at least one test as a sample so students can try their code.'); return; }
    } else if (type !== 'nat' && correct.length === 0) { toast.error('Mark the correct answer.'); return; }
    add.mutate();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-dashed bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Question {number}</h2>
        <div className="flex rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Question type">
          {(['mcq', 'msq', 'nat', 'coding'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t}
              onClick={() => { setType(t); setCorrect([]); }}
              className={`rounded px-3 py-1 ${type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {sections.length > 0 && (
        <Field label="Section" htmlFor="q-section">
          <select id="q-section" value={section ?? ''} onChange={(e) => setSectionId(e.target.value || null)} className="rounded-md border bg-card px-3 py-2 text-sm">
            {sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="">Not in a section</option>
          </select>
        </Field>
      )}

      <Field label="Question" htmlFor="q-body">
        <Textarea id="q-body" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      {type === 'coding' ? (
        <CodingFields starter={starter} setStarter={setStarter} compare={compare} setCompare={setCompare} tests={tests} setTests={setTests} />
      ) : type !== 'nat' ? (
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
