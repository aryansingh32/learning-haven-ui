import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roadmapsService, type Roadmap } from '../services/roadmaps.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

const Roadmaps = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', description: '' });

    const { data: roadmaps, isLoading } = useQuery({
        queryKey: ['admin-roadmaps'],
        queryFn: roadmapsService.list,
    });

    const createMut = useMutation({
        mutationFn: (data: Partial<Roadmap>) => roadmapsService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-roadmaps'] });
            toast.success('Roadmap created');
            setShowCreate(false);
            setForm({ title: '', description: '' });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Roadmap> }) => roadmapsService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-roadmaps'] });
            toast.success('Roadmap updated');
            setEditingId(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => roadmapsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-roadmaps'] });
            toast.success('Roadmap deleted');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (r: Roadmap) => {
        setEditingId(r.id);
        setForm({ title: r.title, description: r.description || '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Roadmaps</h2>
                    <p className="text-muted-foreground mt-1">Manage learning roadmaps and their content</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setForm({ title: '', description: '' }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Roadmap
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md animate-scale-in">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{editingId ? 'Edit Roadmap' : 'Create Roadmap'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Title</Label>
                                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="DSA Mastery Roadmap" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Description</Label>
                                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A comprehensive learning path..." />
                            </div>
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
                                <TableHead>Title</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !(Array.isArray(roadmaps) ? roadmaps : []).length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No roadmaps found.</TableCell></TableRow>
                            ) : (
                                (Array.isArray(roadmaps) ? roadmaps : []).map((r) => (
                                    <TableRow key={r.id} className="group">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="w-4 h-4 text-primary" />
                                                <span className="font-medium">{r.title}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">{r.description || '—'}</TableCell>
                                        <TableCell><Badge variant="secondary">{r.items?.length ?? 0} items</Badge></TableCell>
                                        <TableCell><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Active' : 'Draft'}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm('Delete this roadmap?')) deleteMut.mutate(r.id); }}
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

export default Roadmaps;
