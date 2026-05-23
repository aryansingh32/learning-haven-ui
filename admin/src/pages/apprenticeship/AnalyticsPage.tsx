import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Tab = 'funnel' | 'dropoff' | 'ai_queries' | 'quality';

const AnalyticsPage = () => {
  const [tab, setTab] = useState<Tab>('funnel');
  const { data } = useQuery({
    queryKey: ['apprenticeship-admin-analytics'],
    queryFn: () => apprenticeshipApi.getAnalytics(),
  });

  const analytics = data?.analytics || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">Funnel, drop-off, AI query patterns, and code quality distribution.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['funnel', 'dropoff', 'ai_queries', 'quality'] as Tab[]).map((value) => (
          <Button key={value} variant={tab === value ? 'default' : 'outline'} size="sm" onClick={() => setTab(value)}>
            {value.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {tab === 'funnel' && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Conversion Funnel</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {Object.entries(analytics.funnel || {}).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                <p className="mt-2 text-2xl font-bold">{String(value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'dropoff' && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Project Drop-off</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(analytics.dropoff || []).map((row: any) => (
              <div key={row.project_number} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Project {row.project_number}: {row.title}</span>
                  <span className="text-muted-foreground">{row.abandonment_rate}% abandonment</span>
                </div>
                <div className="h-2 rounded-full bg-accent">
                  <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(100, Number(row.abandonment_rate || 0))}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'ai_queries' && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>AI Help Queries</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(analytics.ai_queries || []).map((row: any, index: number) => (
              <div key={index} className="rounded-lg border p-3">
                <p className="font-medium">Project: {row.project_id || 'unknown'}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-accent/60 p-3 text-xs">{JSON.stringify(row.event_data || {}, null, 2)}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'quality' && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Code Quality Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(analytics.quality_distribution || []).map((row: any) => (
              <div key={row.project_id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Project {row.project_id}</span>
                  <span className="text-muted-foreground">Avg {row.avg}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Min {row.min} • Max {row.max}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
