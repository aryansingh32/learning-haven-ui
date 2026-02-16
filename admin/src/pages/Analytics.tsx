import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Code, BarChart3 } from 'lucide-react';

const Analytics = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics'],
        queryFn: adminService.getAnalytics,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground mt-1">Detailed platform reports and insights</p>
                </div>
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    const report = data || {};

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                <p className="text-muted-foreground mt-1">Detailed platform reports and insights</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-0 shadow-md animate-fade-in">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">User Growth</p>
                                <p className="text-2xl font-bold">{report.user_growth ?? report.new_users ?? 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg gradient-success flex items-center justify-center">
                                <Code className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Submissions</p>
                                <p className="text-2xl font-bold">{report.total_submissions ?? 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg gradient-warning flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Avg. Completion</p>
                                <p className="text-2xl font-bold">{report.avg_completion ?? 0}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Report */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            Difficulty Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { label: 'Easy', value: report.easy_count ?? 0, pct: report.easy_pct ?? 0, color: 'bg-green-500' },
                                { label: 'Medium', value: report.medium_count ?? 0, pct: report.medium_pct ?? 0, color: 'bg-yellow-500' },
                                { label: 'Hard', value: report.hard_count ?? 0, pct: report.hard_pct ?? 0, color: 'bg-red-500' },
                            ].map((d) => (
                                <div key={d.label} className="space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{d.label}</span>
                                        <span className="font-medium">{d.value} ({d.pct}%)</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full ${d.color} rounded-full transition-all duration-700`}
                                            style={{ width: `${d.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            Category Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {(report.categories ?? report.category_stats ?? []).length > 0 ? (
                                (report.categories ?? report.category_stats ?? []).slice(0, 6).map((cat: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                        <span className="text-sm">{cat.name ?? cat.category_name ?? `Category ${i + 1}`}</span>
                                        <span className="text-sm font-semibold">{cat.count ?? cat.problems_count ?? 0}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No category data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Analytics;
