import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, LayoutTemplate, Palette, Globe, Code, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../services/admin.service';

type FormMode = 'visual' | 'json';

export default function CMSControl() {
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<Record<string, any>>({
        hero_title: 'Master Your Craft',
        hero_subtitle: 'The best place to learn and build real-world projects.',
        primary_color: '#f97316',
        trending_categories: 'Frontend,Backend,DevOps',
        features_json: '[]'
    });
    
    const [mode, setMode] = useState<FormMode>('visual');
    const [jsonRaw, setJsonRaw] = useState('{}');
    const [jsonError, setJsonError] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: adminService.getSettings,
    });

    useEffect(() => {
        if (data) {
            const settings = typeof data === 'object' ? (data.settings ?? data) : {};
            
            const cmsSettings = {
                hero_title: settings.hero_title || 'Master Your Craft',
                hero_subtitle: settings.hero_subtitle || 'The best place to learn and build real-world projects.',
                primary_color: settings.primary_color || '#f97316',
                trending_categories: settings.trending_categories || 'Frontend,Backend,DevOps',
                features_json: settings.features_json || '[]',
            };
            
            setConfig(cmsSettings);
            setJsonRaw(JSON.stringify(cmsSettings, null, 2));
        }
    }, [data]);

    const saveMut = useMutation({
        mutationFn: (cfg: Record<string, any>) => adminService.updateSettings(cfg),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast.success('Site configuration saved successfully!');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const handleChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (mode === 'json') {
            try {
                const parsed = JSON.parse(jsonRaw);
                setJsonError('');
                saveMut.mutate(parsed);
            } catch (e) {
                setJsonError('Invalid JSON');
                return;
            }
        } else {
            saveMut.mutate(config);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Site CMS & Appearance</h2>
                        <p className="text-muted-foreground mt-1">Control frontend text, colors, and dynamic content.</p>
                    </div>
                </div>
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Site CMS & Appearance</h2>
                    <p className="text-muted-foreground mt-1">Control frontend text, colors, and dynamic content.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('visual')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                mode === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Eye className="w-3 h-3" /> Visual
                        </button>
                        <button
                            onClick={() => {
                                setMode('json');
                                setJsonRaw(JSON.stringify(config, null, 2));
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                mode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Code className="w-3 h-3" /> JSON
                        </button>
                    </div>

                    <Button onClick={handleSave} disabled={saveMut.isPending}>
                        {saveMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {saveMut.isPending ? 'Saving...' : 'Publish Changes'}
                    </Button>
                </div>
            </div>

            {mode === 'visual' ? (
                <Tabs defaultValue="content" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="content" className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Text & Content</TabsTrigger>
                        <TabsTrigger value="appearance" className="flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance</TabsTrigger>
                        <TabsTrigger value="dynamic" className="flex items-center gap-2"><Globe className="w-4 h-4" /> Dynamic Sections</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="space-y-4">
                        <Card className="border-0 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-base">Homepage Hero</CardTitle>
                                <CardDescription>The main headline seen by users when they land on the platform.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Hero Title</Label>
                                    <Input value={config.hero_title || ''} onChange={(e) => handleChange('hero_title', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hero Subtitle</Label>
                                    <Textarea rows={3} value={config.hero_subtitle || ''} onChange={(e) => handleChange('hero_subtitle', e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="appearance" className="space-y-4">
                        <Card className="border-0 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-base">Theme Colors</CardTitle>
                                <CardDescription>Override global theme settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Primary Color (Hex)</Label>
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={config.primary_color || '#f97316'} onChange={(e) => handleChange('primary_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                                        <Input value={config.primary_color || ''} onChange={(e) => handleChange('primary_color', e.target.value)} className="flex-1 font-mono" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="dynamic" className="space-y-4">
                        <Card className="border-0 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-base">Categories & Popular Tags</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Trending Categories (Comma separated)</Label>
                                    <Input value={config.trending_categories || ''} onChange={(e) => handleChange('trending_categories', e.target.value)} placeholder="e.g. React, Node.js, System Design" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Features JSON Array (Advanced)</Label>
                                    <Textarea rows={6} value={config.features_json || '[]'} onChange={(e) => handleChange('features_json', e.target.value)} className="font-mono text-xs bg-accent/20" />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            ) : (
                /* JSON Mode */
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Code className="w-4 h-4 text-primary" />
                            Raw JSON Configuration
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3" />
                            Advanced — edit the CMS JSON directly
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={jsonRaw}
                            onChange={(e) => { setJsonRaw(e.target.value); setJsonError(''); }}
                            className="font-mono text-xs min-h-[400px] bg-accent/20"
                            spellCheck={false}
                        />
                        {jsonError && (
                            <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {jsonError}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
