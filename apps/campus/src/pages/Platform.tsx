import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, del, post } from '@/api/client';
import { EmptyState, ErrorNote, Field, formatDateTime, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCampus } from '@/context/CampusContext';

interface College { id: string; slug: string; name: string; status: string; seatLimit: number | null; students: number; staff: number; createdAt: string }

/** Forge staff only: onboard a college and appoint its owner. */
export default function Platform() {
  const { staffOrgs, signOut, session } = useCampus();
  const qc = useQueryClient();
  const colleges = useQuery({ queryKey: ['platform-colleges'], queryFn: () => api<College[]>('/platform/colleges') });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [seats, setSeats] = useState('');
  const [licensing, setLicensing] = useState<College | null>(null);

  const create = useMutation({
    mutationFn: () => post('/platform/colleges', { name, slug, ownerEmail, seatLimit: seats ? Number(seats) : null }),
    onSuccess: () => {
      toast.success(`${name} created. ${ownerEmail} can now sign in to Campus as its owner.`);
      setName(''); setSlug(''); setOwnerEmail(''); setSeats('');
      qc.invalidateQueries({ queryKey: ['platform-colleges'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between text-sm">
        <span className="font-semibold">Forge Campus · Platform</span>
        <span className="flex items-center gap-3 text-muted-foreground">
          {staffOrgs.length > 0 && <Link to="/" className="hover:text-foreground">My colleges</Link>}
          <span>{session?.email}</span>
          <button onClick={signOut} className="hover:text-foreground">Sign out</button>
        </span>
      </div>
      <PageHeader title="Colleges" description="Create a college and hand it to its owner, who then adds their staff and students." />

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} className="mb-8 grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
        <Field label="College name" htmlFor="p-name"><Input id="p-name" required minLength={2} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Example Institute of Technology" /></Field>
        <Field label="Short name (URL)" htmlFor="p-slug" hint="Lowercase letters, numbers and hyphens.">
          <Input id="p-slug" required pattern="[a-z0-9][a-z0-9-]{1,62}" value={slug}
            placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'example-it'}
            onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </Field>
        <Field label="Owner's email" htmlFor="p-owner" hint="They need a Forge account first.">
          <Input id="p-owner" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </Field>
        <Field label="Seat limit" htmlFor="p-seats" hint="Students covered by the contract. Leave blank for none.">
          <Input id="p-seats" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
        </Field>
        <div className="sm:col-span-2"><Button type="submit" disabled={create.isPending}>Create college</Button></div>
      </form>

      {colleges.isLoading ? <Loading /> : colleges.error ? <ErrorNote error={colleges.error} /> : colleges.data!.length === 0 ? (
        <EmptyState title="No colleges yet">Create the first one above.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">College</th><th className="px-4 py-2.5 text-right font-medium">Students</th><th className="px-4 py-2.5 text-right font-medium">Staff</th><th className="px-4 py-2.5 font-medium">Created</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y">
              {colleges.data!.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.slug}</p></td>
                  <td className="px-4 py-2.5 text-right tabular">{c.students}{c.seatLimit ? ` / ${c.seatLimit}` : ''}</td>
                  <td className="px-4 py-2.5 text-right tabular">{c.staff}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(c.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => setLicensing(c)}>Course licences</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {licensing && <Licences college={licensing} onClose={() => setLicensing(null)} />}
    </main>
  );
}

interface Licence { id: string; courseId: string | null; courseTitle: string | null; startsAt: string; endsAt: string | null; note: string | null; active: boolean }
interface ForgeCourse { id: string; title: string; isPremium: boolean }

/** Which premium Forge courses a college's members may study. */
function Licences({ college, onClose }: { college: College; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ['licences', college.id];
  const licences = useQuery({ queryKey: key, queryFn: () => api<Licence[]>(`/platform/colleges/${college.id}/licences`) });
  const courses = useQuery({ queryKey: ['platform-courses'], queryFn: () => api<ForgeCourse[]>('/platform/courses') });
  const [courseId, setCourseId] = useState('all');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');

  const grant = useMutation({
    mutationFn: () => post(`/platform/colleges/${college.id}/licences`, {
      courseId: courseId === 'all' ? null : courseId, endsAt: endsAt ? new Date(endsAt).toISOString() : null, note: note || null,
    }),
    onSuccess: () => { toast.success('Licence granted'); setNote(''); setEndsAt(''); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/platform/colleges/${college.id}/licences/${id}`),
    onSuccess: () => { toast.success('Licence removed'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  const premium = (courses.data ?? []).filter((c) => c.isPremium);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Course licences · {college.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Every active member of the college can study the licensed premium courses in the Forge app, and staff can assign them to batches. Free courses need no licence.</p>
        {licences.isLoading ? <Loading /> : licences.error ? <ErrorNote error={licences.error} /> : licences.data!.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No licences yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {licences.data!.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{l.courseId ? l.courseTitle : 'All premium Forge courses'} {!l.active && <Badge variant="outline" className="ml-1">Not active</Badge>}</p>
                  <p className="text-xs text-muted-foreground">From {formatDateTime(l.startsAt)}{l.endsAt ? ` until ${formatDateTime(l.endsAt)}` : ', no end date'}{l.note ? ` · ${l.note}` : ''}</p>
                </div>
                <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(l.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); grant.mutate(); }} className="space-y-3 rounded-md border p-4">
          <Field label="Course" htmlFor="l-course">
            <select id="l-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
              <option value="all">All premium Forge courses</option>
              {premium.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ends" htmlFor="l-end" hint="Leave blank for no end date."><Input id="l-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
            <Field label="Note" htmlFor="l-note"><Input id="l-note" maxLength={500} value={note} placeholder="e.g. 2026–27 contract" onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <Button type="submit" disabled={grant.isPending}>Grant licence</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
