import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services/users.service';
import api from '../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Loader2, ArrowLeft, User as UserIcon, ShieldAlert, Activity, CreditCard,
    Bot, Clock, AlertTriangle, ShieldCheck, Mail, Calendar, Zap, Crown, Award
} from 'lucide-react';
import { toast } from 'sonner';

function relativeTime(ts?: string | null): string {
    if (!ts || ts.startsWith('1970') || new Date(ts).getFullYear() < 2000) return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    const days = Math.floor(diff / 86_400_000);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    ultra: 'bg-amber-100 text-amber-700',
};

const UserDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Admin override form state
    const [xpDelta, setXpDelta] = useState('');
    const [xpReason, setXpReason] = useState('');
    const [newPlan, setNewPlan] = useState('');
    const [planReason, setPlanReason] = useState('');
    const [certTopic, setCertTopic] = useState('');

    const { data: user, isLoading } = useQuery({
        queryKey: ['user', id],
        queryFn: () => usersService.getUser(id!),
        enabled: !!id
    });

    const { data: intel, isLoading: intelLoading } = useQuery({
        queryKey: ['user-intel', id],
        queryFn: () => usersService.getUserIntelligence(id!),
        enabled: !!id
    });

    const banMut = useMutation({
        mutationFn: () => usersService.toggleUserBan(id!),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            toast.success(res.banned ? 'User banned' : 'User unbanned');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const xpMut = useMutation({
        mutationFn: () => api.put(`/admin/users/${id}/xp`, { delta: Number(xpDelta), reason: xpReason }),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            toast.success(`XP updated — new balance: ${res.data.user?.xp ?? '?'} XP`);
            setXpDelta(''); setXpReason('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const planMut = useMutation({
        mutationFn: () => api.put(`/admin/users/${id}/plan`, { plan: newPlan, reason: planReason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            toast.success(`Plan overridden to ${newPlan}`);
            setNewPlan(''); setPlanReason('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const certMut = useMutation({
        mutationFn: () => api.post(`/admin/users/${id}/grant-certificate`, { topic_name: certTopic }),
        onSuccess: () => {
            toast.success(`Certificate granted for "${certTopic}"`);
            setCertTopic('');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    if (isLoading || !user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading user profile...</p>
            </div>
        );
    }

    const intelligence = intel || {
        fraudScore: 0, ltv: 0, lastActive: null,
        purchases: [], timeline: [],
        aiUsage: { totalTokens: 0, interactions: 0 }
    };

    const isHighRisk = intelligence.fraudScore > 75;
    const isMediumRisk = intelligence.fraudScore > 40 && intelligence.fraudScore <= 75;
    const ltv = intelligence.ltv ?? intelligence.purchases?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) ?? 0;
    const currentPlan = (user as any).current_plan ?? 'free';

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate('/users')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold tracking-tight">{(user as any).full_name || 'Unknown User'}</h2>
                            <Badge variant={(user as any).role === 'admin' ? 'default' : 'secondary'}>{(user as any).role}</Badge>
                            <Badge variant="outline" className={PLAN_COLORS[currentPlan] ?? PLAN_COLORS.free}>
                                {currentPlan.toUpperCase()}
                            </Badge>
                            {(user as any).is_banned
                                ? <Badge variant="destructive">Banned</Badge>
                                : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                            }
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm">
                            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {(user as any).email}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {new Date((user as any).created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <Button variant="destructive" onClick={() => banMut.mutate()} disabled={banMut.isPending}>
                    {banMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                    {(user as any).is_banned ? 'Unban User' : 'Ban User'}
                </Button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isHighRisk ? 'bg-red-100 text-red-600' : isMediumRisk ? 'bg-yellow-100 text-yellow-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {isHighRisk ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Fraud Score</p>
                            <h3 className="text-2xl font-bold">{intelLoading ? '—' : `${intelligence.fraudScore}/100`}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600"><CreditCard className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">LTV</p>
                            <h3 className="text-2xl font-bold">{intelLoading ? '—' : `₹${ltv.toLocaleString('en-IN')}`}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 text-purple-600"><Bot className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">AI Interactions</p>
                            <h3 className="text-2xl font-bold">{intelLoading ? '—' : intelligence.aiUsage?.interactions ?? 0}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-orange-100 text-orange-600"><Activity className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Last Active</p>
                            <h3 className="text-lg font-bold mt-1">
                                {intelLoading ? '—' : relativeTime(intelligence.lastActive)}
                            </h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList>
                    <TabsTrigger value="timeline" className="flex gap-2"><Clock className="w-4 h-4" /> Activity</TabsTrigger>
                    <TabsTrigger value="purchases" className="flex gap-2"><CreditCard className="w-4 h-4" /> Purchases</TabsTrigger>
                    <TabsTrigger value="ai" className="flex gap-2"><Bot className="w-4 h-4" /> AI Usage</TabsTrigger>
                    <TabsTrigger value="controls" className="flex gap-2"><ShieldCheck className="w-4 h-4" /> Admin Controls</TabsTrigger>
                </TabsList>

                {/* Activity Timeline */}
                <TabsContent value="timeline" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">User Journey</CardTitle>
                            <CardDescription>Chronological timeline of critical user events.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {intelLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : intelligence.timeline.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
                            ) : (
                                <div className="space-y-4">
                                    {intelligence.timeline.map((event: any, i: number) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                                {i !== intelligence.timeline.length - 1 && <div className="w-0.5 h-full bg-border my-1" />}
                                            </div>
                                            <div className="pb-4">
                                                <p className="text-sm font-medium">{event.action}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Purchases */}
                <TabsContent value="purchases" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Purchase History</CardTitle>
                            <CardDescription>All transactions and subscriptions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {intelLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : intelligence.purchases.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No purchases found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {intelligence.purchases.map((p: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                            <div>
                                                <p className="font-medium text-sm">{p.plan_name}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-sm">₹{(p.amount || 0).toLocaleString('en-IN')}</p>
                                                <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* AI Usage */}
                <TabsContent value="ai" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">AI & Learning Analytics</CardTitle>
                            <CardDescription>Real usage data from this user's AI interactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {intelLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total AI Queries</p>
                                        <p className="text-3xl font-bold">{intelligence.aiUsage?.interactions ?? 0}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Tokens Used</p>
                                        <p className="text-3xl font-bold">{(intelligence.aiUsage?.totalTokens ?? 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Admin Controls */}
                <TabsContent value="controls" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* XP Adjustment */}
                        <Card className="border-amber-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500" /> XP Adjustment
                                </CardTitle>
                                <CardDescription>
                                    Current XP: <strong>{(user as any).xp ?? 0}</strong>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Delta (use negative to deduct)</Label>
                                    <Input
                                        type="number"
                                        placeholder="+100 or -50"
                                        value={xpDelta}
                                        onChange={(e) => setXpDelta(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reason</Label>
                                    <Input
                                        placeholder="e.g. Bug compensation"
                                        value={xpReason}
                                        onChange={(e) => setXpReason(e.target.value)}
                                    />
                                </div>
                                <Button
                                    size="sm" className="w-full"
                                    disabled={xpMut.isPending || !xpDelta}
                                    onClick={() => xpMut.mutate()}
                                >
                                    {xpMut.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-2 h-3.5 w-3.5" />}
                                    Apply XP Change
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Plan Override */}
                        <Card className="border-purple-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-purple-500" /> Plan Override
                                </CardTitle>
                                <CardDescription>
                                    Current plan: <strong className="capitalize">{currentPlan}</strong>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">New Plan</Label>
                                    <Select value={newPlan} onValueChange={setNewPlan}>
                                        <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="free">Free</SelectItem>
                                            <SelectItem value="basic">Basic</SelectItem>
                                            <SelectItem value="pro">Pro</SelectItem>
                                            <SelectItem value="ultra">Ultra</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reason</Label>
                                    <Input
                                        placeholder="e.g. Support ticket #123"
                                        value={planReason}
                                        onChange={(e) => setPlanReason(e.target.value)}
                                    />
                                </div>
                                <Button
                                    size="sm" className="w-full"
                                    disabled={planMut.isPending || !newPlan}
                                    onClick={() => planMut.mutate()}
                                >
                                    {planMut.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Crown className="mr-2 h-3.5 w-3.5" />}
                                    Override Plan
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Grant Certificate */}
                        <Card className="border-emerald-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Award className="w-4 h-4 text-emerald-500" /> Grant Certificate
                                </CardTitle>
                                <CardDescription>Manually award a certificate to this user</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Topic Name</Label>
                                    <Input
                                        placeholder="e.g. Arrays & Hashing"
                                        value={certTopic}
                                        onChange={(e) => setCertTopic(e.target.value)}
                                    />
                                </div>
                                <Button
                                    size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-auto"
                                    disabled={certMut.isPending || !certTopic}
                                    onClick={() => certMut.mutate()}
                                >
                                    {certMut.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Award className="mr-2 h-3.5 w-3.5" />}
                                    Grant Certificate
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default UserDetail;
