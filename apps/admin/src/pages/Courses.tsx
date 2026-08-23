import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesService, type Course } from '../services/courses.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X, BookOpen, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const Courses = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [form, setForm] = useState<Partial<Course>>({ 
        title: '', description: '', cover_image: '', difficulty_level: 'Beginner', 
        duration_days: 30, is_premium: false, is_published: false,
        price: null, currency: 'INR', is_individually_purchasable: false
    });

    const { data: courses, isLoading } = useQuery({
        queryKey: ['admin-courses'],
        queryFn: coursesService.list,
    });

    const courseList: Course[] = Array.isArray(courses) ? courses : [];

    const createMut = useMutation({
        mutationFn: (data: Partial<Course>) => coursesService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            toast.success('Course created successfully');
            setShowCreate(false);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Course> }) => coursesService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            toast.success('Course updated successfully');
            setEditingId(null);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => coursesService.delete(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            toast.success('Course deleted');
            setSelectedIds((prev) => prev.filter((i) => i !== id));
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const bulkDeleteMut = useMutation({
        mutationFn: (ids: string[]) => coursesService.bulkDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            toast.success('Selected courses deleted successfully');
            setSelectedIds([]);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const startEdit = (c: Course) => {
        setEditingId(c.id);
        setForm({
            title: c.title,
            description: c.description || '',
            cover_image: c.cover_image || '',
            difficulty_level: c.difficulty_level || 'Beginner',
            duration_days: c.duration_days || 30,
            is_premium: c.is_premium || false,
            is_published: c.is_published || false,
            price: c.price || null,
            currency: c.currency || 'INR',
            is_individually_purchasable: c.is_individually_purchasable || false
        });
    };

    const resetForm = () => {
        setShowCreate(false);
        setEditingId(null);
        setForm({ title: '', description: '', cover_image: '', difficulty_level: 'Beginner', duration_days: 30, is_premium: false, is_published: false, price: null, currency: 'INR', is_individually_purchasable: false });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(courseList.map((c) => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Courses</h2>
                    <p className="text-muted-foreground mt-1">Create and manage your educational catalog</p>
                </div>
                <Button onClick={() => { setShowCreate(true); setForm({ title: '', description: '', cover_image: '', difficulty_level: 'Beginner', duration_days: 30, is_premium: false, is_published: false, price: null, currency: 'INR', is_individually_purchasable: false }); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Course
                </Button>
            </div>

            {(showCreate || editingId) && (
                <Card className="border-0 shadow-lg ring-1 ring-primary/20 animate-scale-in">
                    <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
                        <CardTitle>{editingId ? 'Edit Course Configuration' : 'Create New Course'}</CardTitle>
                        <CardDescription>Set metadata, cover image, and pricing details</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <Label>Course Title</Label>
                                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Complete React Developer in 2026" className="text-lg font-medium" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label>Description</Label>
                                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A comprehensive learning path..." rows={3} />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label>Cover Image URL</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} placeholder="https://..." className="pl-9" />
                                    </div>
                                    {form.cover_image && (
                                        <div className="w-10 h-10 rounded overflow-hidden shrink-0 border">
                                            <img src={form.cover_image} className="w-full h-full object-cover" alt="Preview" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Difficulty Level</Label>
                                <Input value={form.difficulty_level} onChange={(e) => setForm({ ...form, difficulty_level: e.target.value })} placeholder="Beginner, Intermediate, Advanced" />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label>Duration (Days)</Label>
                                <Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 0 })} placeholder="30" />
                            </div>
                            
                            <div className="flex flex-col gap-4 mt-4 md:col-span-2">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Switch checked={form.is_premium} onCheckedChange={(c) => setForm({ ...form, is_premium: c })} />
                                        <Label>Premium (Paid via Subscription)</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
                                        <Label>Published (Public)</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={form.is_individually_purchasable} onCheckedChange={(c) => setForm({ ...form, is_individually_purchasable: c })} />
                                        <Label>Individually Purchasable</Label>
                                    </div>
                                </div>
                                {form.is_individually_purchasable && (
                                    <div className="flex items-center gap-4 p-4 rounded-xl border bg-secondary/20">
                                        <div className="flex-1 space-y-1.5">
                                            <Label>Price (in paise/cents)</Label>
                                            <Input type="number" value={form.price || ''} onChange={(e) => setForm({ ...form, price: e.target.value ? parseInt(e.target.value) : null })} placeholder="e.g. 49900 for ₹499" />
                                            <p className="text-[10px] text-muted-foreground">Amount in smallest currency unit (e.g. 49900 = ₹499.00)</p>
                                        </div>
                                        <div className="w-1/3 space-y-1.5">
                                            <Label>Currency</Label>
                                            <Input value={form.currency || 'INR'} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} placeholder="INR" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-8 justify-end">
                            <Button variant="outline" onClick={resetForm}>
                                <X className="mr-1 h-4 w-4" /> Cancel
                            </Button>
                            <Button disabled={createMut.isPending || updateMut.isPending}
                                onClick={() => editingId ? updateMut.mutate({ id: editingId, data: form }) : createMut.mutate(form)}
                            >
                                <Save className="mr-1 h-4 w-4" /> {editingId ? 'Save Changes' : 'Create Course'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
                    <span className="text-sm font-semibold text-destructive">
                        {selectedIds.length} course(s) selected
                    </span>
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={bulkDeleteMut.isPending}
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete ${selectedIds.length} course(s)? This action cannot be undone.`)) {
                                bulkDeleteMut.mutate(selectedIds);
                            }
                        }}
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.length})
                    </Button>
                </div>
            )}

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] px-4">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded cursor-pointer"
                                        checked={courseList.length > 0 && selectedIds.length === courseList.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </TableHead>
                                <TableHead className="w-[300px]">Course</TableHead>
                                <TableHead>Difficulty & Duration</TableHead>
                                <TableHead>Access</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !courseList.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No courses found. Create one above.</TableCell></TableRow>
                            ) : (
                                courseList.map((c) => {
                                    const isSelected = selectedIds.includes(c.id);
                                    return (
                                        <TableRow key={c.id} className={`group ${isSelected ? 'bg-muted/50' : ''}`}>
                                            <TableCell className="px-4">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(c.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden border">
                                                        {c.cover_image ? <img src={c.cover_image} className="w-full h-full object-cover" /> : <BookOpen className="w-5 h-5 text-muted-foreground" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold">{c.title}</div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description || 'No description'}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm">{c.difficulty_level || 'Beginner'}</span>
                                                    <span className="text-xs text-muted-foreground">{c.duration_days ? `${c.duration_days} days` : 'Flexible'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {c.is_premium ? (
                                                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">Premium</Badge>
                                                ) : (
                                                    <Badge variant="outline">Free</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {c.is_published ? (
                                                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Published</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Draft</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" title="Edit Metadata" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                                                        onClick={() => { if (confirm('Delete this course?')) deleteMut.mutate(c.id); }}
                                                    ><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Courses;
