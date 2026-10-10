import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { collegePortalUrl, collegesService, type CollegeStatus, type CollegeSummary } from '../../services/colleges.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const STATUS_STYLE: Record<CollegeStatus, string> = {
    active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    suspended: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    archived: 'bg-muted text-muted-foreground',
};

export function SeatBar({ used, limit }: { used: number; limit: number | null }) {
    if (!limit) return <span className="text-sm">{used} <span className="text-muted-foreground">/ no limit</span></span>;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    return (
        <div className="min-w-[120px] space-y-1">
            <div className="text-sm">{used} <span className="text-muted-foreground">/ {limit}</span></div>
            <div className="h-1.5 rounded-full bg-muted" aria-hidden>
                <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-destructive' : pct >= 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function NewCollegeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ name: '', slug: '', ownerEmail: '', seats: '' });
    const [slugTouched, setSlugTouched] = useState(false);
    const seats = form.seats.trim() === '' ? null : Number(form.seats);
    const seatsBad = seats !== null && (!Number.isInteger(seats) || seats < 1);
    const create = useMutation({
        mutationFn: () => collegesService.create({ name: form.name.trim(), slug: form.slug, ownerEmail: form.ownerEmail.trim(), seatLimit: seats }),
        onSuccess: () => {
            toast.success('College created. The owner can sign in to the Campus portal now.');
            void qc.invalidateQueries({ queryKey: ['colleges'] });
            setForm({ name: '', slug: '', ownerEmail: '', seats: '' });
            setSlugTouched(false);
            onClose();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>New college</DialogTitle>
                    <DialogDescription>The owner must already have a Forge account. They run the college from the Campus portal.</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                    <div className="space-y-1.5">
                        <Label htmlFor="c-name">College name</Label>
                        <Input id="c-name" required value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="c-slug">Short address</Label>
                        <Input id="c-slug" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])" value={form.slug}
                            onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} />
                        <p className="text-xs text-muted-foreground">
                            Staff sign in at <span className="font-medium text-foreground">{collegePortalUrl(form.slug || 'college').replace(/^https?:\/\//, '')}</span>. Lowercase letters, numbers and hyphens; can't be changed later.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="c-owner">Owner's email</Label>
                        <Input id="c-owner" type="email" required value={form.ownerEmail} onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="c-seats">Student seats</Label>
                        <Input id="c-seats" type="number" min={1} placeholder="No limit" value={form.seats} aria-invalid={seatsBad}
                            onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))} className="w-40" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={create.isPending || seatsBad}>
                            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create college
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const CollegesPage = () => {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState<'all' | CollegeStatus>('all');
    const [creating, setCreating] = useState(false);
    const { data, isLoading, isError, error } = useQuery({ queryKey: ['colleges'], queryFn: collegesService.list });

    const rows = useMemo(() => (data ?? []).filter((c: CollegeSummary) =>
        (status === 'all' || c.status === status)
        && (!q.trim() || `${c.name} ${c.slug} ${c.ownerEmail ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [data, q, status]);
    const totals = useMemo(() => ({
        colleges: data?.length ?? 0,
        active: data?.filter((c) => c.status === 'active').length ?? 0,
        students: data?.reduce((n, c) => n + c.students, 0) ?? 0,
        attempts: data?.reduce((n, c) => n + c.attempts30d, 0) ?? 0,
    }), [data]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Colleges</h2>
                    <p className="text-muted-foreground">Every college on Forge Campus: plan, seats, status and usage.</p>
                </div>
                <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New college</Button>
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {[['Colleges', totals.colleges], ['Active', totals.active], ['Students', totals.students], ['Test attempts (30 days)', totals.attempts]].map(([label, n]) => (
                    <Card key={label as string} className="border-0 shadow-sm"><CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold">{n}</p>
                    </CardContent></Card>
                ))}
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>All colleges</CardTitle>
                        <CardDescription>Open a college to change its seats, suspend it or grant course licences.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Name, address or owner" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 w-56" aria-label="Search colleges" />
                        </div>
                        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
                            className="h-10 rounded-md border bg-background px-3 text-sm">
                            <option value="all">All statuses</option><option value="active">Active</option>
                            <option value="suspended">Suspended</option><option value="archived">Archived</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : isError ? (
                        <p className="py-6 text-sm text-destructive">Could not load colleges: {(error as Error).message}</p>
                    ) : rows.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            <Building2 className="mx-auto mb-2 h-6 w-6" />{data?.length ? 'No college matches.' : 'No colleges yet. Create the first one.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead>College</TableHead><TableHead>Owner</TableHead><TableHead>Students / seats</TableHead>
                                    <TableHead className="text-right">Staff</TableHead><TableHead className="text-right">Waiting</TableHead>
                                    <TableHead className="text-right">Attempts 30d</TableHead><TableHead>Last activity</TableHead><TableHead>Status</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {rows.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell>
                                                <Link to={`/colleges/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                                                <div className="text-xs text-muted-foreground">{c.slug} · since {when(c.createdAt)}</div>
                                            </TableCell>
                                            <TableCell className="text-sm">{c.ownerEmail ?? '—'}</TableCell>
                                            <TableCell><SeatBar used={c.students} limit={c.seatLimit} /></TableCell>
                                            <TableCell className="text-right">{c.staff}</TableCell>
                                            <TableCell className="text-right" title="Roster entries not yet claimed (including students waiting for a seat)">{c.pendingRoster}</TableCell>
                                            <TableCell className="text-right">{c.attempts30d}</TableCell>
                                            <TableCell className="text-sm">{when(c.lastActivityAt)}</TableCell>
                                            <TableCell><Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
            <NewCollegeDialog open={creating} onClose={() => setCreating(false)} />
        </div>
    );
};

export default CollegesPage;
