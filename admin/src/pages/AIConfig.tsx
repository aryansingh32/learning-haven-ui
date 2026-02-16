import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Bot } from 'lucide-react';
import { toast } from 'sonner';

const AIConfig = () => {
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<Record<string, any>>({});

    const { data, isLoading } = useQuery({
        queryKey: ['ai-config'],
        queryFn: adminService.getAIConfig,
    });

    useEffect(() => {
        if (data) {
            setConfig(typeof data === 'object' ? (data.config ?? data) : {});
        }
    }, [data]);

    const saveMut = useMutation({
        mutationFn: (cfg: Record<string, any>) => adminService.updateAIConfig(cfg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-config'] });
            toast.success('AI configuration saved');
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
                    <h2 className="text-3xl font-bold tracking-tight">AI Configuration</h2>
                    <p className="text-muted-foreground mt-1">Configure AI assistant settings</p>
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
                    <h2 className="text-3xl font-bold tracking-tight">AI Configuration</h2>
                    <p className="text-muted-foreground mt-1">Configure the AI assistant behavior and parameters</p>
                </div>
                <Button onClick={() => saveMut.mutate(config)} disabled={saveMut.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMut.isPending ? 'Saving...' : 'Save Config'}
                </Button>
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" />
                        AI Parameters
                    </CardTitle>
                    <CardDescription>Adjust how the AI assistant operates for users</CardDescription>
                </CardHeader>
                <CardContent>
                    {keys.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No AI configuration available</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {keys.map((key) => {
                                const val = config[key];
                                const isObject = typeof val === 'object' && val !== null;
                                return (
                                    <div key={key} className={`space-y-1.5 ${isObject ? 'md:col-span-2' : ''}`}>
                                        <Label className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</Label>
                                        {isObject ? (
                                            <Textarea
                                                value={JSON.stringify(val, null, 2)}
                                                onChange={(e) => { try { handleChange(key, JSON.parse(e.target.value)); } catch { /* keep editing */ } }}
                                                className="font-mono text-xs min-h-[80px]"
                                            />
                                        ) : typeof val === 'boolean' ? (
                                            <Button size="sm" variant={val ? 'default' : 'outline'} onClick={() => handleChange(key, !val)}>
                                                {val ? 'Enabled' : 'Disabled'}
                                            </Button>
                                        ) : (
                                            <Input value={val?.toString() || ''} onChange={(e) => handleChange(key, e.target.value)} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AIConfig;
