import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<Record<string, any>>({});

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: adminService.getSettings,
    });

    useEffect(() => {
        if (data) {
            setFormData(typeof data === 'object' ? (data.settings ?? data) : {});
        }
    }, [data]);

    const saveMut = useMutation({
        mutationFn: (settings: Record<string, any>) => adminService.updateSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast.success('Settings saved successfully');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const handleChange = (key: string, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                    <p className="text-muted-foreground mt-1">Configure platform-wide settings</p>
                </div>
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            </div>
        );
    }

    const keys = Object.keys(formData).filter(k => !k.startsWith('_'));

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                    <p className="text-muted-foreground mt-1">Configure platform-wide settings</p>
                </div>
                <Button onClick={() => saveMut.mutate(formData)} disabled={saveMut.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMut.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <SettingsIcon className="w-4 h-4 text-primary" />
                        Configuration
                    </CardTitle>
                    <CardDescription>These settings affect the entire platform</CardDescription>
                </CardHeader>
                <CardContent>
                    {keys.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No settings available or settings are empty. Try adding a key-value pair below.</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {keys.map((key) => {
                                const val = formData[key];
                                const isObject = typeof val === 'object' && val !== null;
                                return (
                                    <div key={key} className={`space-y-1.5 ${isObject ? 'md:col-span-2' : ''}`}>
                                        <Label className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</Label>
                                        {isObject ? (
                                            <Textarea
                                                value={JSON.stringify(val, null, 2)}
                                                onChange={(e) => {
                                                    try { handleChange(key, JSON.parse(e.target.value)); } catch { /* invalid JSON, keep editing */ }
                                                }}
                                                className="font-mono text-xs min-h-[100px]"
                                            />
                                        ) : typeof val === 'boolean' ? (
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant={val ? 'default' : 'outline'} onClick={() => handleChange(key, !val)}>
                                                    {val ? 'Enabled' : 'Disabled'}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Input
                                                value={val?.toString() || ''}
                                                onChange={(e) => handleChange(key, e.target.value)}
                                            />
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

export default Settings;
