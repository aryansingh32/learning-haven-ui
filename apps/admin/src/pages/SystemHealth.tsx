import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Server, Database, Cloud, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SystemHealth() {
    const { data: healthData, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['admin-health'],
        queryFn: async () => {
            const res = await api.get('/admin/health');
            return res.data;
        },
        refetchInterval: 30000, // auto refresh every 30s
    });

    const status = healthData?.status || 'operational';
    const isRefreshing = isFetching;

    const handleRefresh = () => {
        refetch();
    };

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Health Monitor</h2>
                    <p className="text-muted-foreground mt-1">Live error tracking, API response times, and service status.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={status === 'operational' ? 'default' : 'destructive'} className={status === 'operational' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                        {status === 'operational' ? 'All Systems Operational' : 'Degraded Performance'}
                    </Badge>
                    <button 
                        onClick={handleRefresh}
                        className={`p-2 rounded-md hover:bg-accent ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Service Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(healthData?.services || []).map((service: any) => (
                    <Card key={service.name} className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-start gap-4">
                            <div className={`p-3 rounded-full ${service.status === 'operational' ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                {service.name.includes('Database') ? <Database className="w-5 h-5" /> : service.name.includes('Redis') ? <Activity className="w-5 h-5" /> : <Server className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-sm">{service.name}</p>
                                    {service.status === 'operational' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span>{service.uptime} uptime</span>
                                    <span>•</span>
                                    <span>{service.ping}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts & Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-base">API Response Times (Last 24h)</CardTitle>
                        <CardDescription>Average latency across microservices</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={healthData?.responseTimes || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Line type="monotone" dataKey="api" name="Core API" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="db" name="Database" stroke="#10b981" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="auth" name="Auth" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-base">Recent Errors</CardTitle>
                        <CardDescription>Live error tracking stream</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {!healthData?.errors?.length && !isLoading && (
                                <p className="text-sm text-muted-foreground text-center py-4">No recent errors detected.</p>
                            )}
                            {(healthData?.errors || []).map((error: any) => (
                                <div key={error.id} className="p-3 rounded-lg border bg-muted/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <Badge variant={error.level === 'critical' ? 'destructive' : 'outline'} className={error.level === 'warning' ? 'text-yellow-600 border-yellow-200 bg-yellow-50' : ''}>
                                            {error.service}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">{error.time}</span>
                                    </div>
                                    <p className="text-sm font-medium mt-2">{error.message}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
