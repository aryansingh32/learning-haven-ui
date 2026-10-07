import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { testseriesAdminService, type TestSeries } from '@/services/testseriesAdmin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, Save, X, ArrowRight } from 'lucide-react';

const emptyForm = { examCategoryId: '', title: '', slug: '', description: '', year: new Date().getFullYear(), isFree: false, price: 0 };

const TestSeriesPage = () => {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const examCategoryFilter = searchParams.get('exam_category_id') || '';
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const { data: categories } = useQuery({ queryKey: ['ts-exam-categories'], queryFn: testseriesAdminService.listExamCategories });
    const { data: series, isLoading } = useQuery({
        queryKey: ['ts-series', examCategoryFilter],
        queryFn: () => testseriesAdminService.listSeries(examCategoryFilter || undefined),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ts-series'] });

    const createMut = useMutation({
        mutationFn: testseriesAdminService.createSeries,
        onSuccess: () => { invalidate(); toast.success('Test series created'); setShowCreate(false); setForm(emptyForm); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => testseriesAdminService.updateSeries(id, data),
        onSuccess: () => { invalidate(); toast.success('Updated'); setEditingId(null); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const togglePublishMut = useMutation({
        mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => testseriesAdminService.updateSeries(id, { isPublished }),
        onSuccess: invalidate,
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const deleteMut = useMutation({
        mutationFn: testseriesAdminService.deleteSeries,
        onSuccess: () => { invalidate(); toast.success('Deleted'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (s: TestSeries) => {
        setEditingId(s.id);
        setForm({ examCategoryId: s.exam_category_id, title: s.title, slug: s.slug, description: s.description || '', year: s.year || new Date().getFullYear(), isFree: s.is_free, price: s.price });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Test Series</h2>
                    <p className="text-muted-foreground mt-1">Year-versioned bundles of tests within an exam category.</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm({ ...emptyForm, examCategoryId: examCategoryFilter }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Test Series
                </Button>
            </div>

            <div className="w-64">
                <Select value={examCategoryFilter || 'all'} onValueChange={(v) => setSearchParams(v === 'all' ? {} : { exam_category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Filter by exam category" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All exam categories</SelectItem>
                        {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3"><CardTitle className="text-base">{editingId ? 'Edit Test Series' : 'Create Test Series'}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <Label className="text-xs">Exam Category</Label>
                                <Select value={form.examCategoryId} onValueChange={(v) => setForm({ ...form, examCategoryId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <Label className="text-xs">Title</Label>
                                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="GATE CS Test Series 2026" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Slug (auto if blank)</Label>
                                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Year</Label>
                                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Price (₹)</Label>
                                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} disabled={form.isFree} />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                                <Switch checked={form.isFree} onCheckedChange={(v) => setForm({ ...form, isFree: v })} />
                                <Label className="text-xs">Free series</Label>
                            </div>
                            <div className="space-y-1.5 col-span-2 md:col-span-4">
                                <Label className="text-xs">Description</Label>
                                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" disabled={!form.examCategoryId || !form.title || createMut.isPending || updateMut.isPending}
                                onClick={() => editingId ? updateMut.mutate({ id: editingId, data: form }) : createMut.mutate(form)}>
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
                                <TableHead>Category</TableHead>
                                <TableHead>Pricing</TableHead>
                                <TableHead>Tests</TableHead>
                                <TableHead>Published</TableHead>
                                <TableHead className="w-[140px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !series?.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No test series yet.</TableCell></TableRow>
                            ) : (
                                series.map((s) => (
                                    <TableRow key={s.id} className="group">
                                        <TableCell className="font-medium">{s.title} {s.year ? <span className="text-muted-foreground">({s.year})</span> : null}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{s.exam_category_name}</TableCell>
                                        <TableCell>{s.is_free ? <Badge variant="secondary">Free</Badge> : <Badge variant="outline">₹{s.price}</Badge>}</TableCell>
                                        <TableCell>
                                            <Link to={`/test-series/${s.id}/tests`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                                <Badge variant="outline">{s.test_count}</Badge> tests <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Switch checked={s.is_published} onCheckedChange={(v) => togglePublishMut.mutate({ id: s.id, isPublished: v })} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm(`Delete "${s.title}"?`)) deleteMut.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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

export default TestSeriesPage;
