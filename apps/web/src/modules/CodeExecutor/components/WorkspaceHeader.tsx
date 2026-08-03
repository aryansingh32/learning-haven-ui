import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceHeaderProps {
    variant?: 'leetcode' | 'hackerrank';
    questionId?: string;
    title?: string;
    showTimer?: boolean;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
    variant = 'leetcode',
    questionId,
    title,
    showTimer = true,
}) => {
    const isHackerrank = variant === 'hackerrank';
    const titleText = title || (isHackerrank ? 'Code Arena' : 'DSA OS');
    const accentClass = isHackerrank ? 'bg-emerald-600' : 'gradient-golden';
    const headerBg = isHackerrank ? 'bg-emerald-950/40 border-emerald-500/10' : 'bg-zinc-900/50 border-border/40';
    const timerBg = isHackerrank ? 'bg-emerald-950/60 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-700/30';
    const timerText = isHackerrank ? 'text-emerald-400' : 'text-zinc-400';

    return (
        <header className={cn("h-14 border-b backdrop-blur-xl flex items-center justify-between px-4 z-50", headerBg)}>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg", accentClass)}>
                        <Trophy className="h-4 w-4 text-white" />
                    </div>
                    <h1 className="font-display text-lg font-bold tracking-tight text-zinc-100">
                        <span className={cn(isHackerrank ? "text-emerald-400" : "text-gradient-golden")}>{titleText}</span>
                    </h1>
                </div>

                <div className="h-6 w-px bg-zinc-800" />

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-100 transition-colors">
                        <List className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-0.5 px-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold text-zinc-400 px-2">{questionId ? `Problem ${questionId}` : 'Problem'}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {showTimer && (
                    <div className={cn("hidden md:flex items-center gap-2 px-3 py-1 rounded-full border", timerBg)}>
                        <Timer className={cn("h-3.5 w-3.5", timerText)} />
                        <span className={cn("text-[11px] font-bold tabular-nums", timerText)}>00:00:00</span>
                    </div>
                )}

                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
                    <LayoutGrid className="h-4 w-4" />
                </Button>

                <div className={cn("h-8 w-8 rounded-full border-2 shadow-inner flex items-center justify-center text-[10px] font-bold text-white cursor-pointer hover:scale-105 transition-transform", isHackerrank ? "bg-emerald-600 border-emerald-900" : "gradient-golden border-zinc-800")}>
                    JD
                </div>
            </div>
        </header>
    );
};
