import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansService, type Plan } from '../services/plans.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const Plans = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', slug: '', price: '', duration_days: '', features: '{}' });

    const { data: plans, isLoading } = useQuery({
        queryKey: ['admin-plans'],
        queryFn: plansService.list,
    });

    const createMut = useMutation({
        mutationFn: (data: any) => plansService.create({ ...data, price: parseFloat(data.price), duration_days: parseInt(data.duration_days), features: JSON.parse(data.features) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            toast.success('Plan created');
            setShowCreate(false);
            setForm({ name: '', slug: '', price: '', duration_days: '', features: '{}' });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => plansService.update(id, { ...data, price: parseFloat(data.price), duration_days: parseInt(data.duration_days), features: JSON.parse(data.features) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            toast.success('Plan updated');
            setEditingId(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => plansService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            toast.success('Plan deleted');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (p: Plan) => {
        setEditingId(p.id);
        setForm({
            name: p.name, slug: p.slug, price: p.price.toString(), duration_days: p.duration_days.toString(),
            features: JSON.stringify(p.features || {}, null, 2),
        });
    };

    const plansList = Array.isArray(plans) ? plans : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Subscription Plans</h2>
                    <p className="text-muted-foreground mt-1">Manage pricing plans and features</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setForm({ name: '', slug: '', price: '', duration_days: '', features: '{}' }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Plan
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-md animate-scale-in">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{editingId ? 'Edit Plan' : 'Create Plan'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro Plan" /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pro" /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="499" /></div>
                            <div className="space-y-1.5"><Label className="text-xs">Duration (days)</Label><Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} placeholder="30" /></div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Features (JSON)</Label>
                            <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="font-mono text-xs min-h-[80px]" />
                        </div>
                        <div className="flex gap-2">
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
                                <TableHead>Plan</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !plansList.length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    <CreditCard className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No plans configured
                                </TableCell></TableRow>
                            ) : (
                                plansList.map((p) => (
                                    <TableRow key={p.id} className="group">
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.slug}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">₹{p.price}</TableCell>
                                        <TableCell>{p.duration_days} days</TableCell>
                                        <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm('Delete this plan?')) deleteMut.mutate(p.id); }}
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

export default Plans;
