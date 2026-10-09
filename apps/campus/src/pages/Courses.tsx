import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Lock } from 'lucide-react';
import { api, patch, post } from '@/api/client';
import type { Batch, CollegeCourse, CollegeCourseDetail, CollegeDefaults, CourseAssignment } from '@/api/types';
import { EmptyState, ErrorNote, Field, formatDateTime, Loading, PageHeader, toLocalInput } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useOrg } from '@/context/CampusContext';

const hours = (minutes: number) => (minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`);

/** Learn courses given to batches: Forge's library plus the college's own. */
export default function Courses() {
  const { orgId } = useParams();
  const qc = useQueryClient();
  const { can } = useOrg(orgId);
  const author = can('assessments.create');
  const courses = useQuery({ queryKey: ['courses', orgId], queryFn: () => api<CollegeCourse[]>(`/orgs/${orgId}/courses`) });
  const assigned = useQuery({ queryKey: ['course-assignments', orgId], queryFn: () => api<CourseAssignment[]>(`/orgs/${orgId}/course-assignments`) });
  const [assigning, setAssigning] = useState<CollegeCourse | null>(null);

  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => patch(`/orgs/${orgId}/course-assignments/${id}`, body),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['course-assignments', orgId] }); },
    onError: (e) => toast.error(e.message),
  });

  if (courses.isLoading || assigned.isLoading) return <Loading />;
  if (courses.error) return <ErrorNote error={courses.error} />;
  if (assigned.error) return <ErrorNote error={assigned.error} />;
  const now = new Date();

  return (
    <>
      <PageHeader title="Courses" description="Give a Learn course — or a few of its chapters — to a batch, and follow each student's progress." />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assigned</h2>
      {assigned.data!.length === 0 ? (
        <div className="mb-8"><EmptyState title="No courses assigned yet">Pick a course below and give it to a batch with a due date.</EmptyState></div>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Course</th><th className="px-4 py-2.5 font-medium">Due</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Completed</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y">
              {assigned.data!.map((a) => {
                const late = a.dueAt && new Date(a.dueAt) < now;
                return (
                  <tr key={a.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      {can('reports.view') ? <Link to={a.id} className="font-medium hover:underline">{a.title}</Link> : <span className="font-medium">{a.title}</span>}
                      <p className="text-xs text-muted-foreground">{a.batchName}{a.sectionName ? ` · Section ${a.sectionName}` : ''} · {a.wholeCourse ? `whole course (${a.chapters} chapters)` : `${a.chapters} chapter${a.chapters === 1 ? '' : 's'}`}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{a.dueAt ? formatDateTime(a.dueAt) : 'No due date'}</td>
                    <td className="px-4 py-3">
                      {a.status === 'draft' ? <Badge variant="secondary">Draft</Badge> : late ? <Badge variant="outline">Past due</Badge> : <Badge>Assigned</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {a.completed}/{a.assigned}
                      {a.overdue > 0 && <p className="text-xs text-destructive">{a.overdue} overdue</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {author && a.status === 'draft' && <Button size="sm" onClick={() => change.mutate({ id: a.id, body: { status: 'published' } })}>Publish</Button>}
                      {author && <Button size="sm" variant="ghost" className="ml-1" onClick={() => change.mutate({ id: a.id, body: { status: 'archived' } })}>Remove</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Library</h2>
      {courses.data!.length === 0 ? (
        <EmptyState title="No courses available">Forge's public courses and your college's own published courses appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data!.map((c) => (
            <div key={c.id} className="flex flex-col rounded-lg border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{c.owner === 'forge' ? 'Forge' : 'Your college'}</Badge>
                {c.isPremium && <Badge variant="outline">{c.licensed ? 'Premium · licensed' : 'Premium'}</Badge>}
              </div>
              <p className="font-medium">{c.title}</p>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> {c.chapters} chapters · {hours(c.minutes)}</p>
              <div className="mt-auto pt-4">
                {!c.licensed ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Needs a Forge licence — ask Forge to add it to your plan.</p>
                ) : author && c.chapters > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => setAssigning(c)}>Assign to a batch</Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {assigning && (
        <AssignCourse course={assigning} orgId={orgId!} onClose={() => setAssigning(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['course-assignments', orgId] })} />
      )}
    </>
  );
}

function AssignCourse({ course, orgId, onClose, onCreated }: { course: CollegeCourse; orgId: string; onClose: () => void; onCreated: () => void }) {
  const detail = useQuery({ queryKey: ['course', orgId, course.id], queryFn: () => api<CollegeCourseDetail>(`/orgs/${orgId}/courses/${course.id}`) });
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`) });
  const settings = useQuery({ queryKey: ['org-settings', orgId], queryFn: () => api<{ defaults: CollegeDefaults }>(`/orgs/${orgId}/settings`) });
  const [batchId, setBatchId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [whole, setWhole] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const dueDays = settings.data?.defaults.courseDueDays ?? 14; // the college's default
  useEffect(() => {
    setDueAt(toLocalInput(new Date(Date.now() + dueDays * 86_400_000)));
  }, [dueDays]);
  const sections = (batches.data ?? []).find((b) => b.id === batchId)?.sections ?? [];
  const chapters = useMemo(() => detail.data?.chapterList ?? [], [detail.data]);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = useMutation({
    mutationFn: (publish: boolean) => post(`/orgs/${orgId}/course-assignments`, {
      batchId, sectionId: sectionId || null, courseId: course.id, title: title || undefined, instructions: instructions || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      chapterIds: whole ? null : chapters.filter((c) => picked.has(c.id)).map((c) => c.id), publish,
    }),
    onSuccess: (_d, publish) => { toast.success(publish ? 'Assigned — students see it in the Forge app' : 'Saved as draft'); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent, publish: boolean) => {
    e.preventDefault();
    if (!whole && picked.size === 0) { toast.error('Choose at least one chapter.'); return; }
    if (dueAt && new Date(dueAt) < new Date()) { toast.error('The due date is in the past.'); return; }
    create.mutate(publish);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Assign “{course.title}”</DialogTitle></DialogHeader>
        {(detail.isLoading || batches.isLoading) ? <Loading /> : detail.error ? <ErrorNote error={detail.error} /> : (
          <form onSubmit={(e) => submit(e, true)} className="space-y-4">
            <Field label="Batch" htmlFor="ca-batch">
              <select id="ca-batch" required value={batchId} onChange={(e) => { setBatchId(e.target.value); setSectionId(''); }} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                <option value="" disabled>Choose a batch</option>
                {(batches.data ?? []).filter((b) => b.status === 'active').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.studentCount} students)</option>)}
              </select>
            </Field>
            {sections.length > 0 && (
              <Field label="Section" htmlFor="ca-section">
                <select id="ca-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                  <option value="">Whole batch</option>
                  {sections.map((x) => <option key={x.id} value={x.id}>Section {x.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Title students see" htmlFor="ca-title">
              <Input id="ca-title" maxLength={200} value={title} placeholder={course.title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Due" htmlFor="ca-due" hint="Leave blank for no due date.">
              <Input id="ca-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>

            <fieldset className="space-y-2 rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">Chapters</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="ca-scope" checked={whole} onChange={() => setWhole(true)} /> The whole course ({chapters.length} chapters)</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="ca-scope" checked={!whole} onChange={() => setWhole(false)} /> Only some chapters</label>
              {!whole && (
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto border-t pt-2">
                  {chapters.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                      <span className="tabular text-muted-foreground">{c.number}.</span> {c.title}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <Field label="Note to students (optional)" htmlFor="ca-instr">
              <Textarea id="ca-instr" rows={2} maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={create.isPending} onClick={(e) => submit(e as unknown as FormEvent, false)}>Save as draft</Button>
              <Button type="submit" disabled={create.isPending}>Assign</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
