import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Bell, Send, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
    id: string;
    name: string;
    type: 'email' | 'push';
    subject?: string;
    body: string;
}

const DEFAULT_TEMPLATES: Template[] = [
    { id: '1', name: 'Welcome Email', type: 'email', subject: 'Welcome to Learning Haven, {{name}}!', body: '<h1>Welcome!</h1>\n<p>Hi {{name}},</p>\n<p>We are thrilled to have you join Learning Haven. Start learning today!</p>' },
    { id: '2', name: 'Subscription Activated', type: 'email', subject: 'Your PRO subscription is now active', body: '<h1>You\'re now PRO!</h1>\n<p>Hi {{name}},</p>\n<p>Your subscription has been activated. Enjoy unlimited access!</p>' },
    { id: '3', name: 'Streak Warning', type: 'push', body: 'You\'re about to lose your {{streak}}-day streak! Log in now to keep it going 🔥' },
];

export default function CommunicationCenter() {
    const queryClient = useQueryClient();
    const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
    const [activeId, setActiveId] = useState<string>(DEFAULT_TEMPLATES[0].id);
    const [edited, setEdited] = useState<Template>(DEFAULT_TEMPLATES[0]);
    const [sendingTest, setSendingTest] = useState(false);

    // Load templates from API
    const { data: templatesData, isLoading } = useQuery({
        queryKey: ['comm-templates'],
        queryFn: async () => {
            const res = await api.get('/admin/communication/templates');
            return res.data;
        },
    });

    // Sync state when API data loads
    useEffect(() => {
        const fetched = (templatesData as any)?.templates;
        if (fetched?.length > 0) {
            setTemplates(fetched);
            setActiveId(fetched[0].id);
            setEdited(fetched[0]);
        }
    }, [templatesData]);

    // Sync edited when active changes
    useEffect(() => {
        const t = templates.find(t => t.id === activeId);
        if (t) setEdited({ ...t });
    }, [activeId, templates]);

    // Save templates mutation
    const saveMut = useMutation({
        mutationFn: async () => {
            // Merge edited template into templates array
            const updated = templates.map(t => t.id === edited.id ? edited : t);
            await api.put('/admin/communication/templates', { templates: updated });
            return updated;
        },
        onSuccess: (updated) => {
            setTemplates(updated);
            queryClient.invalidateQueries({ queryKey: ['comm-templates'] });
            toast.success('Templates saved successfully');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    // Send test
    const sendTest = async () => {
        setSendingTest(true);
        try {
            await api.post('/admin/communication/send', {
                type: edited.type,
                subject: edited.subject,
                body: edited.body,
                template_id: edited.id,
                recipient: 'test',
            });
            toast.success('Test message queued for delivery');
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to send test');
        } finally {
            setSendingTest(false);
        }
    };

    // Add template
    const addTemplate = () => {
        const newT: Template = {
            id: Date.now().toString(),
            name: 'New Template',
            type: 'email',
            subject: 'Subject here',
            body: '<p>Template body here</p>',
        };
        setTemplates(prev => [...prev, newT]);
        setActiveId(newT.id);
    };

    // Delete template
    const deleteTemplate = (id: string) => {
        const remaining = templates.filter(t => t.id !== id);
        setTemplates(remaining);
        if (activeId === id && remaining.length > 0) {
            setActiveId(remaining[0].id);
        }
    };

    const active = templates.find(t => t.id === activeId);

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Communication Center</h2>
                    <p className="text-muted-foreground mt-1">Manage email and push notification templates</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={sendTest} disabled={sendingTest || !active}>
                        {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Send Test
                    </Button>
                    <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                        {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Template
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Template List Sidebar */}
                    <div className="md:col-span-1 space-y-4">
                        <Card className="border-0 shadow-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                    Templates
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addTemplate}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 px-3">
                                {templates.map((t) => (
                                    <div key={t.id} className="flex items-center gap-1 group">
                                        <button
                                            onClick={() => setActiveId(t.id)}
                                            className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                                activeId === t.id
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'hover:bg-accent'
                                            }`}
                                        >
                                            {t.type === 'email'
                                                ? <Mail className="w-3.5 h-3.5 shrink-0" />
                                                : <Bell className="w-3.5 h-3.5 shrink-0" />
                                            }
                                            <span className="truncate">{t.name}</span>
                                        </button>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                                            onClick={() => deleteTemplate(t.id)}
                                            title="Delete template"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {templates.length === 0 && (
                                    <p className="text-xs text-muted-foreground px-3 py-2">
                                        No templates yet. Click + to add one.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Editor */}
                    <div className="md:col-span-3">
                        {!active ? (
                            <div className="flex items-center justify-center h-64 border rounded-lg border-dashed text-muted-foreground text-sm">
                                Select or create a template to start editing
                            </div>
                        ) : (
                            <Card className="border-0 shadow-md">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        {edited.type === 'email'
                                            ? <Mail className="w-5 h-5 text-blue-500" />
                                            : <Bell className="w-5 h-5 text-emerald-500" />
                                        }
                                        <div className="flex-1">
                                            <Input
                                                value={edited.name}
                                                onChange={(e) => setEdited(p => ({ ...p, name: e.target.value }))}
                                                className="font-semibold border-0 shadow-none text-lg p-0 h-auto focus-visible:ring-0"
                                                placeholder="Template name"
                                            />
                                        </div>
                                        <select
                                            value={edited.type}
                                            onChange={(e) => setEdited(p => ({ ...p, type: e.target.value as 'email' | 'push' }))}
                                            className="text-xs border rounded px-2 py-1 bg-background"
                                        >
                                            <option value="email">Email</option>
                                            <option value="push">Push</option>
                                        </select>
                                    </div>
                                    <CardDescription>
                                        Variables: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{streak}}'}</code>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {edited.type === 'email' && (
                                        <div className="space-y-2">
                                            <Label>Email Subject</Label>
                                            <Input
                                                value={edited.subject ?? ''}
                                                onChange={(e) => setEdited(p => ({ ...p, subject: e.target.value }))}
                                                placeholder="Email subject line..."
                                                className="font-medium"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>{edited.type === 'email' ? 'HTML Body' : 'Push Notification Text'}</Label>
                                        <Textarea
                                            value={edited.body}
                                            onChange={(e) => setEdited(p => ({ ...p, body: e.target.value }))}
                                            className={`font-mono text-sm ${edited.type === 'email' ? 'min-h-[280px]' : 'min-h-[100px]'}`}
                                            placeholder={edited.type === 'email' ? '<h1>Hello {{name}}</h1>' : 'Push message text...'}
                                        />
                                    </div>

                                    {/* Live preview for email */}
                                    {edited.type === 'email' && edited.body && (
                                        <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                                Preview (Desktop)
                                            </p>
                                            <div className="bg-white border rounded-md p-6 max-w-lg mx-auto shadow-sm">
                                                <div
                                                    className="prose prose-sm max-w-none text-slate-700"
                                                    dangerouslySetInnerHTML={{
                                                        __html: edited.body
                                                            .replace(/\{\{name\}\}/g, 'John Doe')
                                                            .replace(/\{\{email\}\}/g, 'john@example.com')
                                                            .replace(/\{\{streak\}\}/g, '7')
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
