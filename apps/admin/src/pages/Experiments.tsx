import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FlaskConical, Play, Square, Settings, Users, ArrowRight, BarChart, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Experiment {
    id: number | string;
    name?: string;
    AI_Tutor_Voice?: string;
    key: string;
    status: string;
    traffic: number;
    variants: string[];
    primaryMetric: string;
}

export default function Experiments() {
    const { data: experiments, isLoading } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => {
            try {
                const res = await api.get('/admin/experiments');
                return res.data.experiments || res.data || [];
            } catch (err: any) {
                if (err.response?.status === 404) {
                    return [];
                }
                throw err;
            }
        }
    });

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">A/B Testing</h2>
                    <p className="text-muted-foreground mt-1">Manage and monitor live experiments</p>
                </div>
                <Button onClick={() => {
                    toast.info('Experiment creation will be available in the next release');
                }}>
                    <Plus className="mr-2 h-4 w-4" /> New Experiment
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !experiments || experiments.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                        <FlaskConical className="h-12 w-12 mb-4 text-muted/50" />
                        <p className="text-lg font-medium">No experiments found</p>
                        <p className="text-sm">You haven't created any A/B tests yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {experiments.map((exp: Experiment) => (
                        <Card key={exp.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold">{exp.name || exp.AI_Tutor_Voice}</h3>
                                            <Badge variant={exp.status === 'running' ? 'default' : exp.status === 'paused' ? 'secondary' : 'outline'} className={exp.status === 'running' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                                {exp.status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-mono text-muted-foreground">{exp.key}</p>
                                    </div>

                                    <div className="flex items-center gap-8 px-4 md:border-x">
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Traffic Split</p>
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-primary" />
                                                <span className="font-bold">{exp.traffic}%</span>
                                            </div>
                                        </div>
                                        <div className="text-center hidden sm:block">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Primary Metric</p>
                                            <div className="flex items-center gap-2">
                                                <BarChart className="w-4 h-4 text-blue-500" />
                                                <span className="font-semibold text-sm">{exp.primaryMetric}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 md:min-w-[150px] justify-end">
                                        {exp.status === 'running' ? (
                                            <Button variant="outline" size="sm" className="w-24 border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                                                onClick={() => toast.info('Pausing experiments will be available in the next release')}>
                                                <Square className="w-3 h-3 mr-2" /> Pause
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" className="w-24 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => toast.info('Starting experiments will be available in the next release')}>
                                                <Play className="w-3 h-3 mr-2" /> Start
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon"
                                            onClick={() => toast.info('Experiment settings will be available in the next release')}>
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Variants Bar */}
                                <div className="mt-5 pt-4 border-t flex flex-wrap gap-4">
                                    {exp.variants?.map((v, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm bg-accent/50 px-3 py-1.5 rounded-md">
                                            <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-slate-400' : i === 1 ? 'bg-blue-500' : 'bg-purple-500'}`} />
                                            {v}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
