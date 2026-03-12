import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, CheckCircle2, Flame, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

/* ───── TYPES ───── */
interface Chapter {
    id: string;
    chapter_number: number;
    title: string;
    is_locked: boolean;
    is_completed: boolean;
    is_current: boolean;
    problems_solved?: number;
    task_done?: boolean;
    task_partial?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   CHAPTER PATH NODES
   These follow the left yellow energy line in the background.
   Positions are % of the full background width/height.
   The line goes bottom-left → top-center in the image.
   We place cards on nodes going UP the line (ch1=bottom, ch3=top).
   
   In a 1700px-tall scrollable space:
   - Bottom of visible viewport = ~100vh offset from top of scroll
   - So ch1 is near top:100% of viewport, ch3 near top:30%
───────────────────────────────────────────────────────────── */
const NODES = [
    // Chapter 1 — bottom of the left line
    { leftPct: "18%", topPx: 1150 },
    // Chapter 2 — mid of the left line
    { leftPct: "33%", topPx: 760 },
    // Chapter 3 — upper area of the left line
    { leftPct: "50%", topPx: 420 },
    // Chapter 4+ — near portal (hidden by fog)
    { leftPct: "58%", topPx: 220 },
];

/* ─────────────────────────────────────────────────────────────
   STAT WIDGET
───────────────────────────────────────────────────────────── */
function StatWidget({
    icon,
    label,
    value,
    sub,
    delay = 0,
    children,
}: {
    icon?: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    delay?: number;
    children?: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.5, ease: "easeOut" }}
            className="stat-card"
        >
            <p className="stat-label">{label}</p>
            <div className="flex items-center gap-3 mt-1.5">
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className="stat-value">{value}</span>
            </div>
            {sub && <p className="stat-sub">{sub}</p>}
            {children}
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────────────────────── */
function ProgressBar({ completed, total }: { completed: number; total: number }) {
    const pct = Math.round((completed / total) * 100);
    return (
        <div className="flex items-center gap-2 mt-3 w-full">
            <span className="text-[10px] text-white/50 font-medium">0%</span>
            <div className="flex-1 flex gap-[2px]">
                {Array.from({ length: 18 }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-[6px] flex-1 rounded-sm transition-colors duration-500",
                            i < completed ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-white/10"
                        )}
                    />
                ))}
            </div>
            <span className="text-[10px] text-white/50 font-medium">{pct}%</span>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   SOCIAL ICONS
───────────────────────────────────────────────────────────── */
function SocialIcons() {
    return (
        <div className="flex items-center gap-2">
            <button className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center hover:scale-110 transition-transform shadow-[0_2px_8px_rgba(37,211,102,0.5)]">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
            </button>
            <button className="w-6 h-6 rounded-full bg-[#0A66C2] flex items-center justify-center hover:scale-110 transition-transform shadow-[0_2px_8px_rgba(10,102,194,0.5)]">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
            </button>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ChaptersOverviewPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);

    /* ── DATA FETCHING ── */
    const { data: _chaptersRes, isLoading: chaptersLoading } = useApiQuery<any>(
        ["all-chapters"],
        "/chapters"
    );
    const { data: _profileStats, isLoading: statsLoading } = useApiQuery<any>(
        ["user-profile-stats"],
        "/users/profile/stats"
    );

    /* ── DEMO DATA ── */
    const displayChapters: Chapter[] = [
        {
            id: "1",
            chapter_number: 1,
            title: "Intro to DSA",
            is_locked: false,
            is_completed: true,
            is_current: false,
            problems_solved: 1,
            task_done: true,
        },
        {
            id: "2",
            chapter_number: 2,
            title: "Time & Space Complexity",
            is_locked: false,
            is_completed: false,
            is_current: true,
            problems_solved: 2,
            task_done: false,
            task_partial: true,
        },
        {
            id: "3",
            chapter_number: 3,
            title: "Arrays & Hashing",
            is_locked: true,
            is_completed: false,
            is_current: false,
            problems_solved: 0,
            task_done: false,
        },
    ];

    const totalChapters = 18;
    const completed = displayChapters.filter((c) => c.is_completed).length;
    const currentStreak = 7;
    const xp = 550;
    const xpNext = 1000;

    // On mount, scroll to show ch1 and ch2 (scroll down to bottom)
    useEffect(() => {
        if (scrollRef.current) {
            // Start at chapter 1 (bottom) and let user scroll up to discover more
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    if (chaptersLoading || statsLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
            </div>
        );
    }

    return (
        /*
          Break OUT of the AppLayout padding (-m-6 lg:-m-8) so we sit
          flush against all edges. The sidebar remains because it's in AppLayout.
        */
        <div
            className="-m-6 lg:-m-8"
            style={{ height: "100vh", position: "relative", overflow: "hidden" }}
        >
            {/* ── FIXED BACKGROUND – never scrolls ── */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "url('/space-bg.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
                    zIndex: 0,
                }}
            />

            {/* ── CLOUD FOG (top) — hides locked chapters ── */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "30%",
                    background:
                        "linear-gradient(to bottom, rgba(2,2,16,0.97) 0%, rgba(2,2,16,0.75) 55%, transparent 100%)",
                    zIndex: 10,
                    pointerEvents: "none",
                }}
            />

            {/* ── SPARKLE (bottom-right) ── */}
            <div style={{ position: "absolute", bottom: 24, right: 24, zIndex: 25, pointerEvents: "none" }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 0L18 14L32 16L18 18L16 32L14 18L0 16L14 14Z" fill="white" opacity="0.45" />
                </svg>
            </div>

            {/* ── SCROLLABLE CHAPTER PATH – overlaid transparently on the bg ── */}
            <div
                ref={scrollRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    zIndex: 20,
                    scrollBehavior: "smooth",
                }}
                className="[&::-webkit-scrollbar]:w-0"
            >
                {/* Inner spacer — defines scroll height; background stays fixed */}
                <div style={{ position: "relative", height: 1320, width: "100%" }}>
                    {/* Chapter cards positioned at nodes along the yellow line */}
                    {displayChapters.map((ch, idx) => {
                        const node = NODES[idx] || { leftPct: "50%", topPx: 500 };

                        return (
                            <div
                                key={ch.id}
                                style={{
                                    position: "absolute",
                                    left: node.leftPct,
                                    top: node.topPx,
                                    transform: "translate(-50%, -50%)",
                                    zIndex: 20,
                                }}
                            >
                                {/* ── COMPLETED CHAPTER ── */}
                                {ch.is_completed && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.93 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5 }}
                                        className="chapter-card-completed"
                                        style={{ animation: "floatNode 4s ease-in-out infinite" }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                    Chapter {ch.chapter_number}:
                                                </p>
                                                <h4 className="text-slate-900 font-bold text-[15px] leading-tight">
                                                    {ch.title}{" "}
                                                    <span className="font-normal text-slate-500">(Completed)</span>
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 mt-3 pl-12">
                                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                                </svg>
                                                {ch.problems_solved || 1} Problem Solved
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Task Done
                                            </span>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ── CURRENT / ACTIVE CHAPTER ── */}
                                {ch.is_current && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.1 }}
                                        className="chapter-card-active"
                                        style={{ animation: "floatNode 5s ease-in-out infinite 0.5s" }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[11px] text-white/80 font-bold tracking-wide">
                                                Chapter {ch.chapter_number}:
                                            </p>
                                            <span className="chapter-badge-premium flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-full border border-white/40 flex items-center justify-center">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                                </span>
                                                Premium AI
                                            </span>
                                        </div>
                                        <h3 className="text-white font-bold text-[22px] leading-tight mb-4">
                                            {ch.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mb-4">
                                            <button
                                                onClick={() => navigate(`/chapter/${ch.id}`)}
                                                className="chapter-btn-resume"
                                            >
                                                Resume Chapter {ch.chapter_number + 1}
                                            </button>
                                            <button className="chapter-btn-secondary">
                                                <FileText className="w-3.5 h-3.5" />
                                                Quiz
                                            </button>
                                            <button className="chapter-btn-secondary">
                                                <FileText className="w-3.5 h-3.5" />
                                                Task
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-white/75 border-t border-white/10 pt-3">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1.5">
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                        <line x1="12" y1="22.08" x2="12" y2="12" />
                                                    </svg>
                                                    {ch.problems_solved || 0} Problems Solved
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    {ch.task_partial ? "Task Partially Done" : "Task Pending"}
                                                </span>
                                            </div>
                                            <SocialIcons />
                                        </div>
                                    </motion.div>
                                )}

                                {/* ── LOCKED CHAPTER ── */}
                                {ch.is_locked && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="chapter-card-locked"
                                        style={{ animation: "floatNode 6s ease-in-out infinite 1s" }}
                                    >
                                        <Lock className="w-5 h-5 text-white/50 mx-auto mb-2" />
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-0.5">
                                            Chapter {ch.chapter_number}:
                                        </p>
                                        <h4 className="text-white/60 font-bold text-sm leading-tight">
                                            {ch.title}
                                        </h4>
                                    </motion.div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── FIXED RIGHT STAT WIDGETS ── */}
            <div
                style={{
                    position: "absolute",
                    top: 24,
                    right: 24,
                    zIndex: 30,
                    width: 268,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                <StatWidget
                    label="OVERALL PROGRESS"
                    delay={0.1}
                    value={
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-white leading-none">{completed}</span>
                            <span className="text-white/50 text-xs font-medium">/ {totalChapters} Chapters Complete</span>
                        </div>
                    }
                >
                    <ProgressBar completed={completed} total={totalChapters} />
                </StatWidget>

                <StatWidget
                    label="CURRENT STREAK"
                    delay={0.2}
                    icon={
                        <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                        </div>
                    }
                    value={
                        <span className="text-[22px] font-bold text-white">{currentStreak} Days</span>
                    }
                />

                <StatWidget
                    label="EXP POINTS"
                    delay={0.3}
                    icon={
                        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">
                                <path d="M12 2L2 12l10 10 10-10L12 2z" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
                                <path d="M12 2v20M2 12h20" stroke="#f59e0b" strokeWidth="1.5" />
                            </svg>
                        </div>
                    }
                    value={<span className="text-[22px] font-bold text-white">{xp} XP</span>}
                    sub={`Next Level at ${xpNext} XP`}
                />
            </div>
        </div>
    );
}
