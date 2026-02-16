import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patternsService, type Pattern } from '../services/patterns.service';
import { categoriesService } from '../services/categories.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const Patterns = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', slug: '', description: '' });

    // Patterns are nested inside categories, so we need to extract them
    const { data: categories, isLoading } = useQuery({
        queryKey: ['admin-categories-patterns'],
        queryFn: categoriesService.listCategories,
    });

    const allPatterns: (Pattern & { category_name?: string })[] = [];
    if (categories) {
        for (const cat of categories) {
            if (cat.patterns) {
                for (const p of cat.patterns) {
                    allPatterns.push({ ...p, category_name: cat.name });
                }
            }
        }
    }

    const createMut = useMutation({
        mutationFn: (data: Partial<Pattern>) => patternsService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories-patterns'] });
            toast.success('Pattern created');
            setShowCreate(false);
            setForm({ name: '', slug: '', description: '' });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Pattern> }) => patternsService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories-patterns'] });
            toast.success('Pattern updated');
            setEditingId(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => patternsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories-patterns'] });
            toast.success('Pattern deleted');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (p: Pattern) => {
        setEditingId(p.id);
        setForm({ name: p.name, slug: p.slug, description: p.description || '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Patterns</h2>
                    <p className="text-muted-foreground mt-1">Manage coding patterns and link them to problems</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setForm({ name: '', slug: '', description: '' }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Pattern
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md animate-scale-in">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{editingId ? 'Edit Pattern' : 'Create Pattern'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Two Pointers" /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="two-pointers" /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm" disabled={createMut.isPending || updateMut.isPending}
                                onClick={() => editingId ? updateMut.mutate({ id: editingId, data: form }) : createMut.mutate(form)}
                            >
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
                                <TableHead>Pattern</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !allPatterns.length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    <Share2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No patterns found
                                </TableCell></TableRow>
                            ) : (
                                allPatterns.map((p) => (
                                    <TableRow key={p.id} className="group">
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{p.slug}</TableCell>
                                        <TableCell className="text-sm">{p.category_name || '—'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.description || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm('Delete this pattern?')) deleteMut.mutate(p.id); }}
                                                ><Trash2 className="h-3.5 w-3.5" /></Button>
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

export default Patterns;
