import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawalsService } from '../services/withdrawals.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, DollarSign, CheckCircle, XCircle, ChevronDown, ChevronRight, User, Phone, CreditCard, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const Withdrawals = () => {
    const [page, setPage] = useState(1);
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processDialog, setProcessDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
    const [processNotes, setProcessNotes] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin-withdrawals', page],
        queryFn: () => withdrawalsService.list(page, 20),
    });

    const processMut = useMutation({
        mutationFn: ({ id, action, notes }: { id: string; action: 'approve' | 'reject'; notes?: string }) =>
            withdrawalsService.process(id, action, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
            toast.success('Withdrawal processed');
            setProcessDialog(null);
            setProcessNotes('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const handleProcess = () => {
        if (!processDialog) return;
        processMut.mutate({ id: processDialog.id, action: processDialog.action, notes: processNotes });
    };

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
                                <TableHead className="w-[40px]"></TableHead>
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
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !withdrawalsList.length ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No withdrawal requests
                                </TableCell></TableRow>
                            ) : (
                                withdrawalsList.map((w: any) => (
                                    <React.Fragment key={w.id}>
                                        <TableRow className="group cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}>
                                            <TableCell>
                                                {expandedId === w.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </TableCell>
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
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {w.status === 'pending' && (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700"
                                                            onClick={() => setProcessDialog({ id: w.id, action: 'approve' })}
                                                        >
                                                            <CheckCircle className="mr-1 h-3 w-3" /> Approve
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                                            onClick={() => setProcessDialog({ id: w.id, action: 'reject' })}
                                                        >
                                                            <XCircle className="mr-1 h-3 w-3" /> Reject
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {expandedId === w.id && (
                                            <TableRow className="bg-muted/30">
                                                <TableCell colSpan={7} className="p-4">
                                                    <Card className="bg-background border-muted">
                                                        <CardContent className="p-4">
                                                            <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                Payment Destination Details
                                                            </h4>
                                                            {(!w.upi_id && !w.bank_account && !w.ifsc_code && !w.account_holder_name && !w.phone) ? (
                                                                <p className="text-sm text-muted-foreground italic">No payment details provided</p>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                                                    {w.upi_id && (
                                                                        <div>
                                                                            <span className="text-muted-foreground block text-xs">UPI ID</span>
                                                                            <span className="font-medium flex items-center gap-1 mt-1"><Hash className="h-3 w-3" /> {w.upi_id}</span>
                                                                        </div>
                                                                    )}
                                                                    {w.account_holder_name && (
                                                                        <div>
                                                                            <span className="text-muted-foreground block text-xs">Account Name</span>
                                                                            <span className="font-medium flex items-center gap-1 mt-1"><User className="h-3 w-3" /> {w.account_holder_name}</span>
                                                                        </div>
                                                                    )}
                                                                    {w.bank_account && (
                                                                        <div>
                                                                            <span className="text-muted-foreground block text-xs">Bank Account</span>
                                                                            <span className="font-medium flex items-center gap-1 mt-1"><CreditCard className="h-3 w-3" /> {w.bank_account}</span>
                                                                        </div>
                                                                    )}
                                                                    {w.ifsc_code && (
                                                                        <div>
                                                                            <span className="text-muted-foreground block text-xs">IFSC Code</span>
                                                                            <span className="font-medium flex items-center gap-1 mt-1"><Hash className="h-3 w-3" /> {w.ifsc_code}</span>
                                                                        </div>
                                                                    )}
                                                                    {w.phone && (
                                                                        <div>
                                                                            <span className="text-muted-foreground block text-xs">Phone</span>
                                                                            <span className="font-medium flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {w.phone}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
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

            <Dialog open={!!processDialog} onOpenChange={(open) => !open && setProcessDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {processDialog?.action === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
                        <Textarea 
                            placeholder="Add any internal notes..."
                            value={processNotes}
                            onChange={(e) => setProcessNotes(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProcessDialog(null)}>Cancel</Button>
                        <Button 
                            variant={processDialog?.action === 'reject' ? 'destructive' : 'default'}
                            onClick={handleProcess}
                            disabled={processMut.isPending}
                        >
                            {processMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm {processDialog?.action}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Withdrawals;
