import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, X } from 'lucide-react';

const AuditLogs = () => {
    const [page, setPage] = useState(1);
    
    // Filters state
    const [actionFilter, setActionFilter] = useState('');
    const [adminIdFilter, setAdminIdFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Debounced values for API
    const [debouncedFilters, setDebouncedFilters] = useState({
        action: '', admin_id: '', from: '', to: ''
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilters({
                action: actionFilter,
                admin_id: adminIdFilter,
                from: fromDate,
                to: toDate
            });
            setPage(1); // Reset to page 1 on filter change
        }, 300);
        return () => clearTimeout(timer);
    }, [actionFilter, adminIdFilter, fromDate, toDate]);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-logs', page, debouncedFilters],
        queryFn: async () => {
            // Using adminService.api to fetch with params
            const params = new URLSearchParams();
            if (debouncedFilters.action) params.append('action', debouncedFilters.action);
            if (debouncedFilters.admin_id) params.append('admin_id', debouncedFilters.admin_id);
            if (debouncedFilters.from) params.append('from', debouncedFilters.from);
            if (debouncedFilters.to) params.append('to', debouncedFilters.to);
            params.append('page', page.toString());
            params.append('limit', '25');
            
            const res = await adminService.api.get(`/admin/audit-logs?${params.toString()}`);
            return res.data;
        },
    });

    const logs = Array.isArray(data) ? data : data?.logs ?? data?.data ?? [];

    const getActionColor = (action: string) => {
        if (action?.includes('delete') || action?.includes('ban')) return 'bg-red-100 text-red-800';
        if (action?.includes('create') || action?.includes('add')) return 'bg-green-100 text-green-800';
        if (action?.includes('update') || action?.includes('edit')) return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    const clearFilters = () => {
        setActionFilter('');
        setAdminIdFilter('');
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
                <p className="text-muted-foreground mt-1">Track all administrative actions and system events</p>
            </div>

            <Card className="p-4 border-0 shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>Action</Label>
                        <Input 
                            placeholder="Filter by action..." 
                            value={actionFilter} 
                            onChange={(e) => setActionFilter(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Admin ID</Label>
                        <Input 
                            placeholder="Filter by Admin ID..." 
                            value={adminIdFilter} 
                            onChange={(e) => setAdminIdFilter(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>From Date</Label>
                        <Input 
                            type="date"
                            value={fromDate} 
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>To Date</Label>
                        <Input 
                            type="date"
                            value={toDate} 
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={clearFilters} className="w-full">
                        <X className="mr-2 h-4 w-4" /> Clear Filters
                    </Button>
                </div>
            </Card>

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !logs.length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    <Shield className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No audit logs found
                                </TableCell></TableRow>
                            ) : (
                                logs.map((log: any, i: number) => (
                                    <TableRow key={log.id ?? i}>
                                        <TableCell>
                                            <Badge variant="outline" className={getActionColor(log.action)}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{log.admin_email ?? log.user_email ?? log.admin_id?.slice(0, 8)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{log.target_type ?? '—'} {log.target_id ? `#${log.target_id.slice(0, 8)}` : ''}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex items-center justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <div className="text-sm font-medium">Page {page}</div>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!logs.length || logs.length < 25}>Next</Button>
            </div>
        </div>
    );
};

export default AuditLogs;
