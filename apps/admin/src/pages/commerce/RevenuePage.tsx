import { useQuery } from '@tanstack/react-query';
import { commerceAdminService, type RevenueStats } from '../../services/commerce.admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Users,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Crown,
  Zap, BarChart3, PieChart, AlertTriangle, Receipt
} from 'lucide-react';
import { useState } from 'react';

const RevenuePage = () => {
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: commerceAdminService.getRevenueStats,
    refetchInterval: 60_000,
  });

  const s = stats || {} as RevenueStats;

  const topCards = [
    {
      title: 'Revenue Today', value: `₹${(s.revenue_today || 0).toLocaleString('en-IN')}`,
      icon: DollarSign, gradient: 'gradient-success', trend: null,
    },
    {
      title: 'Monthly Revenue', value: `₹${(s.revenue_this_month || 0).toLocaleString('en-IN')}`,
      icon: TrendingUp, gradient: 'gradient-primary',
      trend: s.revenue_last_month ? `${((((s.revenue_this_month || 0) - s.revenue_last_month) / s.revenue_last_month) * 100).toFixed(1)}% vs last month` : null,
      trendUp: (s.revenue_this_month || 0) >= (s.revenue_last_month || 0),
    },
    {
      title: 'MRR', value: `₹${(s.mrr || 0).toLocaleString('en-IN')}`,
      icon: BarChart3, gradient: 'gradient-warning', trend: null,
    },
    {
      title: 'Active Subs', value: s.active_subscriptions || 0,
      icon: Crown, gradient: 'gradient-destructive', trend: `${s.new_subscriptions_today || 0} new today`,
      trendUp: true,
    },
  ];

  const metricCards = [
    { label: 'ARR (Annual)', value: `₹${((s.arr || 0) / 1000).toFixed(1)}K`, color: 'text-emerald-500' },
    { label: 'ARPU', value: `₹${(s.avg_revenue_per_user || 0).toFixed(0)}`, color: 'text-blue-500' },
    { label: 'LTV', value: `₹${(s.ltv || 0).toFixed(0)}`, color: 'text-purple-500' },
    { label: 'Churn Rate', value: `${(s.churn_rate || 0).toFixed(1)}%`, color: (s.churn_rate || 0) > 5 ? 'text-destructive' : 'text-emerald-500' },
    { label: 'Conversion Rate', value: `${(s.conversion_rate || 0).toFixed(1)}%`, color: 'text-primary' },
    { label: 'Total Orders', value: s.total_orders || 0, color: 'text-foreground' },
    { label: 'Failed Orders', value: s.failed_orders || 0, color: (s.failed_orders || 0) > 0 ? 'text-destructive' : 'text-muted-foreground' },
    { label: 'Refunded', value: s.refunded_orders || 0, color: (s.refunded_orders || 0) > 0 ? 'text-orange-500' : 'text-muted-foreground' },
    { label: 'Pending Withdrawals', value: s.pending_withdrawals || 0, color: (s.pending_withdrawals || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground' },
    { label: 'Referral Payouts', value: `₹${(s.total_referral_payouts || 0).toLocaleString('en-IN')}`, color: 'text-primary' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Revenue Analytics</h2>
          <p className="text-muted-foreground mt-1">Financial performance and subscription metrics</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Revenue Analytics</h2>
          <p className="text-muted-foreground mt-1">Financial performance and subscription metrics</p>
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

      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {topCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="stat-card overflow-hidden border-0 shadow-lg animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold tracking-tight tabular-nums">{card.value}</p>
                    {card.trend && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${card.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                        {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {card.trend}
                      </div>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Metrics Grid */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            Detailed Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {metricCards.map((metric) => (
              <div key={metric.label} className="rounded-xl bg-accent/30 p-4 text-center hover:bg-accent/50 transition-colors">
                <p className={`text-2xl font-bold tabular-nums ${metric.color}`}>{metric.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{metric.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart Placeholder & Plan Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Revenue */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Daily Revenue (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.daily_revenue && s.daily_revenue.length > 0 ? (
              <div className="space-y-1.5">
                {s.daily_revenue.slice(-14).map((day) => {
                  const maxAmount = Math.max(...s.daily_revenue!.map(d => d.amount));
                  const pct = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                  return (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 tabular-nums">{new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      <div className="flex-1 h-5 bg-accent/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-16 text-right">₹{day.amount.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Revenue data will appear when orders are processed
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.plan_distribution && s.plan_distribution.length > 0 ? (
              <div className="space-y-3">
                {s.plan_distribution.map((plan) => {
                  const totalSubs = s.plan_distribution!.reduce((sum, p) => sum + p.count, 0);
                  const pct = totalSubs > 0 ? (plan.count / totalSubs) * 100 : 0;
                  return (
                    <div key={plan.plan} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{plan.plan}</Badge>
                          <span className="text-xs text-muted-foreground">{plan.count} users</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">₹{plan.revenue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-2 bg-accent/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <PieChart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Plan distribution will appear with active subscriptions
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {((s.failed_orders || 0) > 0 || (s.pending_withdrawals || 0) > 0) && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {(s.failed_orders || 0) > 0 && `${s.failed_orders} failed orders. `}
                {(s.pending_withdrawals || 0) > 0 && `${s.pending_withdrawals} pending withdrawals need processing.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RevenuePage;
