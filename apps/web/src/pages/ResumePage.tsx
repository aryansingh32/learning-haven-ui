import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { FileText, Save, Download, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2, Wand2, LayoutTemplate, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { ResumeData, defaultResumeData } from '../types/resume';
import { StandardTemplate } from '../components/resume/StandardTemplate';
import { ModernTemplate } from '../components/resume/ModernTemplate';
import { ClassicTemplate } from '../components/resume/ClassicTemplate';

const SECTIONS = [
    { id: 'personal', title: '1. Personal Information' },
    { id: 'experience', title: '2. Experience' },
    { id: 'projects', title: '3. Projects' },
    { id: 'education', title: '4. Education & Skills' },
    { id: 'extra', title: '5. Extras (Certs, Languages)' },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function ResumePage() {
    const { user } = useAuth() as any;
    const isPro = user?.role === 'pro' || user?.role === 'standard';

    const [data, setData] = useState<ResumeData>(defaultResumeData);
    const [activeSection, setActiveSection] = useState('personal');
    const [atsScore, setAtsScore] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState<'standard' | 'modern' | 'classic'>('modern');
    const [isPrinting, setIsPrinting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    // Track whether we've finished loading from server (or confirmed no data exists)
    const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

    const { data: apiResumeData, isSuccess: apiLoaded } = useApiQuery<any>(['resume'], '/resume', {
        // Don't retry on 404 — backend endpoint may not be deployed yet
        retry: false,
    });

    const saveMutation = useApiMutation<any, any>(
        (variables) => api.post('/resume', variables)
    );

    // BH-2.4: Single, ordered data-loading effect.
    // Priority: API > localStorage > user profile defaults.
    // Only runs once after the API query settles (success or empty).
    useEffect(() => {
        if (!apiLoaded) return; // wait for query to settle

        if (apiResumeData && Object.keys(apiResumeData).length > 0) {
            // Server data wins — hydrate from API and sync localStorage
            setData(apiResumeData);
            localStorage.setItem('dsa_os_resume_v2', JSON.stringify(apiResumeData));
        } else {
            // No server data — try localStorage
            const saved = localStorage.getItem('dsa_os_resume_v2');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setData(parsed);
                    // Sync the localStorage data up to the server (fire once)
                    saveMutation.mutateAsync(parsed).catch(() => {
                        // Non-fatal on initial sync; user edits will retry
                    });
                } catch {
                    // Corrupt localStorage — fall through to profile defaults
                }
            } else if (user) {
                // Neither source has data — pre-fill from profile
                setData(prev => ({
                    ...prev,
                    personalInfo: { ...prev.personalInfo, fullName: user.full_name || '', email: user.email || '' }
                }));
            }
        }
        setHasLoadedInitialData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiLoaded]); // intentionally excludes saveMutation to avoid re-runs

    // Debounce ref for save
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // BH-2.4: Calculate completeness score and debounce-persist on every data change.
    // Only runs after initial data has been loaded to avoid overwriting with defaults.
    useEffect(() => {
        if (!hasLoadedInitialData) return;

        let score = 0;
        const { personalInfo, education, experience, projects, skills } = data;

        if (personalInfo.fullName) score += 4;
        if (personalInfo.email) score += 4;
        if (personalInfo.phone) score += 4;
        if (personalInfo.linkedin) score += 4;
        if (personalInfo.github) score += 4;

        if (education.length > 0) score += 15;
        if (experience.length > 0) score += 20;
        if (projects.length > 0) score += 15;

        if (skills.languages || skills.frameworks) score += 15;

        if (data.certificates.length > 0) score += 5;
        if (data.languages.length > 0) score += 5;
        if (data.references.length > 0) score += 5;

        setAtsScore(Math.min(100, score));
        localStorage.setItem('dsa_os_resume_v2', JSON.stringify(data));

        // Debounced API save — waits 1.5s after last change before persisting
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveStatus('saving');
        saveTimerRef.current = setTimeout(async () => {
            try {
                await saveMutation.mutateAsync(data);
                setSaveStatus('saved');
                // Reset to idle after 3s
                setTimeout(() => setSaveStatus('idle'), 3000);
            } catch (err: any) {
                // Silently swallow 404 — the backend endpoint may not be available yet.
                // Any other error surfaces as a toast.
                const is404 = err?.message?.includes('404') ||
                    err?.response?.status === 404 ||
                    String(err?.message).toLowerCase().includes('not found');
                if (is404) {
                    setSaveStatus('idle');
                    return;
                }
                setSaveStatus('error');
                toast.error(err?.response?.data?.error || 'Failed to save resume — check your connection.');
            }
        }, 1500);
    }, [data, hasLoadedInitialData]);

    const improveContentMutation = useApiMutation<{ improvedText: string }, { text: string; context: string }>(
        (variables) => api.post('/resume/improve', variables)
    );

    const handleImproveText = async (text: string, context: string, onSuccess: (improved: string) => void) => {
        if (!isPro) {
            toast.error("AI Text Improvement requires Standard or Pro plan.");
            return;
        }
        if (!text || text.length < 10) {
            toast.error("Please write a few words first.");
            return;
        }

        const toastId = toast.loading("AI is enhancing your description...");
        try {
            const res = await improveContentMutation.mutateAsync({ text, context });
            onSuccess(res.improvedText);
            toast.success("Description enhanced!", { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to improve text", { id: toastId });
        }
    };

    const handleAutoFill = async () => {
        const toastId = toast.loading("Fetching profile data...");
        try {
            const [statsRes, enrollmentsRes] = await Promise.all([
                api.get('/users/me/stats'),
                api.get('/build/enrollments').catch(() => ({ data: [] }))
            ]);
            
            const enrollments = enrollmentsRes.data || [];
            
            const newProjects = enrollments.map((env: any) => ({
                id: Date.now().toString() + Math.random(),
                title: env.apprenticeship_programs?.title || 'Project',
                techStack: env.language || '',
                link: '',
                duration: '',
                description: `• Completed stage ${env.current_stage || 1} of ${env.apprenticeship_programs?.total_projects || 10}`
            }));

            setData(prev => ({
                ...prev,
                personalInfo: {
                    ...prev.personalInfo,
                    fullName: prev.personalInfo.fullName || user?.full_name || '',
                    email: prev.personalInfo.email || user?.email || '',
                },
                projects: [...prev.projects, ...newProjects]
            }));
            
            toast.success("Profile data imported!", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error("Failed to auto-fill data.", { id: toastId });
        }
    };

    const addArrayItem = (key: keyof ResumeData, newItem: any) => {
        setData(prev => ({
            ...prev,
            [key]: [...(prev[key] as any[]), { ...newItem, id: Date.now().toString() }]
        }));
    };

    const removeArrayItem = (key: keyof ResumeData, id: string) => {
        setData(prev => ({
            ...prev,
            [key]: (prev[key] as any[]).filter(item => item.id !== id)
        }));
    };

    const updateArrayItem = (key: keyof ResumeData, id: string, field: string, value: string) => {
        setData(prev => ({
            ...prev,
            [key]: (prev[key] as any[]).map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const updateNestedField = (parent: keyof ResumeData, field: string, value: string) => {
        setData(prev => ({
            ...prev,
            [parent]: {
                ...(prev[parent] as any),
                [field]: value
            }
        }));
    };

    const handleDownloadPDF = () => {
        setIsPrinting(true);
        toast.success("Generating PDF...");
        setTimeout(() => {
            window.onafterprint = () => setIsPrinting(false);
            window.print();
        }, 500);
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20 px-4 xl:px-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl gradient-golden flex items-center justify-center shadow-lg">
                        <FileText className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground">ATS Resume Builder</h1>
                        <p className="text-sm text-muted-foreground">Craft a resume that passes the screening.</p>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="flex flex-col items-end mr-4">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Resume Completeness</span>
                        <div className="flex items-center gap-2">
                            <div className="w-32 h-2.5 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${atsScore > 75 ? 'bg-success' : atsScore > 50 ? 'bg-yellow-500' : 'bg-destructive'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${atsScore}%` }}
                                />
                            </div>
                            <span className="font-bold font-display text-foreground">{atsScore}/100</span>
                        </div>
                    </div>
                    {/* BH-2.4: Save status indicator */}
                    {saveStatus !== 'idle' && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                            saveStatus === 'saving' ? 'bg-secondary text-muted-foreground' :
                            saveStatus === 'saved' ? 'bg-success/15 text-success' :
                            'bg-destructive/15 text-destructive'
                        }`}>
                            {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {saveStatus === 'saved' && <CheckCircle2 className="h-3 w-3" />}
                            {saveStatus === 'error' && <AlertCircle className="h-3 w-3" />}
                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
                        </div>
                    )}
                    <button
                        onClick={handleAutoFill}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition-colors"
                    >
                        <Wand2 className="h-4 w-4" /> Auto-Fill
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isPrinting}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-50"
                    >
                        <Download className="h-4 w-4" /> {isPrinting ? 'Printing...' : 'Export PDF'}
                    </button>
                </div>
            </div>

            {/* Template Selector Bar */}
            <div className="card-glass p-3 rounded-2xl flex items-center gap-4 print:hidden mb-6 overflow-x-auto">
                <div className="flex items-center gap-2 px-3 py-1 border-r border-border/50 shrink-0">
                    <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">Templates</span>
                </div>
                <button
                    onClick={() => setSelectedTemplate('modern')}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${selectedTemplate === 'modern' ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                    Modern (Johan)
                </button>
                <button
                    onClick={() => setSelectedTemplate('classic')}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${selectedTemplate === 'classic' ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                    Classic (Alexander)
                </button>
                <button
                    onClick={() => setSelectedTemplate('standard')}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${selectedTemplate === 'standard' ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                    Standard (Simple)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative items-start">
                {/* Left Side: Builder Form (Col Span 5) */}
                <div className="lg:col-span-5 space-y-4 print:hidden overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
                    {/* 1. Personal Info Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50 transition-all">
                        <button
                            onClick={() => setActiveSection('personal')}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 'personal' ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <span>1. Personal Information</span>
                            {activeSection === 'personal' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 'personal' && (
                            <div className="p-4 border-t border-border/50 space-y-4 bg-background/50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name</label>
                                        <input type="text" value={data.personalInfo.fullName} onChange={e => updateNestedField('personalInfo', 'fullName', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="John Doe" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Professional Role / Title</label>
                                        <input type="text" value={data.personalInfo.role} onChange={e => updateNestedField('personalInfo', 'role', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="Senior Software Engineer" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Summary / Objective</label>
                                        <textarea value={data.personalInfo.summary} onChange={e => updateNestedField('personalInfo', 'summary', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm min-h-[80px]" placeholder="Solution-driven developer with..." />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Photo URL (For templates that use it)</label>
                                        <input type="text" value={data.personalInfo.avatarUrl || ''} onChange={e => updateNestedField('personalInfo', 'avatarUrl', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="https://..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
                                        <input type="email" value={data.personalInfo.email} onChange={e => updateNestedField('personalInfo', 'email', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="john@example.com" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Phone</label>
                                        <input type="tel" value={data.personalInfo.phone} onChange={e => updateNestedField('personalInfo', 'phone', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="+91 9876543210" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Location</label>
                                        <input type="text" value={data.personalInfo.location} onChange={e => updateNestedField('personalInfo', 'location', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="City, Country" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">LinkedIn URL</label>
                                        <input type="text" value={data.personalInfo.linkedin} onChange={e => updateNestedField('personalInfo', 'linkedin', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="linkedin.com/in/johndoe" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">GitHub</label>
                                        <input type="text" value={data.personalInfo.github} onChange={e => updateNestedField('personalInfo', 'github', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="github.com/johndoe" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Portfolio Website</label>
                                        <input type="text" value={data.personalInfo.portfolio} onChange={e => updateNestedField('personalInfo', 'portfolio', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="johndoe.com" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Experience Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection('experience')}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 'experience' ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span>2. Experience</span>
                                <span className="text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{data.experience.length}</span>
                            </div>
                            {activeSection === 'experience' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 'experience' && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                {data.experience.map((exp, idx) => (
                                    <div key={exp.id} className="relative p-4 border border-border/60 rounded-xl bg-card">
                                        <button onClick={() => removeArrayItem('experience', exp.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                        <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Role / Title</label>
                                                <input type="text" value={exp.role} onChange={e => updateArrayItem('experience', exp.id, 'role', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="Software Engineer" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Company</label>
                                                <input type="text" value={exp.company} onChange={e => updateArrayItem('experience', exp.id, 'company', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="Tech Corp Inc." />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Location</label>
                                                <input type="text" value={exp.location} onChange={e => updateArrayItem('experience', exp.id, 'location', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="Oslo, Norway" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Duration</label>
                                                <input type="text" value={exp.duration} onChange={e => updateArrayItem('experience', exp.id, 'duration', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="May 2023 - Present" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-muted-foreground block">Description & Achievements</label>
                                            </div>
                                            <textarea
                                                value={exp.description}
                                                onChange={e => updateArrayItem('experience', exp.id, 'description', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm min-h-[100px] leading-relaxed resize-y"
                                                placeholder="• Developed RESTful APIs...&#10;• Improved database query performance by 40%..."
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addArrayItem('experience', { role: '', company: '', location: '', duration: '', description: '' })}
                                    className="w-full py-3 border-2 border-dashed border-border hover:border-primary/50 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" /> Add Experience
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3. Projects Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection('projects')}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 'projects' ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span>3. Projects</span>
                                <span className="text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{data.projects.length}</span>
                            </div>
                            {activeSection === 'projects' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 'projects' && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                {data.projects.map((proj, idx) => (
                                    <div key={proj.id} className="relative p-4 border border-border/60 rounded-xl bg-card">
                                        <button onClick={() => removeArrayItem('projects', proj.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                                        <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Project Title</label>
                                                <input type="text" value={proj.title} onChange={e => updateArrayItem('projects', proj.id, 'title', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="E-commerce Platform" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tech Stack</label>
                                                <input type="text" value={proj.techStack} onChange={e => updateArrayItem('projects', proj.id, 'techStack', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="React, Node.js" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Duration / Year</label>
                                                <input type="text" value={proj.duration} onChange={e => updateArrayItem('projects', proj.id, 'duration', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm" placeholder="2022 - 2023" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Description & Impact</label>
                                            <textarea
                                                value={proj.description}
                                                onChange={e => updateArrayItem('projects', proj.id, 'description', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 outline-none text-sm min-h-[100px] resize-y"
                                                placeholder="• Built a scalable platform...&#10;• Integrated Stripe API..."
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addArrayItem('projects', { title: '', techStack: '', link: '', duration: '', description: '' })}
                                    className="w-full py-3 border-2 border-dashed border-border hover:border-primary/50 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" /> Add Project
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 4. Education & Skills Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection('education')}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 'education' ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <span>4. Education & Skills</span>
                            {activeSection === 'education' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 'education' && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Skills (Comma separated)</label>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Languages</label>
                                            <input type="text" value={data.skills.languages} onChange={e => updateNestedField('skills', 'languages', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="Java, JavaScript, Python..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Frameworks</label>
                                            <input type="text" value={data.skills.frameworks} onChange={e => updateNestedField('skills', 'frameworks', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="React, Spring Boot, Node.js..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Dev Tools / Databases</label>
                                            <input type="text" value={data.skills.tools} onChange={e => updateNestedField('skills', 'tools', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="Git, Docker, MySQL, MongoDB..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Soft Skills</label>
                                            <input type="text" value={data.skills.softSkills} onChange={e => updateNestedField('skills', 'softSkills', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="Teamwork, Time Management..." />
                                        </div>
                                    </div>
                                </div>
                                <hr className="border-border/60" />
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Education</label>
                                    {data.education.map((edu, idx) => (
                                        <div key={edu.id} className="relative p-4 border border-border/60 rounded-xl bg-card mb-4">
                                            <button onClick={() => removeArrayItem('education', edu.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive rounded-lg"><Trash2 className="h-4 w-4" /></button>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Institution</label>
                                                    <input type="text" value={edu.institution} onChange={e => updateArrayItem('education', edu.id, 'institution', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="Harvard University" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Degree</label>
                                                    <input type="text" value={edu.degree} onChange={e => updateArrayItem('education', edu.id, 'degree', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="B.S. Computer Science" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Year</label>
                                                    <input type="text" value={edu.year} onChange={e => updateArrayItem('education', edu.id, 'year', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" placeholder="2012 - 2016" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addArrayItem('education', { institution: '', degree: '', location: '', year: '', gpa: '' })}
                                        className="w-full py-2.5 border-2 border-dashed border-border hover:border-primary/50 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" /> Add Education
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. Extras Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection('extra')}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 'extra' ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <span>5. Extras (Certs, Languages, References)</span>
                            {activeSection === 'extra' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 'extra' && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                {/* Certificates */}
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Certificates</label>
                                    {data.certificates.map(cert => (
                                        <div key={cert.id} className="relative p-3 border border-border/60 rounded-xl bg-card mb-3 grid grid-cols-2 gap-3 pr-8">
                                            <button onClick={() => removeArrayItem('certificates', cert.id)} className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                                            <div className="col-span-2">
                                                <input type="text" value={cert.title} onChange={e => updateArrayItem('certificates', cert.id, 'title', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="AWS Certified Solutions Architect" />
                                            </div>
                                            <div>
                                                <input type="text" value={cert.issuer} onChange={e => updateArrayItem('certificates', cert.id, 'issuer', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="Amazon Web Services" />
                                            </div>
                                            <div>
                                                <input type="text" value={cert.year} onChange={e => updateArrayItem('certificates', cert.id, 'year', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="2023" />
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('certificates', { title: '', issuer: '', year: '', link: '' })} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                                        <Plus className="w-3 h-3" /> Add Certificate
                                    </button>
                                </div>
                                <hr className="border-border/60" />

                                {/* Languages */}
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Spoken Languages</label>
                                    {data.languages.map(lang => (
                                        <div key={lang.id} className="relative p-3 border border-border/60 rounded-xl bg-card mb-3 flex gap-3 pr-8">
                                            <button onClick={() => removeArrayItem('languages', lang.id)} className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                                            <input type="text" value={lang.name} onChange={e => updateArrayItem('languages', lang.id, 'name', e.target.value)} className="flex-1 px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="English" />
                                            <input type="text" value={lang.proficiency} onChange={e => updateArrayItem('languages', lang.id, 'proficiency', e.target.value)} className="flex-1 px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="Native / Fluent" />
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('languages', { name: '', proficiency: '' })} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                                        <Plus className="w-3 h-3" /> Add Language
                                    </button>
                                </div>
                                <hr className="border-border/60" />

                                {/* References */}
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">References</label>
                                    {data.references.map(ref => (
                                        <div key={ref.id} className="relative p-3 border border-border/60 rounded-xl bg-card mb-3 grid grid-cols-2 gap-3 pr-8">
                                            <button onClick={() => removeArrayItem('references', ref.id)} className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                                            <div className="col-span-2">
                                                <input type="text" value={ref.name} onChange={e => updateArrayItem('references', ref.id, 'name', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="Lisa Turner" />
                                            </div>
                                            <div>
                                                <input type="text" value={ref.role} onChange={e => updateArrayItem('references', ref.id, 'role', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="Lead Engineer" />
                                            </div>
                                            <div>
                                                <input type="text" value={ref.company} onChange={e => updateArrayItem('references', ref.id, 'company', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="TBG Inc." />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="text" value={ref.contact} onChange={e => updateArrayItem('references', ref.id, 'contact', e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border text-xs" placeholder="lisa@example.com / 555-123-4567" />
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('references', { name: '', role: '', company: '', contact: '' })} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                                        <Plus className="w-3 h-3" /> Add Reference
                                    </button>
                                </div>
                                <hr className="border-border/60" />

                                {/* Interests */}
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Interests (Comma separated)</label>
                                    <input type="text" value={data.interests} onChange={e => setData(prev => ({ ...prev, interests: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="Cloud Computing, Blockchain, Ancient History..." />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Live Resume Preview (Col Span 7) */}
                <div className="lg:col-span-7 bg-white rounded-md shadow-2xl overflow-hidden print:col-span-12 print:m-0 print:border-none print:shadow-none min-h-[1056px] relative">
                    {selectedTemplate === 'modern' && <ModernTemplate data={data} />}
                    {selectedTemplate === 'classic' && <ClassicTemplate data={data} />}
                    {selectedTemplate === 'standard' && <StandardTemplate data={data} />}
                </div>
            </div>
        </div>
    );
}
