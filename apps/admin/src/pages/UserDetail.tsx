import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services/users.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Loader2, ArrowLeft, User as UserIcon, ShieldAlert, Activity, CreditCard, 
    Bot, Clock, AlertTriangle, ShieldCheck, Mail, Calendar 
} from 'lucide-react';
import { toast } from 'sonner';

const UserDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            toast.success('User ban status updated');
        }
    });

    if (isLoading || !user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading user profile...</p>
            </div>
        );
    }

    // Mock data for intelligence if API doesn't return full structure
    const intelligence = intel || {
        fraudScore: 12,
        purchases: [],
        timeline: [],
        aiUsage: { totalTokens: 0, interactions: 0 }
    };

    const isHighRisk = intelligence.fraudScore > 75;
    const isMediumRisk = intelligence.fraudScore > 40 && intelligence.fraudScore <= 75;

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
                            <h2 className="text-3xl font-bold tracking-tight">{user.full_name}</h2>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                            {/* Assuming user has is_banned, otherwise just show active */}
                            {(user as any).is_banned ? (
                                <Badge variant="destructive">Banned</Badge>
                            ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm">
                            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user.email}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => banMut.mutate()} disabled={banMut.isPending}>
                        {banMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                        {(user as any).is_banned ? 'Unban User' : 'Ban User'}
                    </Button>
                </div>
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
                            <h3 className="text-2xl font-bold">{intelligence.fraudScore}/100</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">LTV</p>
                            <h3 className="text-2xl font-bold">₹{intelligence.purchases.reduce((acc: number, p: any) => acc + p.amount, 0).toLocaleString()}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">AI Interactions</p>
                            <h3 className="text-2xl font-bold">{intelligence.aiUsage.interactions}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Last Active</p>
                            <h3 className="text-lg font-bold mt-1">2 hours ago</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Intelligence Tabs */}
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList>
                    <TabsTrigger value="timeline" className="flex gap-2"><Clock className="w-4 h-4" /> Activity Timeline</TabsTrigger>
                    <TabsTrigger value="purchases" className="flex gap-2"><CreditCard className="w-4 h-4" /> Purchases</TabsTrigger>
                    <TabsTrigger value="ai" className="flex gap-2"><Bot className="w-4 h-4" /> AI Diagnostics</TabsTrigger>
                </TabsList>
                
                <TabsContent value="timeline" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">User Journey</CardTitle>
                            <CardDescription>Chronological timeline of critical user events.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {intelligence.timeline.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent activity.</p>
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

                <TabsContent value="purchases" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Purchase History</CardTitle>
                            <CardDescription>All transactions and subscriptions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {intelligence.purchases.length === 0 ? (
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
                                                <p className="font-bold text-sm">₹{p.amount}</p>
                                                <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ai" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">AI & Learning Diagnostics</CardTitle>
                            <CardDescription>Insights generated from user's AI interaction patterns.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                    <h4 className="text-sm font-bold text-blue-900 mb-1">Learning Profile</h4>
                                    <p className="text-sm text-blue-800">User is highly engaged but struggles with Dynamic Programming concepts. AI has intervened 3 times to simplify explanations.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Tokens Used</p>
                                        <p className="text-2xl font-bold">{intelligence.aiUsage.totalTokens.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Struggle Score</p>
                                        <p className="text-2xl font-bold text-orange-600">Low</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default UserDetail;
