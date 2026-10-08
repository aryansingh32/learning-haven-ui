import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileUp, Search } from 'lucide-react';
import { api, ApiError, patch, post } from '@/api/client';
import type { Member, Role, RosterEntry, RosterIssue, RosterPreview } from '@/api/types';
import { ROLE_LABEL } from '@/api/types';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCampus, useOrg } from '@/context/CampusContext';

const TEMPLATE = 'Email,Name,Roll No,Department,Batch,Role\nstudent@college.edu,Priya Rao,21CS001,CSE,CSE-2027-A,student\nfaculty@college.edu,Dr. Mehta,,CSE,,faculty\n';
const ASSIGNABLE: Role[] = ['admin', 'placement_officer', 'faculty', 'evaluator', 'invigilator', 'student'];

export default function People() {
  const { orgId } = useParams();
  const { can } = useOrg(orgId);
  return (
    <>
      <PageHeader title="People" description="Students and staff in your college. Add people by uploading a roster." />
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {can('members.manage') && <TabsTrigger value="upload">Upload roster</TabsTrigger>}
          {can('members.manage') && <TabsTrigger value="pending">Waiting to join</TabsTrigger>}
        </TabsList>
        <TabsContent value="members" className="mt-4"><Members orgId={orgId!} canManage={can('members.manage')} /></TabsContent>
        {can('members.manage') && <TabsContent value="upload" className="mt-4"><RosterUpload orgId={orgId!} /></TabsContent>}
        {can('members.manage') && <TabsContent value="pending" className="mt-4"><Pending orgId={orgId!} /></TabsContent>}
      </Tabs>
    </>
  );
}

function Members({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const { session } = useCampus();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | Role>('all');
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => api<Member[]>(`/orgs/${orgId}/members`) });

  const update = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: Partial<Pick<Member, 'role' | 'status'>> }) =>
      patch(`/orgs/${orgId}/members/${userId}`, body),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['members', orgId] }); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => (members.data ?? []).filter((m) =>
    (role === 'all' || m.role === role) &&
    (!q || [m.fullName, m.email, m.rollNumber].some((v) => v?.toLowerCase().includes(q.toLowerCase())))
  ), [members.data, q, role]);

  if (members.isLoading) return <Loading />;
  if (members.error) return <ErrorNote error={members.error} />;
  if ((members.data ?? []).length === 0) return <EmptyState title="Nobody here yet">Upload a roster to add students and staff.</EmptyState>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email or roll number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        </div>
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value as Role | 'all')} className="rounded-md border bg-card px-3 text-sm">
          <option value="all">All roles</option>
          {(['owner', ...ASSIGNABLE] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {members.data!.length} people</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Roll no.</TableHead><TableHead>Department</TableHead>
              <TableHead>Batches</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const isMe = m.email === session?.email;
              const editable = canManage && !isMe && m.role !== 'owner';
              return (
                <TableRow key={m.userId}>
                  <TableCell><p className="font-medium">{m.fullName ?? '—'}</p><p className="text-xs text-muted-foreground">{m.email}</p></TableCell>
                  <TableCell className="tabular">{m.rollNumber ?? '—'}</TableCell>
                  <TableCell>{m.department ?? '—'}</TableCell>
                  <TableCell className="max-w-48 truncate">{m.batches.join(', ') || '—'}</TableCell>
                  <TableCell>
                    {editable ? (
                      <select aria-label={`Role for ${m.email}`} value={m.role} className="rounded-md border bg-card px-2 py-1 text-sm"
                        onChange={(e) => update.mutate({ userId: m.userId, body: { role: e.target.value as Role } })}>
                        {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : ROLE_LABEL[m.role]}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ userId: m.userId, body: { status: m.status === 'active' ? 'suspended' : 'active' } })}>
                        {m.status === 'active' ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Suspended</Badge>}
                      </Button>
                    ) : <Badge variant={m.status === 'active' ? 'secondary' : 'destructive'}>{m.status === 'active' ? 'Active' : 'Suspended'}</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {canManage && <p className="text-xs text-muted-foreground">Click a status to suspend or restore someone. Suspended people lose access immediately.</p>}
    </div>
  );
}

function RosterUpload({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<RosterPreview | null>(null);

  const check = useMutation({
    mutationFn: (text: string) => post<RosterPreview>(`/orgs/${orgId}/roster/preview`, { csv: text }),
    onSuccess: setPreview,
    onError: (e) => toast.error(e.message),
  });
  const importIt = useMutation({
    mutationFn: () => post<{ imported: number; skippedAlreadyJoined: number }>(`/orgs/${orgId}/roster/import`, { csv }),
    onSuccess: (r) => {
      toast.success(`${r.imported} people added. They join automatically when they sign in with that email.`);
      setCsv(''); setFileName(''); setPreview(null);
      qc.invalidateQueries({ queryKey: ['roster', orgId] });
    },
    onError: (e) => {
      if (e instanceof ApiError && Array.isArray(e.details)) setPreview((p) => p && { ...p, errors: e.details as RosterIssue[] });
      toast.error(e.message);
    },
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) { toast.error('That file is over 2 MB. Split it into smaller files.'); return; }
    const text = await file.text();
    setCsv(text); setFileName(file.name); check.mutate(text);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'roster-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Upload a CSV</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One person per row. Only <span className="font-medium text-foreground">Email</span> is required; Name, Roll No, Department (code or name),
          Batch and Role are optional. Excel: File → Save As → CSV. People join when they sign in with a <em>verified</em> email.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={check.isPending}><FileUp className="mr-2 h-4 w-4" /> Choose CSV file</Button>
          <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> Template</Button>
          {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
        </div>
      </div>

      {check.isPending && <Loading label="Checking the file…" />}
      {preview && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{preview.summary.valid} ready</Badge>
            <Badge variant="outline">{preview.summary.new} new</Badge>
            {preview.summary.alreadyRegistered > 0 && <Badge variant="outline">{preview.summary.alreadyRegistered} already registered (updated)</Badge>}
            {preview.errors.length > 0 && <Badge variant="destructive">{preview.errors.length} problems</Badge>}
          </div>

          {preview.errors.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium">Fix these lines in your file, then choose it again. Nothing has been imported.</p>
              <ul className="mt-2 max-h-64 overflow-y-auto rounded-md border text-sm">
                {preview.errors.map((e, i) => (
                  <li key={i} className="flex gap-3 border-b px-3 py-2 last:border-0"><span className="w-16 shrink-0 tabular text-muted-foreground">Line {e.line}</span>{e.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Roll no.</TableHead><TableHead>Department</TableHead><TableHead>Batch</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.rows.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell>{r.email}</TableCell><TableCell>{r.fullName ?? '—'}</TableCell><TableCell className="tabular">{r.rollNumber ?? '—'}</TableCell>
                        <TableCell>{r.department ?? '—'}</TableCell><TableCell>{r.batch ?? '—'}</TableCell><TableCell>{ROLE_LABEL[r.role]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.summary.valid > preview.rows.length && <p className="text-xs text-muted-foreground">Showing the first {preview.rows.length} of {preview.summary.valid}.</p>}
              <Button onClick={() => importIt.mutate()} disabled={importIt.isPending || preview.summary.valid === 0}>
                Import {preview.summary.valid} {preview.summary.valid === 1 ? 'person' : 'people'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pending({ orgId }: { orgId: string }) {
  const roster = useQuery({ queryKey: ['roster', orgId], queryFn: () => api<RosterEntry[]>(`/orgs/${orgId}/roster`) });
  if (roster.isLoading) return <Loading />;
  if (roster.error) return <ErrorNote error={roster.error} />;
  const pending = (roster.data ?? []).filter((r) => r.status === 'pending');
  if (pending.length === 0) return <EmptyState title="Everyone on your roster has joined" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{pending.length} people have been added but haven't signed in yet. Ask them to sign up at Forge with exactly this email and verify it.</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Roll no.</TableHead><TableHead>Batch</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {pending.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.email}</TableCell><TableCell>{r.fullName ?? '—'}</TableCell><TableCell className="tabular">{r.rollNumber ?? '—'}</TableCell>
                <TableCell>{r.batch ?? '—'}</TableCell><TableCell>{ROLE_LABEL[r.role]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
