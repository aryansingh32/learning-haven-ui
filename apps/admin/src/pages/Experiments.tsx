import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FlaskConical, Play, Square, Settings, Users, ArrowRight, BarChart, Plus } from 'lucide-react';

const mockExperiments = [
    { id: 1, name: 'New Pricing Page Design', key: 'exp_pricing_v2', status: 'running', traffic: 50, variants: ['Control (50%)', 'Variant A (50%)'], primaryMetric: 'Conversion Rate' },
    { id: 2, name: 'Gamification Onboarding', key: 'exp_gamified_onboarding', status: 'paused', traffic: 20, variants: ['Control (80%)', 'Variant A (20%)'], primaryMetric: 'Day 1 Retention' },
    { id: 3, AI_Tutor_Voice: 'AI Voice Selection UI', key: 'exp_ai_voice', status: 'draft', traffic: 100, variants: ['Control', 'Variant A', 'Variant B'], primaryMetric: 'Audio Usage' },
];

export default function Experiments() {
    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">A/B Testing</h2>
                    <p className="text-muted-foreground mt-1">Manage and monitor live experiments</p>
                </div>
                <Button onClick={() => {
                    import('sonner').then(m => m.toast.info('Experiment creation coming soon'));
                }}>
                    <Plus className="mr-2 h-4 w-4" /> New Experiment
                </Button>
            </div>

            <div className="grid gap-4">
                {mockExperiments.map((exp) => (
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
                                        <Button variant="outline" size="sm" className="w-24 border-yellow-200 text-yellow-700 hover:bg-yellow-50">
                                            <Square className="w-3 h-3 mr-2" /> Pause
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="w-24 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                            <Play className="w-3 h-3 mr-2" /> Start
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon">
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Variants Bar */}
                            <div className="mt-5 pt-4 border-t flex flex-wrap gap-4">
                                {exp.variants.map((v, i) => (
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
        </div>
    );
}
