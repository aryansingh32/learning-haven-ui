import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services/users.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Search, Loader2, ShieldAlert } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

const PLAN_COLORS: Record<string, string> = {
    free:  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    pro:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    ultra: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function relativeTime(ts?: string | null): string {
    if (!ts) return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    const days = Math.floor(diff / 86_400_000);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

const Users = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['users', page, debouncedSearch, planFilter],
        queryFn: () => usersService.listUsers(page, 10, debouncedSearch, planFilter === 'all' ? undefined : planFilter),
    });

    const roleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: 'user' | 'admin' | 'super_admin' }) =>
            usersService.updateUserRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Role updated');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const banMutation = useMutation({
        mutationFn: (id: string) => usersService.toggleUserBan(id),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success(res.banned ? 'User banned' : 'User unbanned');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">Manage users, roles, and permissions.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Plan filter */}
                    <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Plan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Plans</SelectItem>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="ultra">Ultra</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={handleSearch}
                            className="pl-8 w-[250px]"
                        />
                    </div>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Last Active</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No users found.</TableCell>
                            </TableRow>
                        ) : (
                            data?.users.map((user: any) => (
                                <TableRow key={user.id} className={user.is_banned ? 'opacity-50' : ''}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium">{user.full_name || '—'}</span>
                                                {user.is_banned && <span title="Banned"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /></span>}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={PLAN_COLORS[user.current_plan ?? 'free'] ?? PLAN_COLORS.free}>
                                            {(user.current_plan ?? 'free').toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'admin' || user.role === 'super_admin' ? 'default' : 'secondary'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {relativeTime(user.last_active_at ?? user.updated_at)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(user.created_at).toLocaleDateString('en-IN')}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                                                    View Details / Controls
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(user.id); toast.success('ID copied'); }}>
                                                    Copy ID
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => roleMutation.mutate({ id: user.id, role: 'user' })}>
                                                    Set Role → User
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => roleMutation.mutate({ id: user.id, role: 'admin' })}>
                                                    Set Role → Admin
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => banMutation.mutate(user.id)}
                                                >
                                                    {user.is_banned ? 'Unban User' : 'Ban User'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <div className="text-sm text-muted-foreground mr-auto">
                    {data?.total ? `${data.total.toLocaleString()} total users` : ''}
                </div>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">Page {page}</div>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data || data.users.length < 10 || isLoading}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default Users;
