import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { testseriesAdminService, type AdminTest } from '@/services/testseriesAdmin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, Save, X, ArrowRight, ArrowLeft } from 'lucide-react';

const emptyForm = {
    title: '', slug: '', instructions: '', durationMinutes: 60,
    isSectional: false, sectionTimeLocked: false, isFree: false, releaseAt: '',
};

const SeriesTestsPage = () => {
    const { seriesId } = useParams<{ seriesId: string }>();
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const { data: series } = useQuery({ queryKey: ['ts-series-one', seriesId], queryFn: () => testseriesAdminService.getSeries(seriesId!), enabled: !!seriesId });
    const { data: tests, isLoading } = useQuery({ queryKey: ['ts-tests', seriesId], queryFn: () => testseriesAdminService.listTests(seriesId), enabled: !!seriesId });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ts-tests', seriesId] });

    const buildPayload = () => ({
        testSeriesId: seriesId,
        title: form.title,
        slug: form.slug || undefined,
        instructions: form.instructions || undefined,
        durationSeconds: Math.max(1, Math.round(form.durationMinutes * 60)),
        isSectional: form.isSectional,
        sectionTimeLocked: form.sectionTimeLocked,
        isFree: form.isFree,
        releaseAt: form.releaseAt || null,
    });

    const createMut = useMutation({
        mutationFn: testseriesAdminService.createTest,
        onSuccess: () => { invalidate(); toast.success('Test created'); setShowCreate(false); setForm(emptyForm); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => testseriesAdminService.updateTest(id, data),
        onSuccess: () => { invalidate(); toast.success('Updated'); setEditingId(null); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const togglePublishMut = useMutation({
        mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => testseriesAdminService.updateTest(id, { isPublished }),
        onSuccess: invalidate,
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const deleteMut = useMutation({
        mutationFn: testseriesAdminService.deleteTest,
        onSuccess: () => { invalidate(); toast.success('Deleted'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (t: AdminTest) => {
        setEditingId(t.id);
        setForm({
            title: t.title, slug: t.slug, instructions: t.instructions || '',
            durationMinutes: Math.round(t.duration_seconds / 60),
            isSectional: t.is_sectional, sectionTimeLocked: t.section_time_locked,
            isFree: t.is_free, releaseAt: t.release_at ? t.release_at.slice(0, 16) : '',
        });
    };

    return (
        <div className="space-y-6">
            <Link to="/test-series" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> All Test Series
            </Link>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{series?.title || 'Tests'}</h2>
                    <p className="text-muted-foreground mt-1">Individual timed tests within this series.</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm(emptyForm); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Test
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3"><CardTitle className="text-base">{editingId ? 'Edit Test' : 'Create Test'}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <Label className="text-xs">Title</Label>
                                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mock Test 1" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Slug (auto if blank)</Label>
                                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Duration (minutes)</Label>
                                <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Release at (drip-scheduling, optional)</Label>
                                <Input type="datetime-local" value={form.releaseAt} onChange={(e) => setForm({ ...form, releaseAt: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                                <Switch checked={form.isFree} onCheckedChange={(v) => setForm({ ...form, isFree: v })} />
                                <Label className="text-xs">Free test</Label>
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                                <Switch checked={form.isSectional} onCheckedChange={(v) => setForm({ ...form, isSectional: v })} />
                                <Label className="text-xs">Sectional</Label>
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                                <Switch checked={form.sectionTimeLocked} onCheckedChange={(v) => setForm({ ...form, sectionTimeLocked: v })} disabled={!form.isSectional} />
                                <Label className="text-xs">Lock time per section</Label>
                            </div>
                            <div className="space-y-1.5 col-span-2 md:col-span-4">
                                <Label className="text-xs">Instructions (shown before the timer starts)</Label>
                                <Input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" disabled={!form.title || createMut.isPending || updateMut.isPending}
                                onClick={() => editingId ? updateMut.mutate({ id: editingId, data: buildPayload() }) : createMut.mutate(buildPayload())}>
                                <Save className="mr-1 h-3 w-3" /> {editingId ? 'Update' : 'Create'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}><X className="mr-1 h-3 w-3" /> Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Questions</TableHead>
                                <TableHead>Free</TableHead>
                                <TableHead>Published</TableHead>
                                <TableHead className="w-[160px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !tests?.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No tests yet.</TableCell></TableRow>
                            ) : (
                                tests.map((t) => (
                                    <TableRow key={t.id} className="group">
                                        <TableCell className="font-medium">{t.title}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{Math.round(t.duration_seconds / 60)} min</TableCell>
                                        <TableCell>
                                            <Link to={`/test-series/tests/${t.id}/builder`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                                <Badge variant={t.question_count === 0 ? 'destructive' : 'outline'}>{t.question_count}</Badge> questions <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        </TableCell>
                                        <TableCell>{t.is_free ? <Badge variant="secondary">Free</Badge> : <Badge variant="outline">Paid</Badge>}</TableCell>
                                        <TableCell>
                                            <Switch checked={t.is_published} onCheckedChange={(v) => togglePublishMut.mutate({ id: t.id, isPublished: v })} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm(`Delete "${t.title}"?`)) deleteMut.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default SeriesTestsPage;
