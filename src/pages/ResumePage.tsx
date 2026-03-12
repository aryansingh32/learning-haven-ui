import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { FileText, Save, Download, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Simplified types for the builder
interface ResumeData {
    personalInfo: {
        fullName: string;
        email: string;
        phone: string;
        linkedin: string;
        github: string;
        portfolio: string;
    };
    education: Array<{ id: string; institution: string; degree: string; year: string; gpa: string }>;
    experience: Array<{ id: string; role: string; company: string; duration: string; description: string }>;
    projects: Array<{ id: string; title: string; techStack: string; link: string; description: string }>;
    skills: string;
}

const defaultData: ResumeData = {
    personalInfo: { fullName: '', email: '', phone: '', linkedin: '', github: '', portfolio: '' },
    education: [],
    experience: [],
    projects: [],
    skills: ''
};

const SECTIONS = ['Personal Info', 'Education', 'Experience', 'Projects', 'Skills'];

export default function ResumePage() {
    const { user } = useAuth() as any;
    const isPro = user?.role === 'pro' || user?.role === 'standard';

    const [data, setData] = useState<ResumeData>(defaultData);
    const [activeSection, setActiveSection] = useState(0);
    const [atsScore, setAtsScore] = useState(0);

    // Load from local storage or backend on mount
    useEffect(() => {
        const saved = localStorage.getItem('dsa_os_resume');
        if (saved) {
            try {
                setData(JSON.parse(saved));
            } catch (e) { }
        } else if (user) {
            setData(prev => ({
                ...prev,
                personalInfo: { ...prev.personalInfo, fullName: user.full_name || '', email: user.email || '' }
            }));
        }
    }, [user]);

    // Calculate generic ATS score based on data completeness and action verbs
    useEffect(() => {
        let score = 0;
        const { personalInfo, education, experience, projects, skills } = data;

        // Personal Info: Up to 20 pts
        if (personalInfo.fullName) score += 4;
        if (personalInfo.email) score += 4;
        if (personalInfo.phone) score += 4;
        if (personalInfo.linkedin) score += 4;
        if (personalInfo.github) score += 4;

        // Education: Up to 15 pts
        if (education.length > 0) {
            score += 15;
        }

        // Experience: Up to 30 pts
        if (experience.length > 0) {
            score += 15;
            const descLength = experience.reduce((acc, curr) => acc + curr.description.length, 0);
            if (descLength > 200) score += 15;
        }

        // Projects: Up to 20 pts
        if (projects.length > 0) {
            score += 10;
            const descLength = projects.reduce((acc, curr) => acc + curr.description.length, 0);
            if (descLength > 150) score += 10;
        }

        // Skills: Up to 15 pts
        if (skills && skills.split(',').length >= 5) {
            score += 15;
        }

        setAtsScore(Math.min(100, score));
        localStorage.setItem('dsa_os_resume', JSON.stringify(data));
    }, [data]);

    const improveContentMutation = useApiMutation<{ improvedText: string }, { text: string; context: string }>(
        (variables) => api.post('/resume/improve', variables)
    );

    const handleImproveText = async (
        text: string,
        context: string,
        onSuccess: (improved: string) => void
    ) => {
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

    const addArrayItem = (key: 'education' | 'experience' | 'projects', newItem: any) => {
        setData(prev => ({
            ...prev,
            [key]: [...prev[key], { ...newItem, id: Date.now().toString() }]
        }));
    };

    const removeArrayItem = (key: 'education' | 'experience' | 'projects', id: string) => {
        setData(prev => ({
            ...prev,
            [key]: prev[key].filter(item => item.id !== id)
        }));
    };

    const updateArrayItem = (key: 'education' | 'experience' | 'projects', id: string, field: string, value: string) => {
        setData(prev => ({
            ...prev,
            [key]: prev[key].map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const handleDownloadPDF = () => {
        toast.success("Generating PDF...");
        setTimeout(() => {
            window.print();
        }, 500);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
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
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">ATS Score</span>
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
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                    >
                        <Download className="h-4 w-4" /> Export PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start">
                {/* Left Side: Builder Form */}
                <div className="space-y-4 print:hidden sticky top-20">
                    {/* Personal Info Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50 transition-all">
                        <button
                            onClick={() => setActiveSection(0)}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 0 ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <span>1. Personal Information</span>
                            {activeSection === 0 ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 0 && (
                            <div className="p-4 border-t border-border/50 space-y-4 bg-background/50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name</label>
                                        <input type="text" value={data.personalInfo.fullName} onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, fullName: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all" placeholder="John Doe" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
                                        <input type="email" value={data.personalInfo.email} onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, email: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="john@example.com" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Phone</label>
                                        <input type="tel" value={data.personalInfo.phone} onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, phone: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="+91 9876543210" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">LinkedIn URL</label>
                                        <input type="text" value={data.personalInfo.linkedin} onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, linkedin: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="linkedin.com/in/johndoe" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">GitHub / Portfolio</label>
                                        <input type="text" value={data.personalInfo.github} onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, github: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="github.com/johndoe" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Experience Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection(2)}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 2 ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span>2. Experience</span>
                                <span className="text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{data.experience.length} Added</span>
                            </div>
                            {activeSection === 2 ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 2 && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                {data.experience.map((exp, idx) => (
                                    <div key={exp.id} className="relative p-4 border border-border/60 rounded-xl bg-card">
                                        <button onClick={() => removeArrayItem('experience', exp.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                        <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Role / Title</label>
                                                <input type="text" value={exp.role} onChange={e => updateArrayItem('experience', exp.id, 'role', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="Software Engineer Intern" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Company</label>
                                                <input type="text" value={exp.company} onChange={e => updateArrayItem('experience', exp.id, 'company', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="Tech Corp Inc." />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Duration</label>
                                                <input type="text" value={exp.duration} onChange={e => updateArrayItem('experience', exp.id, 'duration', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="May 2023 - Aug 2023" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-muted-foreground block">Description & Achievements</label>
                                                <button
                                                    onClick={() => handleImproveText(exp.description, `Resume bullet point for ${exp.role} at ${exp.company}`, (improved) => updateArrayItem('experience', exp.id, 'description', improved))}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded-md transition-colors"
                                                >
                                                    <Sparkles className="h-3 w-3" /> Improve with AI
                                                </button>
                                            </div>
                                            <textarea
                                                value={exp.description}
                                                onChange={e => updateArrayItem('experience', exp.id, 'description', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm min-h-[100px] leading-relaxed resize-y"
                                                placeholder="• Developed RESTful APIs using Node.js...&#10;• Improved database query performance by 40%..."
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addArrayItem('experience', { role: '', company: '', duration: '', description: '' })}
                                    className="w-full py-3 border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Plus className="h-4 w-4" /> Add Experience
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Projects Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection(3)}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 3 ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span>3. Projects</span>
                                <span className="text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{data.projects.length} Added</span>
                            </div>
                            {activeSection === 3 ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 3 && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                {data.projects.map((proj, idx) => (
                                    <div key={proj.id} className="relative p-4 border border-border/60 rounded-xl bg-card">
                                        <button onClick={() => removeArrayItem('projects', proj.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                        <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Project Title</label>
                                                <input type="text" value={proj.title} onChange={e => updateArrayItem('projects', proj.id, 'title', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="E-commerce Platform" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tech Stack</label>
                                                <input type="text" value={proj.techStack} onChange={e => updateArrayItem('projects', proj.id, 'techStack', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="React, Node.js, MongoDB" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-muted-foreground block">Description & Impact</label>
                                                <button
                                                    onClick={() => handleImproveText(proj.description, `Resume bullet point for project ${proj.title} using ${proj.techStack}`, (improved) => updateArrayItem('projects', proj.id, 'description', improved))}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded-md transition-colors"
                                                >
                                                    <Sparkles className="h-3 w-3" /> Improve with AI
                                                </button>
                                            </div>
                                            <textarea
                                                value={proj.description}
                                                onChange={e => updateArrayItem('projects', proj.id, 'description', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm min-h-[100px] resize-y"
                                                placeholder="• Built a scalable platform handling 10k monthly users...&#10;• Integrated Stripe API for payments..."
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addArrayItem('projects', { title: '', techStack: '', link: '', description: '' })}
                                    className="w-full py-3 border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Plus className="h-4 w-4" /> Add Project
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Education & Skills Section */}
                    <div className="card-glass rounded-2xl overflow-hidden border border-border/50">
                        <button
                            onClick={() => setActiveSection(4)}
                            className={`w-full p-4 flex items-center justify-between font-bold text-left transition-colors ${activeSection === 4 ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-secondary/50'}`}
                        >
                            <span>4. Education & Skills</span>
                            {activeSection === 4 ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {activeSection === 4 && (
                            <div className="p-4 border-t border-border/50 space-y-6 bg-background/50">
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Skills (Comma separated)</label>
                                    <textarea
                                        value={data.skills}
                                        onChange={e => setData(prev => ({ ...prev, skills: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm min-h-[80px]"
                                        placeholder="Java, React, Node.js, SQL, AWS..."
                                    />
                                </div>
                                <hr className="border-border/60" />
                                <div>
                                    <label className="font-semibold text-foreground mb-3 block text-sm">Education</label>
                                    {data.education.map((edu, idx) => (
                                        <div key={edu.id} className="relative p-4 border border-border/60 rounded-xl bg-card mb-4">
                                            <button onClick={() => removeArrayItem('education', edu.id)} className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Institution</label>
                                                    <input type="text" value={edu.institution} onChange={e => updateArrayItem('education', edu.id, 'institution', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="Engineering College Name" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Degree / Course</label>
                                                    <input type="text" value={edu.degree} onChange={e => updateArrayItem('education', edu.id, 'degree', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="B.Tech Computer Science" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Graduation Year & CGPA</label>
                                                    <input type="text" value={edu.year} onChange={e => updateArrayItem('education', edu.id, 'year', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-sm" placeholder="2025 | 8.5 CGPA" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addArrayItem('education', { institution: '', degree: '', year: '', gpa: '' })}
                                        className="w-full py-2.5 border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm font-semibold rounded-xl text-primary flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Plus className="h-4 w-4" /> Add Education
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Right Side: Live Resume Preview */}
                <div className="sticky top-20 bg-white rounded-md shadow-2xl p-8 border border-slate-200 min-h-[800px] overflow-hidden text-slate-800 break-words mb-8 print:col-span-2 print:m-0 print:border-none print:shadow-none print:p-0 font-serif" id="resume-preview">
                    <style>{`
            @media print {
                body * { visibility: hidden; }
                #resume-preview, #resume-preview * { visibility: visible; }
                #resume-preview { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
                @page { margin: 1cm; }
            }
            `}</style>

                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900 border-b-2 border-slate-900 pb-1 inline-block mb-3">
                            {data.personalInfo.fullName || 'YOUR NAME'}
                        </h1>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-sans">
                            {data.personalInfo.email && <span className="flex items-center gap-1">• {data.personalInfo.email}</span>}
                            {data.personalInfo.phone && <span className="flex items-center gap-1">• {data.personalInfo.phone}</span>}
                            {data.personalInfo.linkedin && <span className="flex items-center gap-1">• {data.personalInfo.linkedin}</span>}
                            {data.personalInfo.github && <span className="flex items-center gap-1">• {data.personalInfo.github}</span>}
                        </div>
                    </div>

                    {/* Education */}
                    {data.education.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">Education</h2>
                            <div className="space-y-3">
                                {data.education.map(edu => (
                                    <div key={edu.id} className="text-sm border-l-2 border-slate-200 pl-3 py-0.5">
                                        <div className="flex justify-between items-baseline font-bold font-sans">
                                            <span className="text-slate-900">{edu.institution || 'University Name'}</span>
                                            <span className="text-slate-600 font-normal">{edu.year || 'Date'}</span>
                                        </div>
                                        <div className="text-slate-700 font-medium italic mt-0.5">{edu.degree || 'Degree name'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skills */}
                    {data.skills && (
                        <div className="mb-6">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">Technical Skills</h2>
                            <p className="text-sm leading-relaxed font-sans text-slate-800">
                                {data.skills}
                            </p>
                        </div>
                    )}

                    {/* Experience */}
                    {data.experience.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">Experience</h2>
                            <div className="space-y-4">
                                {data.experience.map(exp => (
                                    <div key={exp.id} className="text-sm">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-slate-900 font-sans">{exp.role || 'Role Title'} <span className="text-slate-600 font-normal">| {exp.company || 'Company'}</span></span>
                                            <span className="text-slate-600 italic">{exp.duration || 'Date Range'}</span>
                                        </div>
                                        <div className="text-slate-700 font-sans leading-relaxed whitespace-pre-wrap opacity-90 pl-3 border-l text-[13px]">
                                            {exp.description || '• Add bullet points starting with action verbs...'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Projects */}
                    {data.projects.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">Projects</h2>
                            <div className="space-y-4">
                                {data.projects.map(proj => (
                                    <div key={proj.id} className="text-sm">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-slate-900 font-sans">{proj.title || 'Project Name'}</span>
                                        </div>
                                        <div className="font-sans text-slate-600 text-xs italic mb-1.5">{proj.techStack || 'Technologies Used'}</div>
                                        <div className="text-slate-700 font-sans leading-relaxed whitespace-pre-wrap opacity-90 pl-3 border-l text-[13px]">
                                            {proj.description || '• Describe the project impact and implementation...'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
