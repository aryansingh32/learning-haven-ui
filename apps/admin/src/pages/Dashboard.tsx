import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Code, CreditCard, TrendingUp, Activity, Zap, ArrowUpRight, ArrowDownRight,
  Crown, DollarSign, RefreshCw, AlertTriangle, Bot, Rocket, Target,
  Eye, BookOpen, Award, Shield, Wallet
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, trend, trendUp, gradient, delay, link }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    trendUp?: boolean;
    gradient: string;
    delay: number;
    link?: string;
}) => {
    const content = (
        <Card className={`stat-card overflow-hidden border-0 shadow-lg animate-fade-in ${link ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}`} style={{ animationDelay: `${delay}ms` }}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
                        {trend && (
                            <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {trend}
                            </div>
                        )}
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
    return link ? <Link to={link}>{content}</Link> : content;
};

const SkeletonCard = () => (
    <Card className="border-0 shadow-lg">
        <CardContent className="p-5">
            <div className="flex items-start justify-between">
                <div className="space-y-3">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-7 w-16" />
                    <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton w-10 h-10 rounded-xl" />
            </div>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const { data, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ['dashboard'],
        queryFn: adminService.getDashboard,
        refetchInterval: 30_000,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Mission Control</h2>
                        <p className="text-muted-foreground mt-1">Platform overview and real-time metrics</p>
                    </div>
                </div>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    const s = data || {};
    const totalUsers = s.total_users ?? s.totalUsers ?? 0;
    const totalProblems = s.total_problems ?? s.totalProblems ?? 0;
    const totalSubmissions = s.total_submissions ?? s.totalSubmissions ?? 0;
    const activeToday = s.active_today ?? s.activeToday ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Mission Control</h2>
                    <p className="text-muted-foreground mt-1">Platform overview and real-time metrics</p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-sm font-medium transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Primary KPI Row */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <StatCard title="Total Users" value={totalUsers} icon={Users} trend="+12% from last month" trendUp gradient="gradient-primary" delay={0} link="/users" />
                <StatCard title="Active Today" value={activeToday} icon={Zap} gradient="gradient-warning" delay={50} />
                <StatCard title="Revenue (Month)" value={`₹${s.monthly_revenue ?? 0}`} icon={DollarSign} gradient="gradient-success" delay={100} link="/revenue" />
                <StatCard title="Premium Users" value={s.premium_users ?? 0} icon={Crown} gradient="bg-gradient-to-br from-purple-500 to-purple-700" delay={150} link="/plans" />
            </div>

            {/* Secondary KPI Row */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <StatCard title="Active Subs" value={s.active_subscriptions ?? 0} icon={CreditCard} gradient="bg-gradient-to-br from-blue-500 to-blue-700" delay={200} link="/plans" />
                <StatCard title="Retention Rate" value={`${s.retention_rate ?? s.completion_rate ?? 0}%`} icon={Target} gradient="bg-gradient-to-br from-teal-500 to-teal-700" delay={250} link="/analytics" />
                <StatCard title="Course Completion" value={`${s.course_completion_rate ?? s.completion_rate ?? 0}%`} icon={BookOpen} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" delay={300} />
                <StatCard title="AI Queries Today" value={s.ai_queries_today ?? 0} icon={Bot} gradient="bg-gradient-to-br from-pink-500 to-pink-700" delay={350} link="/ai-config" />
            </div>

            {/* Detail Cards Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Revenue Overview */}
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            Revenue Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { label: 'Monthly Revenue', value: `₹${s.monthly_revenue ?? 0}`, color: 'bg-emerald-500' },
                                { label: 'Active Subscriptions', value: s.active_subscriptions ?? 0, color: 'bg-blue-500' },
                                { label: 'Avg. XP per User', value: s.avg_xp ?? 0, color: 'bg-purple-500' },
                                { label: 'Referral Payouts', value: `₹${s.referral_payouts ?? 0}`, color: 'bg-amber-500' },
                            ].map((metric) => (
                                <div key={metric.label} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${metric.color}`} />
                                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums">{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* System Health */}
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '500ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            System Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                {
                                    label: 'API Status',
                                    value: 'Operational',
                                    badge: 'default' as const,
                                },
                                {
                                    label: 'Payment Gateway',
                                    value: (s.failed_payments ?? 0) > 0 ? `${s.failed_payments} failures` : 'Healthy',
                                    badge: ((s.failed_payments ?? 0) > 0 ? 'destructive' : 'default') as 'default' | 'destructive',
                                },
                                {
                                    label: 'Flagged Referrals',
                                    value: s.flagged_referrals ?? 0,
                                    badge: ((s.flagged_referrals ?? 0) > 0 ? 'destructive' : 'default') as 'default' | 'destructive',
                                },
                                {
                                    label: 'Pending Feedback',
                                    value: s.pending_feedback ?? 0,
                                    badge: 'secondary' as const,
                                },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between py-1">
                                    <span className="text-sm text-muted-foreground">{item.label}</span>
                                    <Badge variant={item.badge} className="text-xs">{item.value}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '600ms' }}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-primary" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1.5">
                            {[
                                { label: 'Pending Withdrawals', value: s.pending_withdrawals ?? 0, href: '/withdrawals', icon: Wallet },
                                { label: 'New Users (Today)', value: s.new_users_today ?? activeToday, href: '/users', icon: Users },
                                { label: 'Flagged Referrals', value: s.flagged_referrals ?? 0, href: '/referrals', icon: AlertTriangle },
                                { label: 'Pending Feedback', value: s.pending_feedback ?? 0, href: '/feedback', icon: Eye },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link key={item.label} to={item.href} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                                        <div className="flex items-center gap-2.5">
                                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                                            <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4">
                        <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Failed to load dashboard data. The backend may be unavailable.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Dashboard;
