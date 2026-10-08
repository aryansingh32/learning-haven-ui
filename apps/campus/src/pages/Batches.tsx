import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { api, post } from '@/api/client';
import type { Batch, Department, Member } from '@/api/types';
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
        description="Groups of students who take tests together, such as a section or a year."
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
                <span className="text-sm tabular text-muted-foreground">{b.studentCount} {b.studentCount === 1 ? 'student' : 'students'}</span>
              </button>
              {open === b.id && <BatchMembers orgId={orgId!} batchId={b.id} />}
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

function BatchMembers({ orgId, batchId }: { orgId: string; batchId: string }) {
  const members = useQuery({
    queryKey: ['batch-members', batchId],
    queryFn: () => api<Array<Pick<Member, 'userId' | 'rollNumber' | 'fullName' | 'email'>>>(`/orgs/${orgId}/batches/${batchId}/members`),
  });
  if (members.isLoading) return <div className="px-11 pb-3"><Loading /></div>;
  if (members.error) return <div className="px-11 pb-3"><ErrorNote error={members.error} /></div>;
  if (members.data!.length === 0) return <p className="px-11 pb-4 text-sm text-muted-foreground">No students yet. Students join this batch when they claim a roster entry that names it.</p>;
  return (
    <ul className="grid gap-x-6 gap-y-1 px-11 pb-4 text-sm sm:grid-cols-2">
      {members.data!.map((m) => (
        <li key={m.userId} className="flex gap-2"><span className="w-20 shrink-0 tabular text-muted-foreground">{m.rollNumber ?? '—'}</span><span className="truncate">{m.fullName ?? m.email}</span></li>
      ))}
    </ul>
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

function Departments({ orgId, departments }: { orgId: string; departments: Department[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const add = useMutation({
    mutationFn: () => post(`/orgs/${orgId}/departments`, { name, code }),
    onSuccess: () => { toast.success('Department added'); setName(''); setCode(''); qc.invalidateQueries({ queryKey: ['departments', orgId] }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Departments</h2>
      <p className="mt-1 text-sm text-muted-foreground">Rosters can refer to a department by its code or its name.</p>
      {departments.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {departments.map((d) => <li key={d.id} className="rounded-md border bg-card px-3 py-1.5 text-sm"><span className="font-medium">{d.code}</span> · {d.name}</li>)}
        </ul>
      )}
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Field label="Name" htmlFor="dept-name"><Input id="dept-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Computer Science" /></Field>
        <Field label="Code" htmlFor="dept-code"><Input id="dept-code" required maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} placeholder="CSE" className="w-28" /></Field>
        <Button type="submit" variant="outline" disabled={add.isPending}>Add department</Button>
      </form>
    </section>
  );
}
