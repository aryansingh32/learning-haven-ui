import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, Circle } from 'lucide-react';

interface Problem {
  id: string;
  name: string;
  url: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  platform: 'LeetCode' | 'GFG' | 'CodeChef' | 'HackerRank' | string;
}

interface ProblemsSectionProps {
  problems: Problem[];
  onMarkDone?: () => void;
}

export const ProblemsSection: React.FC<ProblemsSectionProps> = ({ problems, onMarkDone }) => {
  const [tapped, setTapped] = useState<Record<string, boolean>>({});

  if (!problems || problems.length === 0) return null;

  const toggleTapped = (id: string) => {
    setTapped(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy': return 'bg-emerald-100 text-emerald-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'hard': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPlatformColor = (plat: string) => {
    switch (plat.toLowerCase()) {
      case 'leetcode': return 'bg-orange-100 text-orange-700';
      case 'gfg': return 'bg-green-100 text-green-700';
      case 'codechef': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="pt-2">
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 mb-6">
        {problems.map((prob) => {
          const isTapped = tapped[prob.id];

          return (
            <div
              key={prob.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isTapped ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleTapped(prob.id)}
                  className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                  aria-label={isTapped ? "Mark as unsolved" : "Mark as solved"}
                >
                  {isTapped ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300 hover:text-blue-400" />
                  )}
                </button>

                <div>
                  <h3 className={`text-base font-bold mb-1.5 transition-colors ${isTapped ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {prob.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPlatformColor(prob.platform)}`}>
                      {prob.platform}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getDifficultyColor(prob.difficulty)}`}>
                      {prob.difficulty}
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={prob.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTapped(prev => ({ ...prev, [prob.id]: true }))}
                className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isTapped
                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                  }`}
              >
                Solve <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          );
        })}
      </div>

      {onMarkDone && (
          <button 
              onClick={onMarkDone}
              className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
          >
              <CheckCircle2 className="w-5 h-5" />
              Mark as Done
          </button>
      )}
    </div>
  );
};
