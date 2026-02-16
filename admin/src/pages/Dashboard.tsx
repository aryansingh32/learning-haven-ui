import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Code, CreditCard, TrendingUp, Activity, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendUp, gradient, delay }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    trendUp?: boolean;
    gradient: string;
    delay: number;
}) => (
    <Card className="stat-card overflow-hidden border-0 shadow-lg animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
        <CardContent className="p-6">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold tracking-tight animate-count-up">{value}</p>
                    {trend && (
                        <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {trend}
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const SkeletonCard = () => (
    <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
            <div className="flex items-start justify-between">
                <div className="space-y-3">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-8 w-16" />
                    <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton w-12 h-12 rounded-xl" />
            </div>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard'],
        queryFn: adminService.getDashboard,
    });

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Platform overview and key metrics</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    const stats = data || {};
    const totalUsers = stats.total_users ?? stats.totalUsers ?? 0;
    const totalProblems = stats.total_problems ?? stats.totalProblems ?? 0;
    const totalSubmissions = stats.total_submissions ?? stats.totalSubmissions ?? 0;
    const activeToday = stats.active_today ?? stats.activeToday ?? 0;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground mt-1">Platform overview and key metrics</p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Users"
                    value={totalUsers}
                    icon={Users}
                    trend="+12% from last month"
                    trendUp={true}
                    gradient="gradient-primary"
                    delay={0}
                />
                <StatCard
                    title="Problems"
                    value={totalProblems}
                    icon={Code}
                    gradient="gradient-success"
                    delay={100}
                />
                <StatCard
                    title="Submissions"
                    value={totalSubmissions}
                    icon={Activity}
                    trend="+8% this week"
                    trendUp={true}
                    gradient="gradient-warning"
                    delay={200}
                />
                <StatCard
                    title="Active Today"
                    value={activeToday}
                    icon={Zap}
                    gradient="gradient-destructive"
                    delay={300}
                />
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            Platform Metrics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { label: 'Completion Rate', value: `${stats.completion_rate ?? 0}%`, color: 'bg-primary' },
                                { label: 'Avg. XP per User', value: stats.avg_xp ?? 0, color: 'bg-green-500' },
                                { label: 'Premium Users', value: stats.premium_users ?? 0, color: 'bg-purple-500' },
                            ].map((metric) => (
                                <div key={metric.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${metric.color}`} />
                                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                                    </div>
                                    <span className="text-sm font-semibold">{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '500ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary" />
                            Revenue Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { label: 'Monthly Revenue', value: `₹${stats.monthly_revenue ?? 0}`, color: 'bg-emerald-500' },
                                { label: 'Active Subscriptions', value: stats.active_subscriptions ?? 0, color: 'bg-blue-500' },
                                { label: 'Pending Withdrawals', value: stats.pending_withdrawals ?? 0, color: 'bg-orange-500' },
                            ].map((metric) => (
                                <div key={metric.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${metric.color}`} />
                                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                                    </div>
                                    <span className="text-sm font-semibold">{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '600ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {[
                                { label: 'Pending Feedback', value: stats.pending_feedback ?? 0 },
                                { label: 'Flagged Referrals', value: stats.flagged_referrals ?? 0 },
                                { label: 'New Users (Today)', value: stats.new_users_today ?? activeToday },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                                    <span className="text-sm text-muted-foreground">{item.label}</span>
                                    <span className="text-sm font-semibold">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4">
                        <p className="text-sm text-destructive">Failed to load dashboard data. The backend may be unavailable.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Dashboard;
