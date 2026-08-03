import React from 'react';
import { ResumeData } from '../../types/resume';

interface Props {
    data: ResumeData;
}

export function StandardTemplate({ data }: Props) {
    return (
        <div className="bg-white rounded-md shadow-2xl p-8 border border-slate-200 min-h-[800px] overflow-hidden text-slate-800 break-words print:col-span-2 print:m-0 print:border-none print:shadow-none print:p-0 font-serif" id="resume-preview">
            <style>{`
            @media print {
                body * { visibility: hidden; }
                #resume-preview, #resume-preview * { visibility: visible; }
                #resume-preview { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
                @page { margin: 1cm; size: A4; }
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
            {(data.skills.languages || data.skills.frameworks || data.skills.tools) && (
                <div className="mb-6">
                    <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">Technical Skills</h2>
                    <div className="text-sm leading-relaxed font-sans text-slate-800 space-y-1">
                        {data.skills.languages && <div><strong>Languages:</strong> {data.skills.languages}</div>}
                        {data.skills.frameworks && <div><strong>Frameworks:</strong> {data.skills.frameworks}</div>}
                        {data.skills.tools && <div><strong>Tools:</strong> {data.skills.tools}</div>}
                    </div>
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
    );
}
