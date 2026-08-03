import { useQuery } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Activity, Users, IndianRupee, Award, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString('en-IN');
const formatMoney = (value: number | string | null | undefined) => `₹${formatNumber(value)}`;

const OverviewPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['apprenticeship-admin-overview'],
    queryFn: () => apprenticeshipApi.getOverview(),
    refetchInterval: 10000,
  });

  const overview = data?.overview;
  const kpis = overview?.kpis || {};
  const events = overview?.latest_events || [];
  const struggling = overview?.struggling_students || [];
  const pending = overview?.pending_manual_reviews || [];
  const monthly = overview?.monthly_enrollments || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Apprenticeship Overview</h2>
        <p className="text-muted-foreground">Operational view of enrollments, activity, and review backlog.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total Enrollments', value: kpis.total_enrollments, icon: Users },
          { label: 'Active Enrollments', value: kpis.active_enrollments, icon: Activity },
          { label: 'Revenue', value: formatMoney(kpis.total_revenue_inr), icon: IndianRupee },
          { label: 'Avg Completion', value: `${kpis.avg_completion_rate || 0}%`, icon: TrendingUp },
          { label: 'Certificates', value: kpis.certificates_issued, icon: Award },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{isLoading ? '—' : value ?? 0}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Enrollment Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground">No enrollment trend data yet.</p>
            ) : (
              monthly.map((row: any) => (
                <div key={row.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.month}</span>
                    <span className="text-muted-foreground">{row.enrollments} enrollments</span>
                  </div>
                  <div className="h-2 rounded-full bg-accent">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(8, (Number(row.enrollments) / Math.max(...monthly.map((item: any) => Number(item.enrollments) || 1))) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Live Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity captured yet.</p>
            ) : events.map((event: any) => (
              <div key={event.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{event.event_type}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {event.project_id ? `Project ${event.project_id}` : 'Platform event'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Struggling Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {struggling.length === 0 ? (
              <p className="text-sm text-muted-foreground">No struggling students detected.</p>
            ) : struggling.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{row.full_name}</p>
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                  <p className="text-xs text-muted-foreground">{row.program_title}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/apprenticeship/notifications')}>
                  Send Nudge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Pending Manual Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions in manual review.</p>
            ) : pending.map((row: any) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate('/apprenticeship/submissions')}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">Submission {row.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">{new Date(row.submitted_at).toLocaleString()}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewPage;
