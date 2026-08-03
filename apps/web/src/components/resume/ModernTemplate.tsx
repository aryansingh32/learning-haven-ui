import React from 'react';
import { ResumeData } from '../../types/resume';
import { Mail, Phone, MapPin, Linkedin, Github, Globe, Brain, Briefcase, Award, FolderHeart, Languages, Heart } from 'lucide-react';

interface Props {
    data: ResumeData;
}

export function ModernTemplate({ data }: Props) {
    return (
        <div className="bg-white w-full h-full min-h-[1056px] text-slate-800 font-sans flex text-[12px] leading-relaxed relative" id="resume-preview">
            <style>{`
            @media print {
                body * { visibility: hidden; }
                #resume-preview, #resume-preview * { visibility: visible; }
                #resume-preview { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
                @page { margin: 0; size: A4; }
                .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            `}</style>
            
            {/* Left Content Area (approx 65%) */}
            <div className="flex-1 bg-white pt-10 pb-10 pl-10 pr-6 flex flex-col print-exact">
                {/* Header section inside left column */}
                <div className="flex gap-6 items-center mb-8">
                    {/* Avatar Placeholder */}
                    <div className="w-32 h-32 rounded-xl bg-slate-200 border-4 border-[#FBBF24] shrink-0 overflow-hidden shadow-sm print-exact">
                        {data.personalInfo.avatarUrl ? (
                            <img src={data.personalInfo.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-[#1e293b]" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-[32px] font-light text-[#1e293b] leading-tight mb-1">{data.personalInfo.fullName || 'Johan Smith'}</h1>
                        <h2 className="text-[16px] text-[#FBBF24] font-medium mb-3">{data.personalInfo.role || 'Full-Stack Developer'}</h2>
                        <p className="text-[11px] text-slate-600 leading-snug">
                            {data.personalInfo.summary || 'Solution-driven Full-Stack Developer with over 6+ years of work experience building consumer-focused online products and services.'}
                        </p>
                    </div>
                </div>

                <div className="h-0.5 w-full bg-slate-100 mb-6 print-exact" />

                {/* SKILLS */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                            <Brain className="w-4 h-4 text-slate-700" />
                        </div>
                        <h3 className="text-[15px] tracking-widest text-[#1e293b] font-medium uppercase">Skills</h3>
                    </div>
                    
                    <div className="grid grid-cols-[110px_1fr] gap-y-3 gap-x-4 text-[11px]">
                        {data.skills.languages && (
                            <>
                                <div className="font-bold text-slate-800">Languages</div>
                                <div className="text-slate-600">{data.skills.languages}</div>
                            </>
                        )}
                        {data.skills.frameworks && (
                            <>
                                <div className="font-bold text-slate-800">Frameworks</div>
                                <div className="text-slate-600">{data.skills.frameworks}</div>
                            </>
                        )}
                        {data.skills.tools && (
                            <>
                                <div className="font-bold text-slate-800">Tools / Databases</div>
                                <div className="text-slate-600">{data.skills.tools}</div>
                            </>
                        )}
                        {data.skills.softSkills && (
                            <>
                                <div className="font-bold text-slate-800">Soft Skills</div>
                                <div className="text-slate-600">{data.skills.softSkills}</div>
                            </>
                        )}
                    </div>
                </div>

                <div className="h-0.5 w-full bg-slate-100 mb-6 print-exact" />

                {/* WORK EXPERIENCE */}
                <div>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4 text-slate-700" />
                        </div>
                        <h3 className="text-[15px] tracking-widest text-[#1e293b] font-medium uppercase">Work Experience</h3>
                    </div>
                    
                    <div className="space-y-6">
                        {data.experience.length > 0 ? data.experience.map(exp => (
                            <div key={exp.id}>
                                <h4 className="text-[14px] font-bold text-[#1e293b]">{exp.role || 'Full-Stack Developer'}</h4>
                                <div className="text-[13px] text-[#1e293b] mb-1">{exp.company || 'Pear Computers'}</div>
                                <div className="flex justify-between items-center text-[10px] text-[#FBBF24] italic mb-2">
                                    <span>{exp.duration || '02/2017 - 11/2021'}</span>
                                    <span>{exp.location || 'Oslo'}</span>
                                </div>
                                <div className="text-[10px] text-[#FBBF24] italic mb-1.5">Achievements</div>
                                <div className="text-[11px] text-slate-600 space-y-1.5 pl-3">
                                    {(exp.description || '• Developed backend services...').split('\n').map((line, i) => {
                                        const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
                                        if (!cleanLine) return null;
                                        return (
                                            <div key={i} className="relative">
                                                <div className="absolute left-[-12px] top-[4px] w-1 h-1 bg-[#FBBF24] print-exact" />
                                                {cleanLine}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )) : (
                            <div className="text-slate-400 italic text-[11px]">Add work experience to see it here.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Sidebar (approx 35%) */}
            <div className="w-[280px] shrink-0 flex flex-col print-exact relative">
                {/* Connector circle */}
                <div className="absolute left-[-6px] top-[260px] w-3 h-3 rounded-full bg-[#FBBF24] print-exact z-10" />

                {/* Top Dark Section */}
                <div className="bg-[#1e293b] text-white pt-12 pb-8 px-6 print-exact min-h-[260px]">
                    <div className="space-y-5 text-[11px]">
                        {data.personalInfo.email && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <Mail className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1 break-all">{data.personalInfo.email}</div>
                            </div>
                        )}
                        {data.personalInfo.phone && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <Phone className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1">{data.personalInfo.phone}</div>
                            </div>
                        )}
                        {data.personalInfo.location && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <MapPin className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1">{data.personalInfo.location}</div>
                            </div>
                        )}
                        {data.personalInfo.linkedin && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <Linkedin className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1 break-all">{data.personalInfo.linkedin.replace('https://', '').replace('http://', '').replace('www.', '')}</div>
                            </div>
                        )}
                        {data.personalInfo.github && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <Github className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1 break-all">{data.personalInfo.github.replace('https://', '').replace('http://', '').replace('www.', '')}</div>
                            </div>
                        )}
                        {data.personalInfo.portfolio && (
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full border border-[#FBBF24] flex items-center justify-center shrink-0">
                                    <Globe className="w-3 h-3 text-[#FBBF24]" />
                                </div>
                                <div className="pt-1 break-all">{data.personalInfo.portfolio.replace('https://', '').replace('http://', '').replace('www.', '')}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Light Section */}
                <div className="bg-[#e2e8f0] flex-1 pt-8 pb-10 px-6 print-exact text-[#1e293b]">
                    {/* Certificates */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full border border-[#1e293b] flex items-center justify-center shrink-0">
                                <Award className="w-4 h-4" />
                            </div>
                            <h3 className="text-[13px] tracking-widest font-medium uppercase">Certificates</h3>
                        </div>
                        <div className="space-y-4">
                            {data.certificates.length > 0 ? data.certificates.map(cert => (
                                <div key={cert.id}>
                                    <div className="text-[12px] leading-tight mb-1">{cert.title} {cert.year ? `(${cert.year})` : ''}</div>
                                    <div className="text-[10px] text-slate-500 italic">{cert.issuer}</div>
                                </div>
                            )) : (
                                <div className="text-[11px] text-slate-500 italic">No certificates added.</div>
                            )}
                        </div>
                    </div>

                    {/* Personal Projects */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full border border-[#1e293b] flex items-center justify-center shrink-0">
                                <FolderHeart className="w-4 h-4" />
                            </div>
                            <h3 className="text-[13px] tracking-widest font-medium uppercase">Personal Projects</h3>
                        </div>
                        <div className="space-y-4">
                            {data.projects.length > 0 ? data.projects.map(proj => (
                                <div key={proj.id}>
                                    <div className="text-[12px] leading-tight mb-1">{proj.title} {proj.duration ? `(${proj.duration})` : ''}</div>
                                    <div className="text-[10px] text-slate-600 pl-3 relative mt-1.5">
                                        <div className="absolute left-0 top-[4px] w-1.5 h-1.5 rounded-full bg-[#FBBF24] print-exact" />
                                        {(proj.description || '').split('\n')[0].replace(/^[-•*]\s*/, '').trim()}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-[11px] text-slate-500 italic">No projects added.</div>
                            )}
                        </div>
                    </div>

                    {/* Languages */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full border border-[#1e293b] flex items-center justify-center shrink-0">
                                <Languages className="w-4 h-4" />
                            </div>
                            <h3 className="text-[13px] tracking-widest font-medium uppercase">Languages</h3>
                        </div>
                        <div className="space-y-3">
                            {data.languages.length > 0 ? data.languages.map(lang => (
                                <div key={lang.id}>
                                    <div className="text-[11px] mb-1">{lang.name}</div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className={`w-3 h-3 rounded-full border border-slate-400 ${i <= 4 ? 'bg-slate-400' : ''} print-exact`} />
                                        ))}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-[11px] text-slate-500 italic">No languages added.</div>
                            )}
                        </div>
                    </div>

                    {/* Interests */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full border border-[#1e293b] flex items-center justify-center shrink-0">
                                <Heart className="w-4 h-4" />
                            </div>
                            <h3 className="text-[13px] tracking-widest font-medium uppercase">Interests</h3>
                        </div>
                        <div className="text-[11px] leading-relaxed space-y-2">
                            {data.interests ? data.interests.split(',').map((interest, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 border border-[#1e293b] rounded-sm shrink-0 print-exact" />
                                    {interest.trim()}
                                </div>
                            )) : (
                                <div className="text-slate-500 italic">No interests added.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
