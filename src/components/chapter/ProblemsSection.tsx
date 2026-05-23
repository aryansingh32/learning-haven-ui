import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChapterCta } from './ChapterCta';

interface Problem {
  id: string;
  name: string;
  url?: string;
  description?: string;
  difficulty: string;
  platform?: string;
}

interface ProblemsSectionProps {
  problems: Problem[];
  onMarkDone?: () => void;
}

export const ProblemsSection: React.FC<ProblemsSectionProps> = ({ problems, onMarkDone }) => {
  const [solved, setSolved] = useState<Record<string, boolean>>({});

  if (!problems || problems.length === 0) return null;

  const solvedCount = Object.values(solved).filter(Boolean).length;

  return (
    <motion.div className="mt-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="text-xs text-muted-foreground">
        Problems solved: {solvedCount}/{problems.length}
      </p>
      <motion.div className="space-y-2">
        {problems.map((problem) => (
          <motion.div
            key={problem.id}
            className="rounded-2xl border border-border/50 bg-secondary/40 p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{problem.name}</p>
              {problem.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{problem.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                {problem.difficulty || 'practice'}
              </span>
              {problem.url && problem.url !== '#' && (
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2 py-1 rounded-full bg-background border border-border text-foreground font-semibold"
                >
                  Solve
                </a>
              )}
              <button
                type="button"
                onClick={() => setSolved((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-full font-semibold',
                  solved[problem.id]
                    ? 'bg-success/15 text-success'
                    : 'bg-background border border-border text-foreground'
                )}
              >
                {solved[problem.id] ? 'Solved' : 'Mark'}
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
      <div className="rounded-2xl bg-secondary/30 border border-border/40 p-3 text-[11px] text-muted-foreground">
        Did you complete these problems? Be honest. This helps you improve faster.
      </div>
      {onMarkDone && (
        <ChapterCta variant="primary" icon="check" onClick={onMarkDone}>
          I&apos;ve attempted these
        </ChapterCta>
      )}
    </motion.div>
  );
};
