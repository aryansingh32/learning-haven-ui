import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { testseriesAdminService, type ExamCategory } from '@/services/testseriesAdmin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, Save, X, ArrowRight } from 'lucide-react';

const emptyForm = { name: '', slug: '', description: '', iconUrl: '', sortOrder: 0 };

const ExamCategoriesPage = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const { data: categories, isLoading } = useQuery({
        queryKey: ['ts-exam-categories'],
        queryFn: testseriesAdminService.listExamCategories,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ts-exam-categories'] });

    const createMut = useMutation({
        mutationFn: testseriesAdminService.createExamCategory,
        onSuccess: () => { invalidate(); toast.success('Exam category created'); setShowCreate(false); setForm(emptyForm); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ExamCategory> }) => testseriesAdminService.updateExamCategory(id, data),
        onSuccess: () => { invalidate(); toast.success('Updated'); setEditingId(null); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => testseriesAdminService.updateExamCategory(id, { isActive } as any),
        onSuccess: invalidate,
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: testseriesAdminService.deleteExamCategory,
        onSuccess: () => { invalidate(); toast.success('Deleted'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (cat: ExamCategory) => {
        setEditingId(cat.id);
        setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', iconUrl: cat.icon_url || '', sortOrder: cat.sort_order });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Exam Categories</h2>
                    <p className="text-muted-foreground mt-1">
                        Top-level exams in the test-series marketplace (GATE, Banking, SSC, UPSC, ...).
                    </p>
                </div>
                <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm(emptyForm); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Exam Category
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{editingId ? 'Edit Exam Category' : 'Create Exam Category'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GATE CS" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Slug (auto if blank)</Label>
                                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="gate-cs" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Icon (emoji/URL)</Label>
                                <Input value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} placeholder="💻" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Sort Order</Label>
                                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-1.5 col-span-2 md:col-span-4">
                                <Label className="text-xs">Description</Label>
                                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm" disabled={createMut.isPending || updateMut.isPending}
                                onClick={() => editingId ? updateMut.mutate({ id: editingId, data: form as any }) : createMut.mutate(form as any)}>
                                <Save className="mr-1 h-3 w-3" /> {editingId ? 'Update' : 'Create'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>
                                <X className="mr-1 h-3 w-3" /> Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Series</TableHead>
                                <TableHead>Active</TableHead>
                                <TableHead className="w-[140px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !categories?.length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No exam categories yet.</TableCell></TableRow>
                            ) : (
                                categories.map((cat) => (
                                    <TableRow key={cat.id} className="group">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {cat.icon_url && <span>{cat.icon_url}</span>}
                                                <span className="font-medium">{cat.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{cat.slug}</TableCell>
                                        <TableCell>
                                            <Link to={`/test-series?exam_category_id=${cat.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                                <Badge variant="outline">{cat.series_count}</Badge> series <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Switch checked={cat.is_active} onCheckedChange={(v) => toggleActiveMut.mutate({ id: cat.id, isActive: v })} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cat)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm(`Delete "${cat.name}"? This also removes its test series.`)) deleteMut.mutate(cat.id); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
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

export default ExamCategoriesPage;
