import React, { useState } from 'react';
import { useApiQuery } from '@/hooks/useApi';
import { Briefcase, MapPin, Clock, ExternalLink, Bookmark, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

type JobType = 'JOB' | 'INTERNSHIP' | 'HACKATHON' | 'SCHOLARSHIP';

interface JobAlert {
    id: string;
    title: string;
    company: string;
    type: JobType;
    apply_url: string;
    deadline: string | null;
    stipend: string | null;
    description: string | null;
    tags: string[];
    posted_at: string;
}

const TABS: { label: string; value: JobType | 'ALL' }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Jobs', value: 'JOB' },
    { label: 'Internships', value: 'INTERNSHIP' },
    { label: 'Hackathons', value: 'HACKATHON' },
    { label: 'Scholarships', value: 'SCHOLARSHIP' },
];

export const JobsPage = () => {
    const [activeTab, setActiveTab] = useState<JobType | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [savedJobs, setSavedJobs] = useState<Record<string, boolean>>({});

    const typeQuery = activeTab === 'ALL' ? '' : `&type=${activeTab}`;

    const { data, isLoading } = useApiQuery<{ jobs: JobAlert[], total: number }>(
        ['jobs', activeTab, page],
        `/jobs?limit=20&page=${page}${typeQuery}`
    );

    const jobs = data?.jobs || [];
    const total = data?.total || 0;

    const toggleSave = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        setSavedJobs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getBadgeColor = (type: JobType) => {
        switch (type) {
            case 'JOB': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'INTERNSHIP': return 'bg-green-100 text-green-700 border-green-200';
            case 'HACKATHON': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'SCHOLARSHIP': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getDaysRemaining = (deadline: string | null) => {
        if (!deadline) return null;
        const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        return days;
    };

    const getTimeAgo = (dateStr: string) => {
        const days = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
        if (days === 0) return 'Posted today';
        if (days === 1) return 'Posted 1 day ago';
        return `Posted ${days} days ago`;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 md:p-10 shadow-lg text-white"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                <div className="relative z-10">
                    <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                        Opportunities <span className="text-4xl">💼</span>
                    </h1>
                    <p className="text-blue-100 text-sm md:text-base max-w-xl">
                        Latest jobs, internships & hackathons — updated daily. curated just for you.
                    </p>
                </div>
            </motion.div>

            {/* Filter Tabs */}
            <div className="flex overflow-x-auto hide-scrollbar border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-20 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-6 pb-3">
                    {TABS.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => { setActiveTab(tab.value); setPage(1); }}
                            className={`text-sm font-semibold whitespace-nowrap transition-colors relative px-1 ${activeTab === tab.value ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.value && (
                                <motion.div
                                    layoutId="activeTabIndicator"
                                    className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {isLoading && page === 1 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-48 rounded-2xl" />
                        ))}
                    </div>
                ) : jobs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center p-12 text-center bg-secondary/30 rounded-3xl border border-dashed border-border/60"
                    >
                        <Briefcase className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-display text-xl font-semibold mb-2">No {activeTab !== 'ALL' ? TABS.find(t => t.value === activeTab)?.label.toLowerCase() : 'opportunities'} right now</h3>
                        <p className="text-muted-foreground text-sm">Check back tomorrow for fresh updates!</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <AnimatePresence mode="popLayout">
                            {jobs.map((job, idx) => {
                                const daysRemaining = getDaysRemaining(job.deadline);
                                const isClosingSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;

                                return (
                                    <motion.div
                                        key={job.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group bg-card hover:bg-card/80 border border-border/50 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col h-full"
                                    >
                                        <div className="flex justify-between items-start mb-4 gap-3">
                                            <div className="flex gap-3 items-start flex-1 min-w-0">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold font-display text-xl shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                    {job.company.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-lg font-bold font-display text-foreground truncate group-hover:text-blue-600 transition-colors">
                                                        {job.title}
                                                    </h3>
                                                    <p className="font-semibold text-muted-foreground text-sm truncate">
                                                        {job.company}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => toggleSave(job.id, e)}
                                                className="p-2 -mr-2 -mt-2 text-muted-foreground hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                                            >
                                                <Bookmark className="w-5 h-5" fill={savedJobs[job.id] ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(job.type)}`}>
                                                {job.type}
                                            </span>
                                            {job.stipend && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground flex items-center gap-1">
                                                    <Briefcase className="w-3 h-3" /> {job.stipend}
                                                </span>
                                            )}
                                        </div>

                                        {job.tags && job.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {job.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                                            <div className="flex flex-col pr-2">
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                                                    <Clock className="w-3 h-3" /> {getTimeAgo(job.posted_at)}
                                                </span>
                                                {daysRemaining !== null && daysRemaining > 0 && (
                                                    <span className={`text-[10px] font-medium flex items-center gap-1 ${isClosingSoon ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                        Deadline: {new Date(job.deadline!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        {isClosingSoon && ' (Closing soon!)'}
                                                    </span>
                                                )}
                                            </div>
                                            <a
                                                href={job.apply_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-background hover:bg-blue-50 border border-blue-200 text-blue-600 font-semibold px-4 py-2 flex items-center gap-1.5 rounded-xl text-sm transition-colors uppercase tracking-wider h-max shrink-0"
                                            >
                                                Apply <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Load More */}
                {jobs.length < total && !isLoading && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => setPage(p => p + 1)}
                            className="bg-secondary/50 hover:bg-secondary text-foreground font-semibold px-6 py-2.5 rounded-full transition-colors flex items-center gap-2 text-sm"
                        >
                            Load More <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobsPage;
