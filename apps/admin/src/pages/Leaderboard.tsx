import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const Leaderboard = () => {
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<Record<string, any>>({});

    const { data, isLoading } = useQuery({
        queryKey: ['leaderboard-config'],
        queryFn: adminService.getLeaderboardConfig,
    });

    useEffect(() => {
        if (data) {
            setConfig(typeof data === 'object' ? (data.config ?? data) : {});
        }
    }, [data]);

    const saveMut = useMutation({
        mutationFn: (cfg: Record<string, any>) => adminService.updateLeaderboardConfig(cfg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaderboard-config'] });
            toast.success('Leaderboard configuration saved');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const handleChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Leaderboard Config</h2>
                    <p className="text-muted-foreground mt-1">Configure leaderboard settings</p>
                </div>
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            </div>
        );
    }

    const keys = Object.keys(config).filter(k => !k.startsWith('_') && k !== 'id');

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Leaderboard Config</h2>
                    <p className="text-muted-foreground mt-1">Configure the leaderboard ranking system</p>
                </div>
                <Button onClick={() => saveMut.mutate(config)} disabled={saveMut.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMut.isPending ? 'Saving...' : 'Save Config'}
                </Button>
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Leaderboard Parameters
                    </CardTitle>
                    <CardDescription>Adjust how the leaderboard is calculated and displayed</CardDescription>
                </CardHeader>
                <CardContent>
                    {keys.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No configuration available</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {keys.map((key) => (
                                <div key={key} className="space-y-1.5">
                                    <Label className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</Label>
                                    {typeof config[key] === 'boolean' ? (
                                        <Button size="sm" variant={config[key] ? 'default' : 'outline'} onClick={() => handleChange(key, !config[key])}>
                                            {config[key] ? 'Enabled' : 'Disabled'}
                                        </Button>
                                    ) : (
                                        <Input
                                            value={config[key]?.toString() || ''}
                                            onChange={(e) => handleChange(key, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Leaderboard;
