import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Plus, Trash2 } from 'lucide-react';
import { api, del, download, patch, post } from '@/api/client';
import type { Assignment, Batch, Department, Drive, DriveDecision, DriveStudent } from '@/api/types';
import { EmptyState, ErrorNote, Field, formatDateTime, Loading, PageHeader, Stat, toLocalInput } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useOrg } from '@/context/CampusContext';

const STATUS: Record<Drive['status'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' }, open: { label: 'Open', variant: 'default' },
  closed: { label: 'Closed', variant: 'secondary' }, archived: { label: 'Archived', variant: 'outline' },
};
const DECISION: Record<DriveDecision, string> = {
  registered: 'Applied', shortlisted: 'Shortlisted', selected: 'Selected', rejected: 'Not taken forward', withdrawn: 'Withdrew',
};

/** Company drives: who may apply, who applied, who moves on. */
export default function Placements() {
  const { orgId, driveId } = useParams();
  return driveId ? <DriveDetail orgId={orgId!} driveId={driveId} /> : <DriveList orgId={orgId!} />;
}

function DriveList({ orgId }: { orgId: string }) {
  const { can } = useOrg(orgId);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const drives = useQuery({ queryKey: ['drives', orgId], queryFn: () => api<Drive[]>(`/orgs/${orgId}/drives`) });
  if (drives.isLoading) return <Loading />;
  if (drives.error) return <ErrorNote error={drives.error} />;
  const manage = can('placements.manage');
  return (
    <>
      <PageHeader title="Placements" description="Company drives: eligibility, applications, rounds and results. Eligible students are told when a drive opens."
        actions={manage && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New drive</Button>} />
      {drives.data!.length === 0 ? (
        <EmptyState title="No drives yet" action={manage && <Button variant="outline" onClick={() => setCreating(true)}>Add the first drive</Button>}>
          Add a company, say who may apply (batches, CGPA, backlogs, departments) and open it.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Company</th><th className="px-4 py-2.5 font-medium">Apply by</th><th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Eligible</th><th className="px-4 py-2.5 text-right font-medium">Applied</th>
                <th className="px-4 py-2.5 text-right font-medium">Shortlisted</th><th className="px-4 py-2.5 text-right font-medium">Selected</th></tr>
            </thead>
            <tbody className="divide-y">
              {drives.data!.map((d) => (
                <tr key={d.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Link to={d.id} className="font-medium hover:underline">{d.company}</Link>
                    <p className="text-xs text-muted-foreground">{d.roleTitle}{d.ctc ? ` · ${d.ctc}` : ''}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(d.applyBy)}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge></td>
                  <td className="px-4 py-3 text-right tabular">{d.eligible}</td><td className="px-4 py-3 text-right tabular">{d.registered}</td>
                  <td className="px-4 py-3 text-right tabular">{d.shortlisted}</td><td className="px-4 py-3 text-right tabular">{d.selected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewDrive orgId={orgId} onClose={() => setCreating(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['drives', orgId] })} />}
    </>
  );
}

function NewDrive({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`) });
  const departments = useQuery({ queryKey: ['departments', orgId], queryFn: () => api<Department[]>(`/orgs/${orgId}/departments`) });
  const [f, setF] = useState({ company: '', roleTitle: '', ctc: '', location: '', jobType: 'full_time', description: '',
    applyBy: toLocalInput(new Date(Date.now() + 5 * 86_400_000)), minCgpa: '', maxBacklogs: '', minTenth: '', minTwelfth: '' });
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const create = useMutation({
    mutationFn: (open: boolean) => post(`/orgs/${orgId}/drives`, {
      company: f.company, roleTitle: f.roleTitle, ctc: f.ctc || null, location: f.location || null, jobType: f.jobType,
      description: f.description || null, applyBy: f.applyBy ? new Date(f.applyBy).toISOString() : null, batchIds, open,
      eligibility: Object.fromEntries(Object.entries({ minCgpa: num(f.minCgpa), maxBacklogs: num(f.maxBacklogs), minTenth: num(f.minTenth),
        minTwelfth: num(f.minTwelfth), departmentIds: deptIds.length ? deptIds : undefined }).filter(([, v]) => v !== undefined)),
    }),
    onSuccess: (_r, open) => { toast.success(open ? 'Drive opened — eligible students have been told' : 'Saved as draft'); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = (e: FormEvent, open: boolean) => { e.preventDefault(); create.mutate(open); };
  const check = (list: string[], setList: (x: string[]) => void, id: string, on: boolean) => setList(on ? [...list, id] : list.filter((x) => x !== id));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>New placement drive</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => submit(e, true)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" htmlFor="d-company"><Input id="d-company" required value={f.company} onChange={set('company')} /></Field>
            <Field label="Role" htmlFor="d-role"><Input id="d-role" required value={f.roleTitle} onChange={set('roleTitle')} placeholder="Graduate Engineer Trainee" /></Field>
            <Field label="CTC / stipend" htmlFor="d-ctc"><Input id="d-ctc" value={f.ctc} onChange={set('ctc')} placeholder="6.5 LPA" /></Field>
            <Field label="Location" htmlFor="d-loc"><Input id="d-loc" value={f.location} onChange={set('location')} placeholder="Chennai / remote" /></Field>
            <Field label="Type" htmlFor="d-type">
              <select id="d-type" value={f.jobType} onChange={set('jobType')} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
                <option value="full_time">Full time</option><option value="internship">Internship</option><option value="internship_ppo">Internship + PPO</option>
              </select>
            </Field>
            <Field label="Apply by" htmlFor="d-apply"><Input id="d-apply" type="datetime-local" value={f.applyBy} onChange={set('applyBy')} /></Field>
          </div>
          <Field label="About the role (optional)" htmlFor="d-desc"><Textarea id="d-desc" rows={3} value={f.description} onChange={set('description')} /></Field>
          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Who may apply</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-muted-foreground">Batches (none = all):</span>
              {(batches.data ?? []).map((b) => (
                <label key={b.id} className="flex items-center gap-1.5"><input type="checkbox" checked={batchIds.includes(b.id)} onChange={(e) => check(batchIds, setBatchIds, b.id, e.target.checked)} /> {b.name}</label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Min CGPA" htmlFor="d-cgpa"><Input id="d-cgpa" type="number" step="0.1" min={0} max={10} value={f.minCgpa} onChange={set('minCgpa')} /></Field>
              <Field label="Max backlogs" htmlFor="d-back"><Input id="d-back" type="number" min={0} value={f.maxBacklogs} onChange={set('maxBacklogs')} /></Field>
              <Field label="Min 10th %" htmlFor="d-10"><Input id="d-10" type="number" min={0} max={100} value={f.minTenth} onChange={set('minTenth')} /></Field>
              <Field label="Min 12th %" htmlFor="d-12"><Input id="d-12" type="number" min={0} max={100} value={f.minTwelfth} onChange={set('minTwelfth')} /></Field>
            </div>
            {(departments.data ?? []).length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-muted-foreground">Departments (none = any):</span>
                {departments.data!.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5"><input type="checkbox" checked={deptIds.includes(d.id)} onChange={(e) => check(deptIds, setDeptIds, d.id, e.target.checked)} /> {d.code}</label>
                ))}
              </div>
            )}
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={create.isPending} onClick={(e) => submit(e as unknown as FormEvent, false)}>Save as draft</Button>
            <Button type="submit" disabled={create.isPending}>Open applications</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DriveDetail({ orgId, driveId }: { orgId: string; driveId: string }) {
  const { can } = useOrg(orgId);
  const qc = useQueryClient();
  const manage = can('placements.manage');
  const drives = useQuery({ queryKey: ['drives', orgId], queryFn: () => api<Drive[]>(`/orgs/${orgId}/drives`) });
  const students = useQuery({ queryKey: ['drive-students', driveId], queryFn: () => api<{ rows: DriveStudent[] }>(`/orgs/${orgId}/drives/${driveId}/students`) });
  const assignments = useQuery({ queryKey: ['assignments', orgId], queryFn: () => api<Assignment[]>(`/orgs/${orgId}/assignments`), enabled: manage });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'applied' | 'all'>('applied');
  const [round, setRound] = useState({ name: '', kind: 'test', assignmentId: '', scheduledAt: '' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['drives', orgId] }); qc.invalidateQueries({ queryKey: ['drive-students', driveId] }); };
  const fail = (e: Error) => toast.error(e.message);
  const setStatus = useMutation({ mutationFn: (status: Drive['status']) => patch(`/orgs/${orgId}/drives/${driveId}`, { status }),
    onSuccess: (_r, s) => { toast.success(s === 'open' ? 'Opened — eligible students have been told' : 'Saved'); refresh(); }, onError: fail });
  const decide = useMutation({ mutationFn: (status: DriveDecision) => post<{ changed: number }>(`/orgs/${orgId}/drives/${driveId}/decisions`, { userIds: [...picked], status }),
    onSuccess: (r) => { toast.success(`${r.changed} updated — they've been notified`); setPicked(new Set()); refresh(); }, onError: fail });
  const addRound = useMutation({ mutationFn: () => post(`/orgs/${orgId}/drives/${driveId}/rounds`, {
    name: round.name, kind: round.kind, assignmentId: round.assignmentId || null, scheduledAt: round.scheduledAt ? new Date(round.scheduledAt).toISOString() : null }),
    onSuccess: () => { setRound({ name: '', kind: 'test', assignmentId: '', scheduledAt: '' }); refresh(); }, onError: fail });
  const removeRound = useMutation({ mutationFn: (id: string) => del(`/orgs/${orgId}/drives/${driveId}/rounds/${id}`), onSuccess: refresh, onError: fail });

  if (drives.isLoading || students.isLoading) return <Loading />;
  if (drives.error) return <ErrorNote error={drives.error} />;
  const d = drives.data!.find((x) => x.id === driveId);
  if (!d) return <ErrorNote error={new Error('Drive not found.')} />;
  const rows = (students.data?.rows ?? []).filter((r) => filter === 'all' || (r.status && r.status !== 'withdrawn'));
  const showCgpa = rows.some((r) => r.cgpa !== undefined);
  async function exportCsv() {
    try { await download(`/orgs/${orgId}/drives/${driveId}/students?format=csv`, 'applicants.csv'); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Placements</Link>
      <PageHeader title={`${d.company} · ${d.roleTitle}`} description={[d.ctc, d.location, d.applyBy && `apply by ${formatDateTime(d.applyBy)}`].filter(Boolean).join(' · ')}
        actions={<>
          <Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge>
          {manage && d.status === 'draft' && <Button onClick={() => setStatus.mutate('open')}>Open applications</Button>}
          {manage && d.status === 'open' && <Button variant="outline" onClick={() => setStatus.mutate('closed')}>Close applications</Button>}
          {can('reports.export') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Applicants CSV</Button>}
        </>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Eligible" value={d.eligible} /><Stat label="Applied" value={d.registered} />
        <Stat label="Shortlisted" value={d.shortlisted} /><Stat label="Selected" value={d.selected} />
      </div>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="mb-2 font-semibold">Rounds</h2>
        {d.rounds.length === 0 ? <p className="text-sm text-muted-foreground">No rounds yet. A round can be one of your college tests — assign it to the batch with these eligibility rules.</p> : (
          <ol className="space-y-1 text-sm">
            {d.rounds.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-1.5">
                <span>{i + 1}. {r.name} <span className="text-muted-foreground">· {r.kind.replace('_', ' ')}{r.scheduledAt ? ` · ${formatDateTime(r.scheduledAt)}` : ''}</span>
                  {r.assignmentId && <Link to={`../../assignments/${r.assignmentId}`} relative="path" className="ml-2 text-primary hover:underline">results</Link>}</span>
                {manage && <button aria-label={`Remove round ${r.name}`} onClick={() => removeRound.mutate(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ol>
        )}
        {manage && (
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (round.name.trim()) addRound.mutate(); }}>
            <Field label="Round" htmlFor="r-name"><Input id="r-name" value={round.name} onChange={(e) => setRound({ ...round, name: e.target.value })} placeholder="Online assessment" /></Field>
            <Field label="Kind" htmlFor="r-kind">
              <select id="r-kind" value={round.kind} onChange={(e) => setRound({ ...round, kind: e.target.value })} className="block rounded-md border bg-card px-3 py-2 text-sm">
                <option value="test">Test</option><option value="interview">Interview</option><option value="group_discussion">Group discussion</option><option value="other">Other</option>
              </select>
            </Field>
            {round.kind === 'test' && (
              <Field label="College test" htmlFor="r-test">
                <select id="r-test" value={round.assignmentId} onChange={(e) => setRound({ ...round, assignmentId: e.target.value })} className="block max-w-56 rounded-md border bg-card px-3 py-2 text-sm">
                  <option value="">None yet</option>
                  {(assignments.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </Field>
            )}
            <Field label="When" htmlFor="r-when"><Input id="r-when" type="datetime-local" value={round.scheduledAt} onChange={(e) => setRound({ ...round, scheduledAt: e.target.value })} /></Field>
            <Button type="submit" variant="outline" disabled={addRound.isPending}>Add round</Button>
          </form>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Students</h2>
          <div className="flex gap-1 text-sm" role="tablist" aria-label="Show">
            {([['applied', 'Applied'], ['all', 'Everyone eligible']] as const).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
                className={`rounded-md px-3 py-1 ${filter === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}>{l}</button>
            ))}
          </div>
          {manage && picked.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2 text-sm" role="toolbar" aria-label="Decide">
              <span>{picked.size} selected →</span>
              <Button size="sm" variant="outline" onClick={() => decide.mutate('shortlisted')} disabled={decide.isPending}>Shortlist</Button>
              <Button size="sm" onClick={() => decide.mutate('selected')} disabled={decide.isPending}>Select</Button>
              <Button size="sm" variant="ghost" onClick={() => decide.mutate('rejected')} disabled={decide.isPending}>Not taken forward</Button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{manage && <th className="w-8 px-3 py-2.5" />}<th className="px-4 py-2.5 font-medium">Student</th><th className="px-4 py-2.5 font-medium">Department</th>
                {showCgpa && <th className="px-4 py-2.5 text-right font-medium">CGPA</th>}<th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Applied</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{filter === 'applied' ? 'Nobody has applied yet.' : 'Nobody meets the rules.'}</td></tr>}
              {rows.map((r) => (
                <tr key={r.userId}>
                  {manage && <td className="px-3 py-2.5">{r.status && r.status !== 'withdrawn' && (
                    <input type="checkbox" aria-label={`Select ${r.name ?? r.email}`} checked={picked.has(r.userId)}
                      onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(r.userId)) n.delete(r.userId); else n.add(r.userId); return n; })} />)}</td>}
                  <td className="px-4 py-2.5"><p className="font-medium">{r.name ?? r.email}</p><p className="text-xs text-muted-foreground">{r.rollNumber ?? r.email}</p></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.department ?? '—'}</td>
                  {showCgpa && <td className="px-4 py-2.5 text-right tabular">{r.cgpa ?? '—'}{r.backlogs ? <span className="block text-xs text-muted-foreground">{r.backlogs} backlogs</span> : null}</td>}
                  <td className="px-4 py-2.5">{r.status ? <Badge variant={r.status === 'selected' ? 'default' : r.status === 'shortlisted' ? 'secondary' : 'outline'}>{DECISION[r.status]}</Badge> : <span className="text-muted-foreground">Not applied</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(r.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
