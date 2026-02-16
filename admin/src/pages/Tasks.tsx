import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService } from '../services/tasks.service';
import { usersService } from '../services/users.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Users, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

const Tasks = () => {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<'individual' | 'all'>('individual');
    const [form, setForm] = useState({ title: '', description: '', problem_id: '', due_date: '' });
    const [selectedUser, setSelectedUser] = useState('');

    const { data: usersData } = useQuery({
        queryKey: ['users-for-tasks'],
        queryFn: () => usersService.listUsers(1, 50),
    });

    const assignMut = useMutation({
        mutationFn: () => {
            const data = { title: form.title, description: form.description || undefined, problem_id: form.problem_id || undefined, due_date: form.due_date || undefined };
            return mode === 'individual'
                ? tasksService.assignToUser(selectedUser, data)
                : tasksService.assignToAll(data);
        },
        onSuccess: () => {
            toast.success(mode === 'individual' ? 'Task assigned to user' : 'Task assigned to all users');
            setForm({ title: '', description: '', problem_id: '', due_date: '' });
            setSelectedUser('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

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
                            ? 'Select a user and define the task details'
                            : 'This task will be assigned to every user on the platform'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {mode === 'individual' && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Select User</Label>
                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                <SelectTrigger><SelectValue placeholder="Choose a user..." /></SelectTrigger>
                                <SelectContent>
                                    {usersData?.users?.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Task Title *</Label>
                            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Complete today's challenge" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Due Date</Label>
                            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Task details..." className="min-h-[80px]" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Problem ID (optional)</Label>
                        <Input value={form.problem_id} onChange={(e) => setForm({ ...form, problem_id: e.target.value })} placeholder="Link to a specific problem" />
                    </div>
                    <Button
                        onClick={() => assignMut.mutate()}
                        disabled={assignMut.isPending || !form.title || (mode === 'individual' && !selectedUser)}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        {assignMut.isPending ? 'Assigning...' : mode === 'individual' ? 'Assign Task' : 'Broadcast to All'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default Tasks;
