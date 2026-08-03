import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Activity, AlertTriangle, Users, MousePointer2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminService } from '../services/admin.service';
import { toast } from 'sonner';

export default function NetworkMonitoring() {
    // We would fetch this from a real analytics endpoint
    // using a placeholder here for the structure.
    const [retentionDays, setRetentionDays] = useState('30');
    const [saving, setSaving] = useState(false);

    const handleSaveRetention = async () => {
        try {
            setSaving(true);
            await adminService.api.post('/analytics/retention', { days: parseInt(retentionDays) });
            toast.success('Retention policy updated successfully');
        } catch (error) {
            toast.error('Failed to update retention policy');
        } finally {
            setSaving(false);
        }
    };

    const { data: analyticsData, isLoading, refetch } = useQuery({
        queryKey: ['network-monitoring'],
        queryFn: async () => {
            const res = await adminService.api.get('/analytics/network');
            return res.data;
        },
        refetchInterval: 10000, // auto refresh every 10 seconds
    });

    const analytics = analyticsData || {
        pageViews: 0,
        activeUsers: 0,
        errors: 0,
        events: [] as any[]
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Network & Analytics</h2>
                <p className="text-muted-foreground mt-1">Live monitoring of user interactions, journeys, and unhandled errors.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-0 shadow-md bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.activeUsers}</div>
                        <p className="text-xs text-muted-foreground">Currently on platform</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                        <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.pageViews}</div>
                        <p className="text-xs text-muted-foreground">+12% from yesterday</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-destructive/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.errors}</div>
                        <p className="text-xs text-muted-foreground">Unhandled exceptions today</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-6">
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Live Event Stream
                        </CardTitle>
                        <CardDescription>Real-time cookie-based data collection stream.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {analytics.events.map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${e.event_type === 'error' || e.event_type === 'unhandled_rejection' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                            {e.event_type}
                                        </span>
                                        <span className="text-sm font-medium">{e.user_id ? `User ${e.user_id.slice(0, 8)}` : `Anon (${e.tracking_id?.slice(0, 8)})`}</span>
                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">on {e.path}</span>
                                        {e.error_message && <span className="text-xs text-destructive truncate max-w-[200px]">- {e.error_message}</span>}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                                </div>
                            ))}
                            {analytics.events.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No events logged yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md h-fit">
                    <CardHeader>
                        <CardTitle className="text-base">Data Retention Policy</CardTitle>
                        <CardDescription>Configure how long analytics logs are kept before being auto-deleted.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Input 
                                type="number" 
                                value={retentionDays} 
                                onChange={(e) => setRetentionDays(e.target.value)}
                                className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">Days to retain logs</span>
                        </div>
                        <Button onClick={handleSaveRetention} disabled={saving || !retentionDays}>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Policy'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
