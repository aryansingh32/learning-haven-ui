import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { api, del, patch, post, put } from '@/api/client';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type StepType = 'story_hook' | 'video' | 'doc' | 'quiz' | 'task';
interface QuizQ { question: string; options: string[]; correctAnswer: string; explanation?: string }
interface Step { id?: string; type: StepType; title: string; content: Record<string, any> }
interface Chapter { id: string; number: number; title: string; storyHook: string | null; estMinutes: number; steps: Step[] }
interface CourseDetail { id: string; title: string; description: string | null; difficulty: string; published: boolean; chapters: Chapter[] }

const STEP_LABEL: Record<StepType, string> = { story_hook: 'Story / why it matters', video: 'Video (YouTube)', doc: 'Reading', quiz: 'Quiz', task: 'Task' };
const newStep = (type: StepType): Step => ({
  type,
  title: STEP_LABEL[type].split(' ')[0],
  content: type === 'story_hook' ? { story: '' } : type === 'video' ? { youtube_url: '', title: '', focus_note: '' } : type === 'doc' ? { doc_md: '' }
    : type === 'quiz' ? { quiz_questions: [{ question: '', options: ['', ''], correctAnswer: '' }] } : { task_prompt: '' },
});

/** Edit a course the college owns: details, publish, chapters and each chapter's steps. */
export default function CourseEditor() {
  const { orgId, courseId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = `/orgs/${orgId}/content`;
  const q = useQuery({ queryKey: ['own-course', courseId], queryFn: () => api<CourseDetail>(`${base}/courses/${courseId}`) });
  const [details, setDetails] = useState({ title: '', description: '', difficulty: 'beginner' });
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState('');
  useEffect(() => { if (q.data) setDetails({ title: q.data.title, description: q.data.description ?? '', difficulty: q.data.difficulty }); }, [q.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['own-course', courseId] }); qc.invalidateQueries({ queryKey: ['own-courses', orgId] }); };

  const saveDetails = useMutation({
    mutationFn: () => patch(`${base}/courses/${courseId}`, { title: details.title, description: details.description || null, difficulty: details.difficulty }),
    onSuccess: () => { toast.success('Saved'); refresh(); }, onError: (e) => toast.error(e.message),
  });
  const publish = useMutation({
    mutationFn: (published: boolean) => patch(`${base}/courses/${courseId}`, { published }),
    onSuccess: (_d, published) => { toast.success(published ? 'Published: your students can enrol now' : 'Unpublished'); refresh(); }, onError: (e) => toast.error(e.message),
  });
  const addChapter = useMutation({
    mutationFn: () => post<{ id: string }>(`${base}/courses/${courseId}/chapters`, { title: newChapter }),
    onSuccess: (c) => { setNewChapter(''); setOpenChapter(c.id); refresh(); }, onError: (e) => toast.error(e.message),
  });
  const removeChapter = useMutation({ mutationFn: (id: string) => del(`${base}/chapters/${id}`), onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const removeCourse = useMutation({
    mutationFn: () => del(`${base}/courses/${courseId}`),
    onSuccess: () => { toast.success('Course deleted'); qc.invalidateQueries({ queryKey: ['own-courses', orgId] }); navigate('../content'); },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const c = q.data!;
  return (
    <>
      <Link to="../content" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Content</Link>
      <PageHeader title={c.title} description="Only your college's students see this course in Forge, tagged with your college's name."
        actions={<div className="flex items-center gap-2"><Badge variant={c.published ? 'default' : 'outline'}>{c.published ? 'Published' : 'Draft'}</Badge>
          <Switch checked={c.published} onCheckedChange={(v) => publish.mutate(v)} aria-label="Published" /></div>} />

      <section className="mb-6 rounded-lg border bg-card p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_200px]" onSubmit={(e: FormEvent) => { e.preventDefault(); saveDetails.mutate(); }}>
          <Field label="Title" htmlFor="ce-title"><Input id="ce-title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} /></Field>
          <Field label="Level" htmlFor="ce-level">
            <select id="ce-level" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={details.difficulty} onChange={(e) => setDetails({ ...details, difficulty: e.target.value })}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Description" htmlFor="ce-desc"><Textarea id="ce-desc" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></Field></div>
          <div className="flex justify-between sm:col-span-2">
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('Delete this course? Students lose access to it.')) removeCourse.mutate(); }}><Trash2 className="mr-1.5 h-4 w-4" />Delete course</Button>
            <Button type="submit" disabled={saveDetails.isPending}><Save className="mr-1.5 h-4 w-4" />Save details</Button>
          </div>
        </form>
      </section>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chapters</h2>
      <div className="space-y-2">
        {c.chapters.map((ch) => (
          <div key={ch.id} className="rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-2 p-3">
              <button className="flex-1 text-left font-medium" onClick={() => setOpenChapter(openChapter === ch.id ? null : ch.id)} aria-expanded={openChapter === ch.id}>
                {ch.number}. {ch.title} <span className="text-xs font-normal text-muted-foreground">· {ch.steps.length} steps</span>
              </button>
              <Button size="sm" variant="ghost" aria-label={`Delete chapter ${ch.title}`} onClick={() => { if (window.confirm(`Delete chapter "${ch.title}"?`)) removeChapter.mutate(ch.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {openChapter === ch.id && <ChapterSteps base={base} chapter={ch} onSaved={refresh} />}
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (newChapter.trim()) addChapter.mutate(); }}>
        <Input placeholder="New chapter title" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} aria-label="New chapter title" className="max-w-sm" />
        <Button type="submit" variant="outline" disabled={!newChapter.trim() || addChapter.isPending}><Plus className="mr-1.5 h-4 w-4" />Add chapter</Button>
      </form>
    </>
  );
}

function ChapterSteps({ base, chapter, onSaved }: { base: string; chapter: Chapter; onSaved: () => void }) {
  const [steps, setSteps] = useState<Step[]>(chapter.steps);
  const [title, setTitle] = useState(chapter.title);
  const set = (i: number, s: Step) => setSteps((all) => all.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => { const n = [...all]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const save = useMutation({
    mutationFn: async () => {
      if (title.trim() !== chapter.title) await patch(`${base}/chapters/${chapter.id}`, { title: title.trim() });
      return put(`${base}/chapters/${chapter.id}/steps`, { steps: steps.map(({ id: _id, ...s }) => s) });
    },
    onSuccess: () => { toast.success('Chapter saved'); onSaved(); }, onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 border-t p-3">
      <Field label="Chapter title" htmlFor={`ch-${chapter.id}`}><Input id={`ch-${chapter.id}`} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      {steps.map((s, i) => (
        <div key={i} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Step {i + 1} · {STEP_LABEL[s.type]}</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="ghost" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="Remove step"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <StepFields step={s} onChange={(n) => set(i, n)} />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select aria-label="Add a step" className="h-9 rounded-md border bg-background px-3 text-sm" value="" onChange={(e) => e.target.value && setSteps((all) => [...all, newStep(e.target.value as StepType)])}>
          <option value="">Add a step…</option>
          {(Object.keys(STEP_LABEL) as StepType[]).map((t) => <option key={t} value={t}>{STEP_LABEL[t]}</option>)}
        </select>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" />Save chapter</Button>
      </div>
    </div>
  );
}

function StepFields({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const c = step.content;
  const setC = (patch: Record<string, unknown>) => onChange({ ...step, content: { ...c, ...patch } });
  if (step.type === 'story_hook') return <Textarea aria-label="Story" placeholder="Why this chapter matters, in a few lines" value={c.story} onChange={(e) => setC({ story: e.target.value })} />;
  if (step.type === 'doc') return <Textarea aria-label="Reading (Markdown)" rows={8} placeholder="Write the lesson in Markdown" value={c.doc_md} onChange={(e) => setC({ doc_md: e.target.value })} />;
  if (step.type === 'task') return <Textarea aria-label="Task" placeholder="What should students build or write?" value={c.task_prompt} onChange={(e) => setC({ task_prompt: e.target.value })} />;
  if (step.type === 'video') return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input aria-label="YouTube link" placeholder="https://www.youtube.com/watch?v=…" value={c.youtube_url} onChange={(e) => setC({ youtube_url: e.target.value })} />
      <Input aria-label="Video title" placeholder="Video title" value={c.title ?? ''} onChange={(e) => setC({ title: e.target.value })} />
      <Input className="sm:col-span-2" aria-label="What to watch for" placeholder="What to watch for (optional)" value={c.focus_note ?? ''} onChange={(e) => setC({ focus_note: e.target.value })} />
    </div>
  );
  const qs: QuizQ[] = c.quiz_questions ?? [];
  const setQ = (i: number, q: QuizQ) => setC({ quiz_questions: qs.map((x, j) => (j === i ? q : x)) });
  return (
    <div className="space-y-3">
      {qs.map((q, i) => (
        <div key={i} className="space-y-2 rounded border border-dashed p-2">
          <Input aria-label={`Question ${i + 1}`} placeholder={`Question ${i + 1}`} value={q.question} onChange={(e) => setQ(i, { ...q, question: e.target.value })} />
          {q.options.map((o, k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`correct-${i}-${q.question}`} checked={q.correctAnswer !== '' && q.correctAnswer === o} onChange={() => setQ(i, { ...q, correctAnswer: o })} aria-label={`Option ${k + 1} is correct`} />
              <Input aria-label={`Option ${k + 1}`} placeholder={`Option ${k + 1}`} value={o} onChange={(e) => {
                const options = q.options.map((x, j) => (j === k ? e.target.value : x));
                setQ(i, { ...q, options, correctAnswer: q.correctAnswer === o ? e.target.value : q.correctAnswer });
              }} />
            </label>
          ))}
          <div className="flex gap-2">
            {q.options.length < 6 && <Button type="button" size="sm" variant="ghost" onClick={() => setQ(i, { ...q, options: [...q.options, ''] })}>Add option</Button>}
            <Button type="button" size="sm" variant="ghost" onClick={() => setC({ quiz_questions: qs.filter((_, j) => j !== i) })}>Remove question</Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setC({ quiz_questions: [...qs, { question: '', options: ['', ''], correctAnswer: '' }] })}>Add question</Button>
    </div>
  );
}
