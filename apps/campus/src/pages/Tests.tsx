import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api, post } from '@/api/client';
import type { TestSummary } from '@/api/types';
import { EmptyState, ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrg } from '@/context/CampusContext';

export default function Tests() {
  const { orgId } = useParams();
  const { can } = useOrg(orgId);
  const [creating, setCreating] = useState(false);
  const tests = useQuery({ queryKey: ['tests', orgId], queryFn: () => api<TestSummary[]>(`/orgs/${orgId}/tests`), enabled: can('assessments.create') });

  if (tests.isLoading) return <Loading />;
  if (tests.error) return <ErrorNote error={tests.error} />;
  const own = (tests.data ?? []).filter((t) => t.source === 'college');
  const forge = (tests.data ?? []).filter((t) => t.source === 'forge');
  const shared = (tests.data ?? []).filter((t) => t.source === 'shared');

  return (
    <>
      <PageHeader title="Tests" description="Write your own tests, or use ready-made ones from the Forge library."
        actions={can('content.create') && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New test</Button>} />
      <Tabs defaultValue="college">
        <TabsList>
          <TabsTrigger value="college">Your tests ({own.length})</TabsTrigger>
          <TabsTrigger value="forge">Forge library ({forge.length})</TabsTrigger>
          {shared.length > 0 && <TabsTrigger value="shared">Shared with you ({shared.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="college" className="mt-4">
          {own.length === 0
            ? <EmptyState title="No tests yet" action={can('content.create') && <Button variant="outline" onClick={() => setCreating(true)}>Write your first test</Button>}>
                Add single-choice, multiple-choice, true/false, numeric, fill-in-the-blank, written and coding questions, then publish and assign it.
              </EmptyState>
            : <TestList tests={own} linkable />}
        </TabsContent>
        <TabsContent value="forge" className="mt-4">
          {forge.length === 0 ? <EmptyState title="The Forge library is empty for now" /> : <TestList tests={forge} />}
        </TabsContent>
        <TabsContent value="shared" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">Other colleges shared these. Assign them as they are, or copy one into your tests to edit it.</p>
          <TestList tests={shared} orgId={orgId!} canCopy={can('content.create')} />
        </TabsContent>
      </Tabs>
      <NewTest open={creating} onClose={() => setCreating(false)} orgId={orgId!} />
    </>
  );
}

function TestList({ tests, linkable, orgId, canCopy }: { tests: TestSummary[]; linkable?: boolean; orgId?: string; canCopy?: boolean }) {
  const navigate = useNavigate();
  const copy = useMutation({
    mutationFn: (id: string) => post<{ id: string }>(`/orgs/${orgId}/tests/${id}/copy`, {}),
    onSuccess: (t) => { toast.success('Copied into your tests as a draft'); navigate(t.id); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {tests.map((t) => {
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.questionCount} questions · {t.durationMinutes} min
                {t.sharedBy ? ` · shared by ${t.sharedBy}` : ''}{t.sharedWith ? ` · shared with ${t.sharedWith} ${t.sharedWith === 1 ? 'college' : 'colleges'}` : ''}
              </p>
            </div>
            {t.source === 'college' && <Badge variant={t.published ? 'secondary' : 'outline'}>{t.published ? 'Published' : 'Draft'}</Badge>}
            {t.source === 'shared' && canCopy && (
              <Button size="sm" variant="outline" disabled={copy.isPending} onClick={() => copy.mutate(t.id)}>Copy to my tests</Button>
            )}
          </>
        );
        return (
          <li key={t.id}>
            {linkable
              ? <Link to={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">{body}</Link>
              : <div className="flex items-center gap-3 px-4 py-3">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function NewTest({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('30');
  const create = useMutation({
    mutationFn: () => post<{ id: string }>(`/orgs/${orgId}/tests`, { title, durationMinutes: Number(minutes) }),
    onSuccess: (t) => { onClose(); navigate(t.id); },
    onError: (e) => toast.error(e.message),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New test</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title" htmlFor="test-title"><Input id="test-title" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Arrays — weekly test 3" /></Field>
          <Field label="Duration (minutes)" htmlFor="test-min" hint="You can give an assignment a different time limit later.">
            <Input id="test-min" type="number" min={1} max={600} required value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-32" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create and add questions</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
