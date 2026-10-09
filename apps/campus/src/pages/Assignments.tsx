import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Radio } from 'lucide-react';
import { api, patch, post } from '@/api/client';
import type { Assignment, Batch, TestSummary } from '@/api/types';
import { EmptyState, ErrorNote, Field, formatDateTime, Loading, PageHeader, toLocalInput } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { assignmentState } from './Overview';
import { useOrg } from '@/context/CampusContext';

export default function Assignments() {
  const { orgId } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const creating = params.get('new') === '1';
  const setCreating = (v: boolean) => setParams(v ? { new: '1' } : {}, { replace: true });
  const assignments = useQuery({ queryKey: ['assignments', orgId], queryFn: () => api<Assignment[]>(`/orgs/${orgId}/assignments`) });
  const { can } = useOrg(orgId);
  const author = can('assessments.create');
  const watcher = can('assessments.invigilate') || can('reports.view');

  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => patch(`/orgs/${orgId}/assignments/${id}`, body),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['assignments', orgId] }); },
    onError: (e) => toast.error(e.message),
  });

  if (assignments.isLoading) return <Loading />;
  if (assignments.error) return <ErrorNote error={assignments.error} />;
  const now = new Date();

  return (
    <>
      <PageHeader title="Assignments" description="Tests given to a batch, with a time window and exam rules."
        actions={author && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New assignment</Button>} />

      {assignments.data!.length === 0 ? (
        <EmptyState title="Nothing assigned yet" action={author && <Button variant="outline" onClick={() => setCreating(true)}>Assign a test</Button>}>
          Pick a test and a batch, set when it opens and closes, and choose the exam rules.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Assignment</th><th className="px-4 py-2.5 font-medium">Window</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Submitted</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y">
              {assignments.data!.map((a) => {
                const state = assignmentState(a, now);
                const closed = now >= new Date(a.closesAt);
                return (
                  <tr key={a.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link to={can('reports.view') ? a.id : `${a.id}/live`} className="font-medium hover:underline">{a.title}</Link>
                      <p className="text-xs text-muted-foreground">{a.batchName} · {a.testTitle ?? 'Test'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(a.opensAt)} – {formatDateTime(a.closesAt)}</td>
                    <td className="px-4 py-3"><Badge variant={state.variant}>{state.label}</Badge></td>
                    <td className="px-4 py-3 text-right tabular">{a.submitted}/{a.assigned}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {watcher && a.status === 'published' && !closed && now >= new Date(a.opensAt) && (
                        <Button size="sm" variant="default" className="mr-2" asChild>
                          <Link to={`${a.id}/live`}><Radio className="mr-1.5 h-3.5 w-3.5" /> Live</Link>
                        </Button>
                      )}
                      {author && a.status === 'draft' && <Button size="sm" onClick={() => change.mutate({ id: a.id, body: { status: 'published' } })}>Publish</Button>}
                      {author && a.status === 'published' && !closed && now >= new Date(a.opensAt) && (
                        <Button size="sm" variant="outline" onClick={() => change.mutate({ id: a.id, body: { closesAt: new Date().toISOString() } })}>Close now</Button>
                      )}
                      {author && a.resultRelease === 'manual' && !a.resultsReleasedAt && a.status === 'published' && (
                        <Button size="sm" variant="outline" className="ml-2" onClick={() => change.mutate({ id: a.id, body: { releaseResults: true } })}>Release results</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewAssignment open={creating} onClose={() => setCreating(false)} orgId={orgId!}
        onCreated={() => qc.invalidateQueries({ queryKey: ['assignments', orgId] })} />
    </>
  );
}

function NewAssignment({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const tests = useQuery({ queryKey: ['tests', orgId], queryFn: () => api<TestSummary[]>(`/orgs/${orgId}/tests`), enabled: open });
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`), enabled: open });

  const [testId, setTestId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [duration, setDuration] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [shuffle, setShuffle] = useState(true);
  const [release, setRelease] = useState<'immediately' | 'after_close' | 'manual'>('after_close');
  const [proctored, setProctored] = useState(true);
  const [maxViolations, setMaxViolations] = useState('3');

  useEffect(() => {
    if (!open) return;
    const start = new Date(Math.ceil(Date.now() / 900_000) * 900_000); // next quarter hour
    setOpensAt(toLocalInput(start));
    setClosesAt(toLocalInput(new Date(start.getTime() + 2 * 3_600_000)));
  }, [open]);

  const usable = (tests.data ?? []).filter((t) => t.questionCount > 0 && (t.source === 'forge' || t.published));
  const chosen = usable.find((t) => t.id === testId);

  const create = useMutation({
    mutationFn: (publish: boolean) => post(`/orgs/${orgId}/assignments`, {
      testId, batchId, title: title || chosen?.title, instructions: instructions || null,
      opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString(),
      durationMinutes: duration ? Number(duration) : null, maxAttempts: Number(maxAttempts),
      shuffleQuestions: shuffle, shuffleOptions: shuffle, resultRelease: release, publish,
      proctoring: { enabled: proctored, requireFullscreen: proctored, blockClipboard: proctored, warnFirst: true, maxViolations: proctored ? Number(maxViolations) : null },
    }),
    onSuccess: (_d, publish) => { toast.success(publish ? 'Assigned — students will see it when it opens' : 'Saved as draft'); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent, publish: boolean) => {
    e.preventDefault();
    if (new Date(closesAt) <= new Date(opensAt)) { toast.error('The test must close after it opens.'); return; }
    create.mutate(publish);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
        {(tests.isLoading || batches.isLoading) ? <Loading /> : (
          <form onSubmit={(e) => submit(e, true)} className="space-y-4">
            <Field label="Test" htmlFor="as-test" hint={usable.length === 0 ? 'Publish a test with questions first, or use one from the Forge library.' : undefined}>
              <select id="as-test" required value={testId} onChange={(e) => setTestId(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                <option value="" disabled>Choose a test</option>
                {usable.map((t) => <option key={t.id} value={t.id}>{t.source === 'forge' ? 'Forge · ' : ''}{t.title} ({t.questionCount} Q, {t.durationMinutes} min)</option>)}
              </select>
            </Field>
            <Field label="Batch" htmlFor="as-batch">
              <select id="as-batch" required value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                <option value="" disabled>Choose a batch</option>
                {(batches.data ?? []).filter((b) => b.status === 'active').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.studentCount} students)</option>)}
              </select>
            </Field>
            <Field label="Title students see" htmlFor="as-title">
              <Input id="as-title" maxLength={200} value={title} placeholder={chosen?.title ?? 'e.g. Week 3 — Arrays'} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens" htmlFor="as-open"><Input id="as-open" type="datetime-local" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></Field>
              <Field label="Closes" htmlFor="as-close"><Input id="as-close" type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time limit (minutes)" htmlFor="as-dur" hint={chosen ? `Leave blank to use the test's ${chosen.durationMinutes} min.` : undefined}>
                <Input id="as-dur" type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
              <Field label="Attempts allowed" htmlFor="as-att">
                <Input id="as-att" type="number" min={1} max={10} required value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
              </Field>
            </div>
            <Field label="Show results" htmlFor="as-release">
              <select id="as-release" value={release} onChange={(e) => setRelease(e.target.value as typeof release)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                <option value="after_close">After the test closes</option>
                <option value="immediately">Right after each student submits</option>
                <option value="manual">When I release them</option>
              </select>
            </Field>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="as-shuffle" className="text-sm"><span className="font-medium">Shuffle questions and options</span><br /><span className="text-muted-foreground">Each student gets a different order.</span></label>
                <Switch id="as-shuffle" checked={shuffle} onCheckedChange={setShuffle} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="as-proctor" className="text-sm"><span className="font-medium">Lockdown mode</span><br /><span className="text-muted-foreground">Full screen, no copy or paste, and leaving the test is recorded. The first time is a warning.</span></label>
                <Switch id="as-proctor" checked={proctored} onCheckedChange={setProctored} />
              </div>
              {proctored && (
                <Field label="Auto-submit after this many violations" htmlFor="as-viol">
                  <Input id="as-viol" type="number" min={1} max={50} value={maxViolations} onChange={(e) => setMaxViolations(e.target.value)} className="w-24" />
                </Field>
              )}
            </div>

            <Field label="Instructions (optional)" htmlFor="as-instr">
              <Textarea id="as-instr" rows={2} maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
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
