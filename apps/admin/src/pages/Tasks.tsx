import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { tasksService } from '../services/tasks.service';
import api from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Send, Users, ListTodo, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

const Tasks = () => {
    const [mode, setMode] = useState<'individual' | 'all'>('individual');
    const [form, setForm] = useState({ title: '', description: '', problem_id: '', due_date: '' });

    // User search state (replaces 50-user dropdown)
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const debouncedSearch = useDebounce(userSearch, 400);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Broadcast confirm dialog
    const [broadcastOpen, setBroadcastOpen] = useState(false);

    // Fetch users only when search has >= 2 chars
    const { data: searchResults, isFetching: searching } = useQuery({
        queryKey: ['user-search-tasks', debouncedSearch],
        queryFn: async () => {
            const res = await api.get(`/admin/users?search=${encodeURIComponent(debouncedSearch)}&page=1&limit=10`);
            return res.data;
        },
        enabled: debouncedSearch.length >= 2,
    });

    const users = searchResults?.users ?? [];

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const assignMut = useMutation({
        mutationFn: () => {
            const data = {
                title: form.title,
                description: form.description || undefined,
                problem_id: form.problem_id || undefined,
                due_date: form.due_date || undefined,
            };
            return mode === 'individual'
                ? tasksService.assignToUser(selectedUser!.id, data)
                : tasksService.assignToAll(data);
        },
        onSuccess: () => {
            toast.success(mode === 'individual'
                ? `Task assigned to ${selectedUser?.label}`
                : 'Task broadcast to all users');
            setForm({ title: '', description: '', problem_id: '', due_date: '' });
            setSelectedUser(null);
            setUserSearch('');
            setBroadcastOpen(false);
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const canSubmit = form.title && (mode === 'all' || !!selectedUser);

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Task Assignment</h2>
                <p className="text-muted-foreground mt-1">Assign tasks to individual users or broadcast to everyone</p>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2">
                <Button variant={mode === 'individual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('individual')}>
                    <Users className="mr-1 h-3 w-3" /> Assign to User
                </Button>
                <Button variant={mode === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setMode('all')}>
                    <ListTodo className="mr-1 h-3 w-3" /> Assign to All
                </Button>
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base">
                        {mode === 'individual' ? 'Assign Task to Specific User' : 'Broadcast Task to All Users'}
                    </CardTitle>
                    <CardDescription>
                        {mode === 'individual'
                            ? 'Search for a user by name or email, then define the task'
                            : 'This task will be assigned to every user on the platform'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* User Search — replaces old 50-user dropdown */}
                    {mode === 'individual' && (
                        <div className="space-y-1.5" ref={dropdownRef}>
                            <Label className="text-xs">Search User (type at least 2 characters)</Label>
                            {selectedUser ? (
                                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-accent/40">
                                    <span className="text-sm font-medium flex-1">{selectedUser.label}</span>
                                    <button
                                        className="text-xs text-muted-foreground hover:text-destructive"
                                        onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                                    >
                                        ✕ Change
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name or email..."
                                        value={userSearch}
                                        onChange={(e) => { setUserSearch(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        className="pl-8"
                                    />
                                    {searching && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                                    {showDropdown && debouncedSearch.length >= 2 && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                                            {users.length === 0 ? (
                                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                                    {searching ? 'Searching...' : 'No users found'}
                                                </div>
                                            ) : (
                                                users.map((u: any) => (
                                                    <button
                                                        key={u.id}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                                                        onClick={() => {
                                                            setSelectedUser({ id: u.id, label: `${u.full_name || ''} (${u.email})`.trim() });
                                                            setShowDropdown(false);
                                                        }}
                                                    >
                                                        <span className="font-medium">{u.full_name || '—'}</span>
                                                        <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Task Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Task Title *</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Complete today's challenge"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Due Date</Label>
                            <Input
                                type="date"
                                value={form.due_date}
                                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Task details..."
                            className="min-h-[80px]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Problem ID (optional)</Label>
                        <Input
                            value={form.problem_id}
                            onChange={(e) => setForm({ ...form, problem_id: e.target.value })}
                            placeholder="Link to a specific problem UUID"
                        />
                    </div>

                    {/* Submit — direct for individual, Dialog confirm for broadcast */}
                    {mode === 'individual' ? (
                        <Button
                            onClick={() => assignMut.mutate()}
                            disabled={assignMut.isPending || !canSubmit}
                        >
                            {assignMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Assign Task
                        </Button>
                    ) : (
                        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={!form.title} variant="destructive">
                                    <ListTodo className="mr-2 h-4 w-4" /> Broadcast to All Users
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Broadcast Task to All Users?</DialogTitle>
                                    <DialogDescription>
                                        This will assign <strong>"{form.title}"</strong> to every user on the platform.
                                        This action cannot be undone. Are you sure?
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
                                    <Button
                                        variant="destructive"
                                        disabled={assignMut.isPending}
                                        onClick={() => assignMut.mutate()}
                                    >
                                        {assignMut.isPending
                                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Broadcasting...</>
                                            : 'Yes, Broadcast'
                                        }
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Tasks;
