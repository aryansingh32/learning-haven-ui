import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Save, Star } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../services/admin.service';

import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, Clock, DollarSign, TrendingUp, XCircle } from 'lucide-react';

function ReferralOverview() {
    const { data, isLoading } = useQuery({
        queryKey: ['referral-stats'],
        queryFn: async () => {
            const res = await api.get('/admin/referrals/stats');
            return res.data;
        },
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

    const s = data || {};
    const stats = [
        { label: 'Total Referrals', value: s.total ?? 0, icon: Users, color: 'bg-blue-100 text-blue-600' },
        { label: 'Pending Review', value: s.pending ?? 0, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
        { label: 'Active Referrals', value: s.active ?? 0, icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
        { label: 'Paid Out', value: s.paid ?? 0, icon: DollarSign, color: 'bg-purple-100 text-purple-600' },
        { label: 'Rejected', value: s.rejected ?? 0, icon: XCircle, color: 'bg-red-100 text-red-600' },
        { label: 'Total Earned', value: `₹${((s.total_earned ?? 0) / 100).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'bg-indigo-100 text-indigo-600' },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.label} className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {(s.total_paid ?? 0) > 0 && (
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Paid Out</p>
                        <p className="text-3xl font-bold text-emerald-600">₹{((s.total_paid ?? 0) / 100).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-muted-foreground mt-1">Across {s.paid ?? 0} completed referrals</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function Referrals() {

    const queryClient = useQueryClient();
    
    // In a real implementation, adminService.getCustomReferrals() and adminService.createCustomReferral()
    // would hit the /api/admin/referrals/custom endpoints.
    const { data: customCodes, isLoading } = useQuery({
        queryKey: ['custom-referrals'],
        queryFn: async () => {
            const res = await adminService.api.get('/admin/referrals/custom');
            return res.data.data;
        },
    });

    const createMut = useMutation({
        mutationFn: async (payload: any) => {
            const res = await adminService.api.post('/admin/referrals/custom', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['custom-referrals'] });
            toast.success('Custom referral code generated!');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message)
    });

    const [form, setForm] = useState({
        user_id: '',
        code: '',
        reward_amount: 15000,
        commission_percentage: '',
        is_primary: true
    });

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Referral Management</h2>
                <p className="text-muted-foreground mt-1">Manage referrals, payouts, and custom tracking codes.</p>
            </div>

            <Tabs defaultValue="custom" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="custom">Custom Codes</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <ReferralOverview />
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle>Generate Custom Referral Code</CardTitle>
                            <CardDescription>Assign specific users a custom code with dynamic rewards (e.g. ₹150 instead of ₹100, or a 50% commission).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>User ID</Label>
                                    <Input value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} placeholder="UUID of the user" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Custom Code</Label>
                                    <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. PRO_INFLUENCER_50" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Reward Amount (in paise)</Label>
                                    <Input type="number" value={form.reward_amount} onChange={e => setForm({...form, reward_amount: parseInt(e.target.value)})} />
                                    <p className="text-xs text-muted-foreground">15000 = ₹150</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Commission % (Optional)</Label>
                                    <Input type="number" value={form.commission_percentage} onChange={e => setForm({...form, commission_percentage: e.target.value})} placeholder="e.g. 50" />
                                    <p className="text-xs text-muted-foreground">Overrides fixed reward if applicable.</p>
                                </div>
                            </div>
                            <Button 
                                className="mt-4" 
                                disabled={createMut.isPending || !form.user_id || !form.code}
                                onClick={() => createMut.mutate({
                                    ...form,
                                    commission_percentage: form.commission_percentage ? parseInt(form.commission_percentage) : null
                                })}
                            >
                                <Plus className="mr-2 h-4 w-4" /> 
                                {createMut.isPending ? 'Saving...' : 'Generate Code'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle>Active Custom Codes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {customCodes?.map((c: any) => (
                                    <div key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-primary">{c.code}</span>
                                                {c.is_primary && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Star className="w-3 h-3"/> Primary</span>}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">User: {c.users?.full_name} ({c.user_id})</p>
                                        </div>
                                        <div className="text-right mt-2 sm:mt-0">
                                            <p className="text-sm font-semibold">₹{c.reward_amount / 100}</p>
                                            {c.commission_percentage && <p className="text-xs text-muted-foreground">{c.commission_percentage}% Comm.</p>}
                                        </div>
                                    </div>
                                ))}
                                {(!customCodes || customCodes.length === 0) && (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No custom codes generated yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
