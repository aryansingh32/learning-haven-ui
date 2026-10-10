import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, ShieldAlert, ShieldCheck, Archive, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { collegesService, type CollegeStatus } from '../../services/colleges.service';
import { STATUS_STYLE, SeatBar } from './CollegesPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const STATUS_ACTIONS: Record<CollegeStatus, { to: CollegeStatus; label: string; icon: typeof ShieldAlert; danger?: boolean; explain: string }[]> = {
    active: [
        { to: 'suspended', label: 'Suspend', icon: ShieldAlert, danger: true, explain: 'Its staff and students lose access straight away (tests, courses, drives, licences). Nothing is deleted; reactivate to restore everything.' },
        { to: 'archived', label: 'Archive', icon: Archive, danger: true, explain: 'For a college that has left. It stops working like a suspension and drops out of the active list.' },
    ],
    suspended: [{ to: 'active', label: 'Reactivate', icon: ShieldCheck, explain: 'Its staff and students get their access back, with all their data.' }],
    archived: [{ to: 'active', label: 'Reactivate', icon: ShieldCheck, explain: 'Brings the college back with all its data.' }],
};

function Licences({ id }: { id: string }) {
    const qc = useQueryClient();
    const licences = useQuery({ queryKey: ['college-licences', id], queryFn: () => collegesService.licences(id) });
    const courses = useQuery({ queryKey: ['premium-courses'], queryFn: collegesService.premiumCourses });
    const [courseId, setCourseId] = useState('all');
    const [endsAt, setEndsAt] = useState('');
    const grant = useMutation({
        mutationFn: () => collegesService.grantLicence(id, { courseId: courseId === 'all' ? null : courseId, endsAt: endsAt ? new Date(endsAt).toISOString() : null, note: null }),
        onSuccess: () => { toast.success('Licence granted'); setEndsAt(''); void qc.invalidateQueries({ queryKey: ['college-licences', id] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const revoke = useMutation({
        mutationFn: (licenceId: string) => collegesService.revokeLicence(id, licenceId),
        onSuccess: () => { toast.success('Licence removed'); void qc.invalidateQueries({ queryKey: ['college-licences', id] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    return (
        <Card className="border-0 shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Course licences</CardTitle>
                <CardDescription>Premium Forge courses this college's students get for free.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}>
                    <div className="space-y-1">
                        <Label htmlFor="lic-course">Course</Label>
                        <select id="lic-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm max-w-xs">
                            <option value="all">Every premium Forge course</option>
                            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}{c.isPremium ? '' : ' (free)'}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="lic-end">Ends</Label>
                        <Input id="lic-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-44" />
                    </div>
                    <Button type="submit" disabled={grant.isPending}>{grant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Grant</Button>
                </form>
                {licences.data?.length ? (
                    <ul className="divide-y rounded-md border">
                        {licences.data.map((l) => (
                            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                                <div>
                                    <span className="font-medium">{l.courseTitle ?? 'Every premium Forge course'}</span>
                                    <span className="ml-2 text-muted-foreground">{when(l.startsAt)} → {l.endsAt ? when(l.endsAt) : 'no end'}</span>
                                    {!l.active && <Badge variant="outline" className="ml-2">not active</Badge>}
                                </div>
                                <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Remove licence ${l.courseTitle ?? 'all courses'}`}
                                    onClick={() => revoke.mutate(l.id)} disabled={revoke.isPending}><Trash2 className="h-4 w-4" /></Button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-muted-foreground">No licences. Students pay for premium courses themselves.</p>}
            </CardContent>
        </Card>
    );
}

const CollegeDetailPage = () => {
    const { id = '' } = useParams();
    const qc = useQueryClient();
    const { data: c, isLoading, isError, error } = useQuery({ queryKey: ['college', id], queryFn: () => collegesService.get(id), enabled: Boolean(id) });
    const [name, setName] = useState('');
    const [seats, setSeats] = useState('');
    const [confirm, setConfirm] = useState<(typeof STATUS_ACTIONS)['active'][number] | null>(null);

    useEffect(() => { if (c) { setName(c.name); setSeats(c.seatLimit ? String(c.seatLimit) : ''); } }, [c]);

    const update = useMutation({
        mutationFn: (data: { name?: string; seatLimit?: number | null; status?: CollegeStatus }) => collegesService.update(id, data),
        onSuccess: (_d, vars) => {
            toast.success(vars.status ? `College is now ${vars.status}` : 'Saved');
            setConfirm(null);
            void qc.invalidateQueries({ queryKey: ['college', id] });
            void qc.invalidateQueries({ queryKey: ['colleges'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (isError || !c) return <p className="text-destructive">Could not load this college: {(error as Error)?.message}</p>;

    const seatNumber = seats.trim() === '' ? null : Number(seats);
    const seatsBad = seatNumber !== null && (!Number.isInteger(seatNumber) || seatNumber < Math.max(1, c.students));
    const changed = name.trim() !== c.name || seatNumber !== c.seatLimit;

    return (
        <div className="space-y-6">
            <Link to="/colleges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All colleges</Link>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{c.name}</h2>
                    <p className="text-muted-foreground">{c.slug} · owner {c.ownerEmail ?? '—'} · since {when(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                    {STATUS_ACTIONS[c.status].map((a) => (
                        <Button key={a.to} variant={a.danger ? 'outline' : 'default'} className={a.danger ? 'text-destructive' : ''} onClick={() => setConfirm(a)}>
                            <a.icon className="mr-2 h-4 w-4" /> {a.label}
                        </Button>
                    ))}
                </div>
            </div>

            {c.status !== 'active' && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    This college is {c.status}. Its staff see "This college is suspended" in the Campus portal and its students no longer see its tests or courses.
                </div>
            )}

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                {[['Students', <SeatBar key="s" used={c.students} limit={c.seatLimit} />], ['Staff', c.staff], ['Waiting on roster', c.pendingRoster],
                  ['Published tests', c.assignments], ['Attempts (30 days)', c.attempts30d]].map(([label, v]) => (
                    <Card key={label as string} className="border-0 shadow-sm"><CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <div className="text-2xl font-bold">{v}</div>
                    </CardContent></Card>
                ))}
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader><CardTitle>Plan</CardTitle><CardDescription>Only Forge can change these; the college's own admins cannot.</CardDescription></CardHeader>
                <CardContent>
                    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
                        e.preventDefault();
                        update.mutate({ ...(name.trim() !== c.name ? { name: name.trim() } : {}), ...(seatNumber !== c.seatLimit ? { seatLimit: seatNumber } : {}) });
                    }}>
                        <div className="space-y-1">
                            <Label htmlFor="cd-name">Name</Label>
                            <Input id="cd-name" value={name} onChange={(e) => setName(e.target.value)} className="w-72" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="cd-seats">Student seats</Label>
                            <Input id="cd-seats" type="number" min={Math.max(1, c.students)} placeholder="No limit" value={seats}
                                onChange={(e) => setSeats(e.target.value)} aria-invalid={seatsBad} className="w-40" />
                        </div>
                        <Button type="submit" disabled={!changed || seatsBad || update.isPending}>
                            {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                        </Button>
                        {seatsBad && <p className="w-full text-xs text-destructive">At least {Math.max(1, c.students)}: the college already has {c.students} active students.</p>}
                        {c.pendingRoster > 0 && c.seatLimit !== null && c.students >= c.seatLimit &&
                            <p className="w-full text-xs text-amber-600">All seats are used; {c.pendingRoster} roster entries are waiting. Raising the limit lets them in the next time they sign in.</p>}
                    </form>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle>Staff</CardTitle><CardDescription>People who run this college in the Campus portal.</CardDescription></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {c.staffMembers.map((s) => (
                                    <TableRow key={s.userId}>
                                        <TableCell><div className="font-medium">{s.name ?? '—'}</div><div className="text-xs text-muted-foreground">{s.email}</div></TableCell>
                                        <TableCell className="capitalize">{s.role.replace('_', ' ')}</TableCell>
                                        <TableCell>{s.status}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
                    <CardContent>
                        {c.batches.length ? (
                            <ul className="divide-y rounded-md border">
                                {c.batches.map((b) => <li key={b.id} className="flex justify-between p-3 text-sm"><span>{b.name}</span><span className="text-muted-foreground">{b.students} students</span></li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No batches yet.</p>}
                    </CardContent>
                </Card>
            </div>

            <Licences id={id} />

            <Dialog open={Boolean(confirm)} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{confirm?.label} {c.name}?</DialogTitle>
                        <DialogDescription>{confirm?.explain}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
                        <Button variant={confirm?.danger ? 'destructive' : 'default'} disabled={update.isPending}
                            onClick={() => confirm && update.mutate({ status: confirm.to })}>
                            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirm?.label}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CollegeDetailPage;
