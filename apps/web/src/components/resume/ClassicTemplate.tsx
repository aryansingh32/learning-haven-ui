import React from 'react';
import { ResumeData } from '../../types/resume';

interface Props {
    data: ResumeData;
}

export function ClassicTemplate({ data }: Props) {
    return (
        <div className="bg-white w-full h-full min-h-[1056px] text-[#111] font-sans flex flex-col text-[12px] leading-relaxed relative" id="resume-preview">
            <style>{`
            @media print {
                body * { visibility: hidden; }
                #resume-preview, #resume-preview * { visibility: visible; }
                #resume-preview { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
                @page { margin: 0; size: A4; }
                .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            `}</style>
            
            {/* Top Header Section */}
            <div className="flex w-full pt-12 px-10">
                {/* Left Photo Area */}
                <div className="w-[30%] shrink-0 relative">
                    <div className="absolute top-[-48px] left-[-40px] w-[140%] h-[240px] bg-[#f1f1f1] z-0 print-exact" />
                    <div className="relative z-10 w-full aspect-square bg-[#111] mt-4 print-exact overflow-hidden rounded-br-[40px]">
                        {data.personalInfo.avatarUrl ? (
                            <img src={data.personalInfo.avatarUrl} alt="Avatar" className="w-full h-full object-cover grayscale" />
                        ) : (
                            <div className="w-full h-full bg-[#333]" />
                        )}
                    </div>
                    {/* Orange accent triangle */}
                    <div className="absolute bottom-[-16px] left-0 w-12 h-12 bg-[#FBBF24] print-exact" style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
                </div>

                {/* Right Header Area */}
                <div className="w-[70%] pl-8 flex flex-col justify-center">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-6">
                            <h1 className="text-[42px] font-bold leading-[1.1] mb-2 tracking-tight">
                                <span className="text-[#FBBF24]">/</span>{data.personalInfo.fullName.split(' ')[0]}<br/>
                                {data.personalInfo.fullName.split(' ').slice(1).join(' ')}
                            </h1>
                            <div className="text-[13px] tracking-widest uppercase mb-4 text-[#333] border-l-2 border-[#111] pl-3 print-exact">
                                {data.personalInfo.role || 'PROFESSIONAL TITLE'}
                            </div>
                        </div>
                        
                        {/* Contact Info */}
                        <div className="w-[200px] shrink-0 text-[10.5px] space-y-1 text-[#444] border-l border-slate-300 pl-4 pt-2">
                            {data.personalInfo.phone && <div><strong className="text-[#111]">P:</strong> {data.personalInfo.phone}</div>}
                            {data.personalInfo.email && <div><strong className="text-[#111]">E:</strong> {data.personalInfo.email}</div>}
                            {data.personalInfo.linkedin && <div><strong className="text-[#111]">S:</strong> {data.personalInfo.linkedin.replace('https://', '').replace('http://', '').replace('www.', '')}</div>}
                            {data.personalInfo.location && <div><strong className="text-[#111]">A:</strong> {data.personalInfo.location}</div>}
                        </div>
                    </div>
                    
                    <p className="mt-6 text-[11.5px] text-[#555] leading-relaxed max-w-[90%]">
                        {data.personalInfo.summary || 'Summary goes here. Describes professional experience, key skills, and career goals.'}
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 mt-12 px-10 pb-12">
                {/* Left Column */}
                <div className="w-[30%] pr-6 flex flex-col gap-8">
                    {/* SKILLS */}
                    <div>
                        <h2 className="text-[14px] font-bold tracking-widest uppercase mb-4">Skills</h2>
                        
                        {data.skills.languages && (
                            <div className="mb-4">
                                <div className="text-[11px] font-bold tracking-wider mb-2">// TECHNICAL SKILLS</div>
                                <ul className="list-disc list-inside text-[11px] text-[#444] space-y-1.5 marker:text-[#888]">
                                    {data.skills.languages.split(',').map((s, i) => <li key={i}>{s.trim()}</li>)}
                                    {data.skills.frameworks && data.skills.frameworks.split(',').map((s, i) => <li key={`f-${i}`}>{s.trim()}</li>)}
                                </ul>
                            </div>
                        )}
                        
                        {data.skills.softSkills && (
                            <div>
                                <div className="text-[11px] font-bold tracking-wider mb-2">// PROFESSIONAL SKILLS</div>
                                <ul className="list-disc list-inside text-[11px] text-[#444] space-y-1.5 marker:text-[#888]">
                                    {data.skills.softSkills.split(',').map((s, i) => <li key={i}>{s.trim()}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* EDUCATION */}
                    <div>
                        <h2 className="text-[14px] font-bold tracking-widest uppercase mb-4">Education</h2>
                        <div className="space-y-4">
                            {data.education.length > 0 ? data.education.map(edu => (
                                <div key={edu.id}>
                                    <div className="text-[11px] font-bold uppercase tracking-wide">{edu.degree}</div>
                                    <div className="text-[11px] text-[#555]">{edu.institution} {edu.location ? `| ${edu.location}` : ''}</div>
                                    <div className="text-[10px] text-[#777] mt-0.5">{edu.year}</div>
                                </div>
                            )) : (
                                <div className="text-[11px] text-slate-400 italic">No education added.</div>
                            )}
                        </div>
                    </div>

                    {/* REFERENCES */}
                    {data.references.length > 0 && (
                        <div>
                            <h2 className="text-[14px] font-bold tracking-widest uppercase mb-4">References</h2>
                            <div className="space-y-4">
                                {data.references.map(ref => (
                                    <div key={ref.id}>
                                        <div className="text-[11px] font-bold uppercase tracking-wide">{ref.name} {ref.contact ? `- ${ref.contact}` : ''}</div>
                                        <div className="text-[11px] text-[#555]">{ref.role}{ref.company ? `, ${ref.company}` : ''}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="w-[70%] pl-8 border-l border-slate-300 flex flex-col relative print-exact">
                    <h2 className="text-[14px] font-bold tracking-widest uppercase mb-6">Work Experience</h2>
                    
                    <div className="space-y-8 flex-1">
                        {data.experience.length > 0 ? data.experience.map(exp => (
                            <div key={exp.id} className="relative">
                                {/* Timeline Dot */}
                                <div className="absolute left-[-35px] top-[4px] w-1.5 h-1.5 bg-[#111] rounded-full print-exact" />
                                
                                <h3 className="text-[13px] font-bold mb-1">{exp.role}</h3>
                                <div className="text-[11px] text-[#444] font-medium italic mb-2">
                                    {exp.company} {exp.duration ? `| ${exp.duration}` : ''}
                                </div>
                                <div className="text-[11.5px] text-[#555] space-y-1.5">
                                    {(exp.description || '').split('\n').map((line, i) => {
                                        const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
                                        if (!cleanLine) return null;
                                        // If it's a paragraph, it usually doesn't start with a bullet.
                                        // Let's assume if the line starts with a bullet originally, it's a bullet.
                                        const isBullet = /^[-•*]/.test(line.trim());
                                        return (
                                            <div key={i} className={isBullet ? "relative pl-3" : "mb-2"}>
                                                {isBullet && <div className="absolute left-0 top-[6px] w-1 h-1 bg-[#444] rounded-full print-exact" />}
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

                    {/* Bottom Right: Tools / Langs Dot Matrices (Mapping from Projects or Skills Tools) */}
                    <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t border-slate-200">
                        <div>
                            <h3 className="text-[12px] font-bold tracking-wider mb-3 uppercase">Tech Stack</h3>
                            <div className="space-y-1.5">
                                {data.skills.languages.split(',').slice(0, 4).map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                        <span>{s.trim()}</span>
                                        <div className="flex gap-0.5">
                                            {[1,2,3,4,5].map(dot => (
                                                <div key={dot} className={`w-1.5 h-1.5 rounded-full ${dot <= 4 ? 'bg-[#111]' : 'bg-slate-300'} print-exact`} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[12px] font-bold tracking-wider mb-3 uppercase">Frameworks</h3>
                            <div className="space-y-1.5">
                                {data.skills.frameworks.split(',').slice(0, 4).map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                        <span>{s.trim()}</span>
                                        <div className="flex gap-0.5">
                                            {[1,2,3,4,5].map(dot => (
                                                <div key={dot} className={`w-1.5 h-1.5 rounded-full ${dot <= 3 ? 'bg-[#111]' : 'bg-slate-300'} print-exact`} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[12px] font-bold tracking-wider mb-3 uppercase">Dev Tools</h3>
                            <div className="space-y-1.5">
                                {data.skills.tools.split(',').slice(0, 4).map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                        <span>{s.trim()}</span>
                                        <div className="flex gap-0.5">
                                            {[1,2,3,4,5].map(dot => (
                                                <div key={dot} className={`w-1.5 h-1.5 rounded-full ${dot <= 4 ? 'bg-[#111]' : 'bg-slate-300'} print-exact`} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Website badge at bottom left */}
            <div className="absolute left-[-40px] bottom-[120px] -rotate-90 text-[10px] tracking-widest text-[#888] origin-bottom-left print-exact">
                {data.personalInfo.portfolio.replace('https://', '').replace('http://', '').replace('www.', '')}
            </div>
        </div>
    );
}
