import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsService } from '../services/referrals.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, CheckCircle, XCircle, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const Referrals = () => {
    const [page, setPage] = useState(1);
    const [tab, setTab] = useState<'all' | 'flagged'>('all');
    const queryClient = useQueryClient();

    const { data: stats } = useQuery({
        queryKey: ['referral-stats'],
        queryFn: referralsService.getStats,
    });

    const { data: allData, isLoading: loadingAll } = useQuery({
        queryKey: ['referrals-all', page],
        queryFn: () => referralsService.listAll(page, 20),
        enabled: tab === 'all',
    });

    const { data: flaggedData, isLoading: loadingFlagged } = useQuery({
        queryKey: ['referrals-flagged'],
        queryFn: referralsService.getFlagged,
        enabled: tab === 'flagged',
    });

    const verifyMut = useMutation({
        mutationFn: (id: string) => referralsService.verify(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['referrals-all'] });
            queryClient.invalidateQueries({ queryKey: ['referrals-flagged'] });
            queryClient.invalidateQueries({ queryKey: ['referral-stats'] });
            toast.success('Referral verified');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const rejectMut = useMutation({
        mutationFn: (id: string) => referralsService.reject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['referrals-all'] });
            queryClient.invalidateQueries({ queryKey: ['referrals-flagged'] });
            queryClient.invalidateQueries({ queryKey: ['referral-stats'] });
            toast.success('Referral rejected');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const referralsList = tab === 'all'
        ? (Array.isArray(allData) ? allData : allData?.referrals ?? allData?.data ?? [])
        : (Array.isArray(flaggedData) ? flaggedData : flaggedData?.referrals ?? flaggedData?.data ?? []);
    const isLoading = tab === 'all' ? loadingAll : loadingFlagged;

    const s = stats || {};

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Referrals</h2>
                <p className="text-muted-foreground mt-1">Track and manage the referral program</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                {[
                    { label: 'Total Referrals', value: s.total ?? 0, icon: Zap, gradient: 'gradient-primary' },
                    { label: 'Verified', value: s.verified ?? 0, icon: CheckCircle, gradient: 'gradient-success' },
                    { label: 'Pending', value: s.pending ?? 0, icon: Users, gradient: 'gradient-warning' },
                    { label: 'Flagged', value: s.flagged ?? 0, icon: AlertTriangle, gradient: 'gradient-destructive' },
                ].map((stat) => (
                    <Card key={stat.label} className="border-0 shadow-md stat-card">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${stat.gradient} flex items-center justify-center`}>
                                    <stat.icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-xl font-bold">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Button variant={tab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTab('all')}>All Referrals</Button>
                <Button variant={tab === 'flagged' ? 'default' : 'outline'} size="sm" onClick={() => setTab('flagged')}>
                    <AlertTriangle className="mr-1 h-3 w-3" /> Flagged
                </Button>
            </div>

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Referrer</TableHead>
                                <TableHead>Referred</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="w-[140px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !referralsList.length ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No referrals found</TableCell></TableRow>
                            ) : (
                                referralsList.map((ref: any) => (
                                    <TableRow key={ref.id} className="group">
                                        <TableCell className="font-medium">{ref.referrer_email ?? ref.referrer?.email ?? ref.referrer_id?.slice(0, 8)}</TableCell>
                                        <TableCell>{ref.referred_email ?? ref.referred?.email ?? ref.referred_id?.slice(0, 8)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                ref.status === 'verified' ? 'bg-green-100 text-green-800' :
                                                    ref.status === 'flagged' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                            }>{ref.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{new Date(ref.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700"
                                                    onClick={() => verifyMut.mutate(ref.id)} disabled={ref.status === 'verified'}
                                                >
                                                    <CheckCircle className="mr-1 h-3 w-3" /> Verify
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                                    onClick={() => rejectMut.mutate(ref.id)} disabled={ref.status === 'rejected'}
                                                >
                                                    <XCircle className="mr-1 h-3 w-3" /> Reject
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {tab === 'all' && (
                <div className="flex items-center justify-end space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                    <div className="text-sm font-medium">Page {page}</div>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!referralsList.length || referralsList.length < 20}>Next</Button>
                </div>
            )}
        </div>
    );
};

export default Referrals;
