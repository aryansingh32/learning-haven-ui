import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Bell, MessageSquare, Send, Save, Eye } from 'lucide-react';

const mockTemplates = [
    { id: 1, name: 'Welcome Email', type: 'email', subject: 'Welcome to DSA OS, {{name}}!' },
    { id: 2, name: 'Subscription Activated', type: 'email', subject: 'Your PRO subscription is active' },
    { id: 3, name: 'Streak Warning', type: 'push', content: 'You are about to lose your {{streak}} day streak! Log in now.' },
];

export default function CommunicationCenter() {
    const [activeTemplate, setActiveTemplate] = useState(mockTemplates[0]);

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Communication Center</h2>
                    <p className="text-muted-foreground mt-1">Manage email and push notification templates.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                        import('sonner').then(m => m.toast.success('Test email sent to your inbox'));
                    }}><Eye className="w-4 h-4 mr-2" /> Send Test</Button>
                    <Button onClick={() => {
                        import('sonner').then(m => m.toast.success('Template saved successfully'));
                    }}><Save className="w-4 h-4 mr-2" /> Save Template</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                Templates
                                <Button variant="ghost" size="icon" className="h-6 w-6"><PlusIcon /></Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 px-3">
                            {mockTemplates.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTemplate(t as any)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${activeTemplate.id === t.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                                >
                                    {t.type === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                    <span className="truncate">{t.name}</span>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-3">
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                {activeTemplate.type === 'email' ? <Mail className="w-5 h-5 text-blue-500" /> : <Bell className="w-5 h-5 text-emerald-500" />}
                                {activeTemplate.name}
                            </CardTitle>
                            <CardDescription>Variables allowed: {'{{name}}'}, {'{{email}}'}, {'{{streak}}'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {activeTemplate.type === 'email' && (
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input defaultValue={activeTemplate.subject} className="font-medium" />
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label>{activeTemplate.type === 'email' ? 'HTML Body Content' : 'Push Notification Content'}</Label>
                                <Textarea 
                                    defaultValue={activeTemplate.type === 'push' ? activeTemplate.content : '<h1>Welcome to DSA OS</h1>\n<p>Hi {{name}},</p>\n<p>We are thrilled to have you...</p>'} 
                                    className={`font-mono text-sm ${activeTemplate.type === 'email' ? 'min-h-[300px]' : 'min-h-[100px]'}`}
                                />
                            </div>

                            {activeTemplate.type === 'email' && (
                                <div className="p-4 bg-muted/30 rounded-lg border border-dashed mt-6">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Preview (Desktop)</p>
                                    <div className="bg-white border rounded-md p-6 max-w-lg mx-auto shadow-sm">
                                        <h1 className="text-2xl font-bold text-slate-900 mb-4">Welcome to DSA OS</h1>
                                        <p className="text-slate-600 mb-4">Hi John Doe,</p>
                                        <p className="text-slate-600 mb-6">We are thrilled to have you join our platform. Get ready to master data structures and algorithms!</p>
                                        <Button className="w-full">Start Learning</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function PlusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
    )
}
