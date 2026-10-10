import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Code2, FileText, Link2, ListChecks, Plus, Trash2 } from 'lucide-react';
import { api, del, patch, post, put } from '@/api/client';
import type { Batch } from '@/api/types';
import { EmptyState, ErrorNote, Field, formatDateTime, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export interface OwnCourse { id: string; title: string; description: string | null; difficulty: string; published: boolean; chapters: number; enrolled: number; updatedAt: string }
interface OwnProblem { id: string; title: string; difficulty: string; topic: string; published: boolean; tests: number; solvers: number; updatedAt: string }
interface Series { id: string; title: string; description: string | null; categoryId: string; published: boolean; tests: { id: string; title: string; published: boolean; questions: number }[] }
interface SeriesData { categories: { id: string; name: string }[]; series: Series[] }
interface CollegeTest { id: string; title: string; source: 'college' | 'forge' | 'shared'; questionCount: number }
export interface Material { id: string; title: string; kind: 'note' | 'link' | 'file'; body: string | null; url: string | null; batchId: string | null; courseId: string | null; tags: string[]; published: boolean; updatedAt: string }

const Published = ({ on }: { on: boolean }) => <Badge variant={on ? 'default' : 'outline'}>{on ? 'Published' : 'Draft'}</Badge>;

/** Content the college makes for its own students: only this college's students see it in the Forge app. */
export default function Content() {
  const { orgId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'courses';
  return (
    <>
      <PageHeader title="Content" description="Courses, practice problems, test series and study material for your own students. Only students of your college see them in Forge, tagged with your college's name." />
      <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="courses"><BookOpen className="mr-1.5 h-4 w-4" />Courses</TabsTrigger>
          <TabsTrigger value="problems"><Code2 className="mr-1.5 h-4 w-4" />Practice problems</TabsTrigger>
          <TabsTrigger value="series"><ListChecks className="mr-1.5 h-4 w-4" />Test series &amp; aptitude</TabsTrigger>
          <TabsTrigger value="materials"><FileText className="mr-1.5 h-4 w-4" />Study material</TabsTrigger>
        </TabsList>
        <TabsContent value="courses"><CoursesTab orgId={orgId!} /></TabsContent>
        <TabsContent value="problems"><ProblemsTab orgId={orgId!} /></TabsContent>
        <TabsContent value="series"><SeriesTab orgId={orgId!} /></TabsContent>
        <TabsContent value="materials"><MaterialsTab orgId={orgId!} /></TabsContent>
      </Tabs>
    </>
  );
}

function CoursesTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['own-courses', orgId], queryFn: () => api<OwnCourse[]>(`/orgs/${orgId}/content/courses`) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', difficulty: 'beginner' });
  const create = useMutation({
    mutationFn: () => post<{ id: string }>(`/orgs/${orgId}/content/courses`, { title: form.title, description: form.description || null, difficulty: form.difficulty }),
    onSuccess: (c) => { toast.success('Course created. Add its chapters.'); navigate(`courses/${c.id}`); },
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New course</Button></div>
      {q.data!.length === 0 ? (
        <EmptyState title="No courses yet">Build a course with chapters, videos, readings and quizzes. Your students find it in Learn under your college's name.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((c) => (
            <Link key={c.id} to={`courses/${c.id}`} className="rounded-lg border bg-card p-4 hover:border-primary/50">
              <div className="flex items-start justify-between gap-2"><h3 className="font-medium">{c.title}</h3><Published on={c.published} /></div>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-3 text-xs text-muted-foreground capitalize">{c.difficulty} · {c.chapters} chapters · {c.enrolled} enrolled</p>
            </Link>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Title" htmlFor="nc-title"><Input id="nc-title" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="What students will learn" htmlFor="nc-desc"><Textarea id="nc-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Level" htmlFor="nc-level">
              <select id="nc-level" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </Field>
            <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProblemsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['own-problems', orgId], queryFn: () => api<OwnProblem[]>(`/orgs/${orgId}/content/problems`) });
  const toggle = useMutation({
    mutationFn: (p: OwnProblem) => patch(`/orgs/${orgId}/content/problems/${p.id}`, { published: !p.published }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['own-problems', orgId] }); },
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  return (
    <>
      <div className="mb-3 flex justify-end"><Button asChild><Link to="problems/new"><Plus className="mr-1.5 h-4 w-4" />New problem</Link></Button></div>
      {q.data!.length === 0 ? (
        <EmptyState title="No practice problems yet">Write a problem with starter code and hidden tests. Students solve it in Forge's editor and the server judges it.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Problem</th><th className="px-4 py-2.5 font-medium">Tests</th><th className="px-4 py-2.5 font-medium">Solved by</th><th className="px-4 py-2.5 font-medium">Published</th></tr>
            </thead>
            <tbody className="divide-y">
              {q.data!.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3"><Link to={`problems/${p.id}`} className="font-medium hover:underline">{p.title}</Link><p className="text-xs text-muted-foreground capitalize">{p.difficulty} · {p.topic}</p></td>
                  <td className="px-4 py-3">{p.tests}</td>
                  <td className="px-4 py-3">{p.solvers}</td>
                  <td className="px-4 py-3"><Switch checked={p.published} onCheckedChange={() => toggle.mutate(p)} aria-label={`Publish ${p.title}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SeriesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['own-series', orgId], queryFn: () => api<SeriesData>(`/orgs/${orgId}/content/test-series`) });
  const tests = useQuery({ queryKey: ['tests', orgId], queryFn: () => api<CollegeTest[]>(`/orgs/${orgId}/tests`) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', categoryId: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['own-series', orgId] });
  const create = useMutation({
    mutationFn: () => post(`/orgs/${orgId}/content/test-series`, { title: form.title, description: form.description || null, categoryId: form.categoryId }),
    onSuccess: () => { toast.success('Series created. Add tests to it.'); setOpen(false); setForm({ title: '', description: '', categoryId: '' }); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const publish = useMutation({
    mutationFn: (s: Series) => patch(`/orgs/${orgId}/content/test-series/${s.id}`, { published: !s.published }),
    onSuccess: refresh, onError: (e) => toast.error(e.message),
  });
  const attach = useMutation({
    mutationFn: ({ seriesId, testId }: { seriesId: string; testId: string }) => post(`/orgs/${orgId}/content/test-series/${seriesId}/tests`, { testId }),
    onSuccess: () => { toast.success('Test added'); refresh(); }, onError: (e) => toast.error(e.message),
  });
  const detach = useMutation({
    mutationFn: ({ seriesId, testId }: { seriesId: string; testId: string }) => del(`/orgs/${orgId}/content/test-series/${seriesId}/tests/${testId}`),
    onSuccess: refresh, onError: (e) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const inSeries = new Set(q.data!.series.flatMap((s) => s.tests.map((t) => t.id)));
  const candidates = (tests.data ?? []).filter((t) => t.source === 'college' && !inSeries.has(t.id));
  const catName = (id: string) => q.data!.categories.find((c) => c.id === id)?.name ?? '';
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Self-paced practice tests (aptitude, placement mocks). Build the tests on the <Link to="../tests" className="underline">Tests</Link> page with multiple-choice, true/false or numeric questions, then add them to a series.</p>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New series</Button>
      </div>
      {q.data!.series.length === 0 ? <EmptyState title="No test series yet">Group practice tests into a series, such as "Quantitative aptitude" or "TCS NQT mocks".</EmptyState> : (
        <div className="space-y-3">
          {q.data!.series.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-medium">{s.title}</h3><p className="text-xs text-muted-foreground">{catName(s.categoryId)}{s.description ? ` · ${s.description}` : ''}</p></div>
                <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Published</span><Switch checked={s.published} onCheckedChange={() => publish.mutate(s)} aria-label={`Publish ${s.title}`} /></div>
              </div>
              <ul className="mt-3 divide-y rounded-md border">
                {s.tests.length === 0 && <li className="p-3 text-sm text-muted-foreground">No tests in this series yet.</li>}
                {s.tests.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-3 text-sm">
                    <span>{t.title} <span className="text-muted-foreground">· {t.questions} questions</span></span>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${t.title}`} onClick={() => detach.mutate({ seriesId: s.id, testId: t.id })}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
              {candidates.length > 0 && (
                <select aria-label={`Add a test to ${s.title}`} className="mt-3 h-9 rounded-md border bg-background px-3 text-sm" value=""
                  onChange={(e) => e.target.value && attach.mutate({ seriesId: s.id, testId: e.target.value })}>
                  <option value="">Add a test…</option>
                  {candidates.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.questionCount} questions)</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New test series</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Title" htmlFor="ns-title"><Input id="ns-title" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Category" htmlFor="ns-cat">
              <select id="ns-cat" required className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Choose…</option>
                {q.data!.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Description" htmlFor="ns-desc"><Textarea id="ns-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <DialogFooter><Button type="submit" disabled={create.isPending || !form.categoryId}>Create</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const emptyMaterial = { title: '', kind: 'note' as Material['kind'], body: '', url: '', batchId: '', tags: '', published: true };

function MaterialsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['materials', orgId], queryFn: () => api<Material[]>(`/orgs/${orgId}/content/materials`) });
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`) });
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [form, setForm] = useState(emptyMaterial);
  const refresh = () => qc.invalidateQueries({ queryKey: ['materials', orgId] });
  const openEditor = (m: Material | 'new') => {
    setEditing(m);
    setForm(m === 'new' ? emptyMaterial : { title: m.title, kind: m.kind, body: m.body ?? '', url: m.url ?? '', batchId: m.batchId ?? '', tags: m.tags.join(', '), published: m.published });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { title: form.title, kind: form.kind, body: form.kind === 'note' ? form.body : null, url: form.kind === 'note' ? null : form.url,
        batchId: form.batchId || null, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), published: form.published };
      return editing === 'new' ? post(`/orgs/${orgId}/content/materials`, body) : put(`/orgs/${orgId}/content/materials/${(editing as Material).id}`, body);
    },
    onSuccess: () => { toast.success('Saved'); setEditing(null); refresh(); }, onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/orgs/${orgId}/content/materials/${id}`), onSuccess: refresh, onError: (e) => toast.error(e.message) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const batchName = (id: string | null) => (id ? batches.data?.find((b) => b.id === id)?.name ?? 'a batch' : 'Whole college');
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => openEditor('new')}><Plus className="mr-1.5 h-4 w-4" />New material</Button></div>
      {q.data!.length === 0 ? <EmptyState title="No study material yet">Publish notes, lab manuals, slides or links. Students see them under My College in Forge.</EmptyState> : (
        <ul className="divide-y rounded-lg border bg-card">
          {q.data!.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <button className="text-left" onClick={() => openEditor(m)}>
                <span className="flex items-center gap-2 font-medium">{m.kind === 'note' ? <FileText className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{m.title}</span>
                <span className="text-xs text-muted-foreground">{batchName(m.batchId)} · updated {formatDateTime(m.updatedAt)}{m.tags.length ? ` · ${m.tags.join(', ')}` : ''}</span>
              </button>
              <div className="flex items-center gap-2"><Published on={m.published} />
                <Button size="sm" variant="ghost" aria-label={`Delete ${m.title}`} onClick={() => remove.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'New study material' : 'Edit study material'}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
            <Field label="Title" htmlFor="m-title"><Input id="m-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" htmlFor="m-kind">
                <select id="m-kind" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Material['kind'] })}>
                  <option value="note">Note (write it here)</option><option value="link">Link</option><option value="file">File link (PDF, slides)</option>
                </select>
              </Field>
              <Field label="For" htmlFor="m-batch">
                <select id="m-batch" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                  <option value="">Whole college</option>
                  {batches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            </div>
            {form.kind === 'note'
              ? <Field label="Note (Markdown)" htmlFor="m-body"><Textarea id="m-body" rows={10} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
              : <Field label="Link" htmlFor="m-url"><Input id="m-url" type="url" required placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>}
            <Field label="Tags" htmlFor="m-tags" hint="Comma separated, e.g. dbms, unit 2"><Input id="m-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />Published (students can see it)</label>
            <DialogFooter><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
