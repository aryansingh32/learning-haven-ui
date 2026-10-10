import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService, type UserStatusFilter } from '../services/users.service';
import { useAuth } from '../context/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Search, Loader2, ShieldAlert, Download, Ban, RotateCcw, UserCog, X } from 'lucide-react';
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
    const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const { user: me } = useAuth();
    const isSuper = (me as any)?.role === 'super_admin';
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['users', page, debouncedSearch, planFilter, statusFilter],
        queryFn: () => usersService.listUsers(page, 10, debouncedSearch, planFilter === 'all' ? undefined : planFilter, statusFilter),
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
        mutationFn: ({ id, banned }: { id: string; banned: boolean }) => usersService.setBanned(id, banned),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success(res.banned ? 'Account suspended' : 'Account restored');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const bulkMutation = useMutation({
        mutationFn: ({ action, role }: { action: 'ban' | 'unban' | 'set_role'; role?: 'user' | 'admin' | 'super_admin' }) =>
            usersService.bulk([...selected], action, role),
        onSuccess: (r) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelected(new Set());
            const reasons = [...new Set(r.skipped.map((s) => s.reason))];
            toast.success(`${r.updated.length} account${r.updated.length === 1 ? '' : 's'} updated`
                + (r.skipped.length ? ` · ${r.skipped.length} skipped (${reasons.join(', ')})` : ''));
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const exportMutation = useMutation({
        mutationFn: () => usersService.exportCsv(debouncedSearch, planFilter === 'all' ? undefined : planFilter, statusFilter),
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const pageIds: string[] = (data?.users ?? []).map((u: any) => u.id);
    const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const togglePage = () => setSelected((prev) => { const next = new Set(prev); pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id))); return next; });
    const confirmBulk = (action: 'ban' | 'unban' | 'set_role', role?: 'user' | 'admin' | 'super_admin') => {
        const n = selected.size;
        const what = action === 'ban' ? 'Suspend' : action === 'unban' ? 'Restore' : `Make ${role}`;
        if (window.confirm(`${what} ${n} account${n === 1 ? '' : 's'}?`)) bulkMutation.mutate({ action, role });
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">Manage users, roles, and permissions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as UserStatusFilter); setPage(1); }}>
                        <SelectTrigger className="w-36" aria-label="Status">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Everyone</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="banned">Suspended</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                        {exportMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Export CSV
                    </Button>
                    {/* Search */}
                    <div className="relative w-full sm:w-[250px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={handleSearch}
                            className="pl-8 w-full"
                        />
                    </div>
                </div>
            </div>

            {selected.size > 0 && (
                <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">{selected.size} selected</span>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={bulkMutation.isPending} onClick={() => confirmBulk('ban')}><Ban className="mr-1 h-3.5 w-3.5" />Suspend</Button>
                    <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => confirmBulk('unban')}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button>
                    {isSuper && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" disabled={bulkMutation.isPending}><UserCog className="mr-1 h-3.5 w-3.5" />Set role</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {(['user', 'admin', 'super_admin'] as const).map((r) => <DropdownMenuItem key={r} onClick={() => confirmBulk('set_role', r)}>{r}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}><X className="mr-1 h-3.5 w-3.5" />Clear</Button>
                </div>
            )}

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} />
                            </TableHead>
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
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">No users found.</TableCell>
                            </TableRow>
                        ) : (
                            data?.users.map((user: any) => (
                                <TableRow key={user.id} className={user.is_banned ? 'opacity-50' : ''} data-state={selected.has(user.id) ? 'selected' : undefined}>
                                    <TableCell>
                                        <input type="checkbox" aria-label={`Select ${user.email}`} checked={selected.has(user.id)} onChange={() => toggle(user.id)} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium">{user.full_name || '—'}</span>
                                                {user.is_banned && <span title="Suspended" aria-label="Suspended"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /></span>}
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
                                        {relativeTime(user.last_active_date)}
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
                                                    onClick={() => banMutation.mutate({ id: user.id, banned: !user.is_banned })}
                                                >
                                                    {user.is_banned ? 'Restore account' : 'Suspend account'}
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
