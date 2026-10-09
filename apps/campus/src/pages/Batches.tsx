import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, del, patch, post } from '@/api/client';
import type { Batch, Department, Member, UnitKind } from '@/api/types';
import { EmptyState, ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useOrg } from '@/context/CampusContext';

export default function Batches() {
  const { orgId } = useParams();
  const { can } = useOrg(orgId);
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const batches = useQuery({ queryKey: ['batches', orgId], queryFn: () => api<Batch[]>(`/orgs/${orgId}/batches`) });
  const departments = useQuery({ queryKey: ['departments', orgId], queryFn: () => api<Department[]>(`/orgs/${orgId}/departments`) });

  if (batches.isLoading) return <Loading />;
  if (batches.error) return <ErrorNote error={batches.error} />;

  return (
    <>
      <PageHeader
        title="Batches"
        description="Groups of students who take tests together, such as a year of a branch. Split a batch into sections when classes are taught separately."
        actions={can('batches.manage') && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New batch</Button>}
      />

      {batches.data!.length === 0 ? (
        <EmptyState title="No batches yet" action={can('batches.manage') && <Button variant="outline" onClick={() => setCreating(true)}>Create the first batch</Button>}>
          Create batches, then put their names in the Batch column of your roster so students land in the right one.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {batches.data!.map((b) => (
            <li key={b.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50" aria-expanded={open === b.id}
                onClick={() => setOpen(open === b.id ? null : b.id)}>
                {open === b.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[b.departmentName, b.academicYear, b.graduationYear && `Class of ${b.graduationYear}`].filter(Boolean).join(' · ') || 'No department'}
                  </p>
                </div>
                {b.sections.length > 0 && <span className="hidden text-xs text-muted-foreground sm:inline">Sections {b.sections.map((x) => x.name).join(', ')}</span>}
                <span className="text-sm tabular text-muted-foreground">{b.studentCount} {b.studentCount === 1 ? 'student' : 'students'}</span>
              </button>
              {open === b.id && <BatchMembers orgId={orgId!} batch={b} canManage={can('batches.manage')} />}
            </li>
          ))}
        </ul>
      )}

      {can('batches.manage') && <Departments orgId={orgId!} departments={departments.data ?? []} />}

      <NewBatch open={creating} onClose={() => setCreating(false)} orgId={orgId!} departments={departments.data ?? []}
        onCreated={() => qc.invalidateQueries({ queryKey: ['batches', orgId] })} />
    </>
  );
}

function BatchMembers({ orgId, batch, canManage }: { orgId: string; batch: Batch; canManage: boolean }) {
  const qc = useQueryClient();
  const batchId = batch.id;
  const members = useQuery({
    queryKey: ['batch-members', batchId],
    queryFn: () => api<Array<Pick<Member, 'userId' | 'rollNumber' | 'fullName' | 'email'> & { sectionId: string | null }>>(`/orgs/${orgId}/batches/${batchId}/members`),
  });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newSection, setNewSection] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['batch-members', batchId] }); qc.invalidateQueries({ queryKey: ['batches', orgId] }); };
  const fail = (e: Error) => toast.error(e.message);
  const addSection = useMutation({
    mutationFn: () => post(`/orgs/${orgId}/batches/${batchId}/sections`, { name: newSection }),
    onSuccess: () => { toast.success(`Section ${newSection} added`); setNewSection(''); refresh(); }, onError: fail,
  });
  const renameSection = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => patch(`/orgs/${orgId}/batches/${batchId}/sections/${id}`, { name }),
    onSuccess: () => { toast.success('Renamed'); refresh(); }, onError: fail,
  });
  const removeSection = useMutation({
    mutationFn: (id: string) => del(`/orgs/${orgId}/batches/${batchId}/sections/${id}`),
    onSuccess: () => { toast.success('Section removed'); refresh(); }, onError: fail,
  });
  const move = useMutation({
    mutationFn: (sectionId: string | null) => patch(`/orgs/${orgId}/batches/${batchId}/members`, { userIds: [...picked], sectionId }),
    onSuccess: () => { toast.success('Moved'); setPicked(new Set()); refresh(); }, onError: fail,
  });

  if (members.isLoading) return <div className="px-11 pb-3"><Loading /></div>;
  if (members.error) return <div className="px-11 pb-3"><ErrorNote error={members.error} /></div>;
  const sectionName = new Map(batch.sections.map((x) => [x.id, x.name]));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-4 px-11 pb-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sections:</span>
        {batch.sections.length === 0 && <span className="text-muted-foreground">none — tests go to the whole batch</span>}
        {batch.sections.map((x) => (
          <span key={x.id} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
            <span className="font-medium">{x.name}</span> <span className="text-xs text-muted-foreground">{x.students}</span>
            {canManage && (
              <>
                <button aria-label={`Rename section ${x.name}`} className="text-muted-foreground hover:text-foreground"
                  onClick={() => { const name = window.prompt('Section name', x.name)?.trim(); if (name && name !== x.name) renameSection.mutate({ id: x.id, name }); }}>
                  <Pencil className="h-3 w-3" />
                </button>
                <button aria-label={`Remove section ${x.name}`} className="text-muted-foreground hover:text-destructive"
                  onClick={() => { if (window.confirm(`Remove section ${x.name}? Its students stay in the batch.`)) removeSection.mutate(x.id); }}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </span>
        ))}
        {canManage && (
          <form className="inline-flex gap-1" onSubmit={(e) => { e.preventDefault(); if (newSection.trim()) addSection.mutate(); }}>
            <Input aria-label="New section name" value={newSection} maxLength={60} onChange={(e) => setNewSection(e.target.value)} placeholder="e.g. A" className="h-8 w-24" />
            <Button size="sm" variant="outline" type="submit" disabled={addSection.isPending}>Add section</Button>
          </form>
        )}
      </div>

      {members.data!.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students yet. Students join this batch when they claim a roster entry that names it.</p>
      ) : (
        <>
          {canManage && batch.sections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{picked.size ? `${picked.size} selected — move to` : 'Select students to move them between sections'}</span>
              {picked.size > 0 && batch.sections.map((x) => (
                <Button key={x.id} size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate(x.id)}>Section {x.name}</Button>
              ))}
              {picked.size > 0 && <Button size="sm" variant="ghost" disabled={move.isPending} onClick={() => move.mutate(null)}>No section</Button>}
            </div>
          )}
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {members.data!.map((m) => (
              <li key={m.userId} className="flex items-center gap-2">
                {canManage && batch.sections.length > 0 && (
                  <input type="checkbox" aria-label={`Select ${m.fullName ?? m.email}`} checked={picked.has(m.userId)} onChange={() => toggle(m.userId)} />
                )}
                <span className="w-20 shrink-0 tabular text-muted-foreground">{m.rollNumber ?? '—'}</span>
                <span className="truncate">{m.fullName ?? m.email}</span>
                {m.sectionId && <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 text-xs">{sectionName.get(m.sectionId)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NewBatch({ open, onClose, orgId, departments, onCreated }: {
  open: boolean; onClose: () => void; orgId: string; departments: Department[]; onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const create = useMutation({
    mutationFn: () => post(`/orgs/${orgId}/batches`, {
      name, departmentId: departmentId || null, graduationYear: graduationYear ? Number(graduationYear) : null,
    }),
    onSuccess: () => { toast.success('Batch created'); onCreated(); onClose(); setName(''); setDepartmentId(''); setGraduationYear(''); },
    onError: (e) => toast.error(e.message),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New batch</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="batch-name" hint="Use the exact name your roster will use, e.g. CSE-2027-A.">
            <Input id="batch-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Department" htmlFor="batch-dept">
            <select id="batch-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </Field>
          <Field label="Graduation year" htmlFor="batch-year">
            <Input id="batch-year" type="number" min={2000} max={2100} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create batch</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const KIND_LABEL: Record<UnitKind, string> = { school: 'School', department: 'Department', branch: 'Branch' };

/** Schools, departments and branches as a tree (e.g. School of Engineering → CSE → CSE AI & ML). */
function Departments({ orgId, departments }: { orgId: string; departments: Department[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<UnitKind>('department');
  const [parentId, setParentId] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['departments', orgId] });
  const add = useMutation({
    mutationFn: () => post(`/orgs/${orgId}/departments`, { name, code, kind, parentId: parentId || null }),
    onSuccess: () => { toast.success(`${KIND_LABEL[kind]} added`); setName(''); setCode(''); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => patch(`/orgs/${orgId}/departments/${id}`, body),
    onSuccess: () => { toast.success('Saved'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/orgs/${orgId}/departments/${id}`),
    onSuccess: () => { toast.success('Removed'); refresh(); qc.invalidateQueries({ queryKey: ['batches', orgId] }); },
    onError: (e) => toast.error(e.message),
  });

  const children = (pid: string | null) => departments.filter((d) => d.parentId === pid).sort((a, b) => a.name.localeCompare(b.name));
  const render = (d: Department, depth: number): JSX.Element => (
    <li key={d.id}>
      <div className="flex flex-wrap items-center gap-2 py-1.5 text-sm" style={{ paddingLeft: depth * 20 }}>
        <span className="rounded bg-secondary px-1.5 text-xs text-muted-foreground">{KIND_LABEL[d.kind]}</span>
        <span className="font-medium">{d.name}</span> <span className="text-muted-foreground">{d.code}</span>
        <span className="text-xs text-muted-foreground">· {d.students} students · {d.batches} batches</span>
        <select aria-label={`Parent of ${d.name}`} value={d.parentId ?? ''} className="ml-auto rounded-md border bg-card px-2 py-1 text-xs"
          onChange={(e) => change.mutate({ id: d.id, body: { parentId: e.target.value || null } })}>
          <option value="">Top level</option>
          {departments.filter((x) => x.id !== d.id).map((x) => <option key={x.id} value={x.id}>Inside {x.name}</option>)}
        </select>
        <button aria-label={`Remove ${d.name}`} className="text-muted-foreground hover:text-destructive"
          onClick={() => { if (window.confirm(`Remove ${d.name}? People and batches in it stay, without a unit.`)) remove.mutate(d.id); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children(d.id).length > 0 && <ul>{children(d.id).map((c) => render(c, depth + 1))}</ul>}
    </li>
  );

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Schools, departments and branches</h2>
      <p className="mt-1 text-sm text-muted-foreground">Rosters refer to a unit by its code or name. Nest units to match your college, up to four levels.</p>
      {departments.length > 0 && <ul className="mt-3 rounded-lg border bg-card px-4 py-2">{children(null).map((d) => render(d, 0))}</ul>}
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Field label="Kind" htmlFor="dept-kind">
          <select id="dept-kind" value={kind} onChange={(e) => setKind(e.target.value as UnitKind)} className="block rounded-md border bg-card px-3 py-2 text-sm">
            <option value="school">School</option><option value="department">Department</option><option value="branch">Branch</option>
          </select>
        </Field>
        <Field label="Name" htmlFor="dept-name"><Input id="dept-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Computer Science" /></Field>
        <Field label="Code" htmlFor="dept-code"><Input id="dept-code" required maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} placeholder="CSE" className="w-28" /></Field>
        <Field label="Inside" htmlFor="dept-parent">
          <select id="dept-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="block rounded-md border bg-card px-3 py-2 text-sm">
            <option value="">Top level</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Button type="submit" variant="outline" disabled={add.isPending}>Add</Button>
      </form>
    </section>
  );
}
