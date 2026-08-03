import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesService, type Category } from '../services/categories.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const Categories = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '', color: '' });

    const { data: categories, isLoading } = useQuery({
        queryKey: ['admin-categories'],
        queryFn: categoriesService.listCategories,
    });

    const createMut = useMutation({
        mutationFn: (data: Partial<Category>) => categoriesService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            toast.success('Category created');
            setShowCreate(false);
            setForm({ name: '', slug: '', description: '', icon: '', color: '' });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => categoriesService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            toast.success('Category updated');
            setEditingId(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => categoriesService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            toast.success('Category deleted');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', icon: cat.icon || '', color: cat.color || '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Categories</h2>
                    <p className="text-muted-foreground mt-1">Manage problem categories and their organization</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setForm({ name: '', slug: '', description: '', icon: '', color: '' }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Category
                </Button>
            </div>

            {/* Create / Edit Form */}
            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md animate-scale-in">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{editingId ? 'Edit Category' : 'Create Category'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Arrays" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Slug</Label>
                                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="arrays" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Description</Label>
                                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Icon</Label>
                                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="📊" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Color</Label>
                                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#3b82f6" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm"
                                disabled={createMut.isPending || updateMut.isPending}
                                onClick={() => editingId
                                    ? updateMut.mutate({ id: editingId, data: form })
                                    : createMut.mutate(form)
                                }
                            >
                                <Save className="mr-1 h-3 w-3" />
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>
                                <X className="mr-1 h-3 w-3" /> Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table */}
            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : !categories?.length ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No categories found. Create your first category.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categories.map((cat) => (
                                    <TableRow key={cat.id} className="group">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {cat.icon && <span>{cat.icon}</span>}
                                                <span className="font-medium">{cat.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{cat.slug}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{cat.description || '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                                                {cat.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cat)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm('Delete this category?')) deleteMut.mutate(cat.id); }}
                                                >
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

export default Categories;
