import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawalsService } from '../services/withdrawals.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const Withdrawals = () => {
    const [page, setPage] = useState(1);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-withdrawals', page],
        queryFn: () => withdrawalsService.list(page, 20),
    });

    const processMut = useMutation({
        mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
            withdrawalsService.process(id, action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
            toast.success('Withdrawal processed');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const withdrawalsList = Array.isArray(data) ? data : data?.withdrawals ?? data?.data ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Withdrawals</h2>
                <p className="text-muted-foreground mt-1">Process and manage user withdrawal requests</p>
            </div>

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Requested</TableHead>
                                <TableHead className="w-[160px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !withdrawalsList.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No withdrawal requests
                                </TableCell></TableRow>
                            ) : (
                                withdrawalsList.map((w: any) => (
                                    <TableRow key={w.id} className="group">
                                        <TableCell className="font-medium">{w.user?.email ?? w.user_id?.slice(0, 8)}</TableCell>
                                        <TableCell className="font-semibold">₹{w.amount}</TableCell>
                                        <TableCell><Badge variant="outline">{w.method || 'UPI'}</Badge></TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                w.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                    w.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                            }>{w.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {w.status === 'pending' && (
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700"
                                                        onClick={() => processMut.mutate({ id: w.id, action: 'approve' })}
                                                    >
                                                        <CheckCircle className="mr-1 h-3 w-3" /> Approve
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                                        onClick={() => processMut.mutate({ id: w.id, action: 'reject' })}
                                                    >
                                                        <XCircle className="mr-1 h-3 w-3" /> Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
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
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!withdrawalsList.length || withdrawalsList.length < 20}>Next</Button>
            </div>
        </div>
    );
};

export default Withdrawals;
