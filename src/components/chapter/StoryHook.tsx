import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface StoryHookProps {
  content?: string;
  onMarkDone?: () => void;
}

export const StoryHook: React.FC<StoryHookProps> = ({ content, onMarkDone }) => {
  if (!content) return null;

  return (
    <div className="pt-2">
      <div className="border-l-4 border-orange-400 bg-orange-50/30 p-4 rounded-r-xl mb-6">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
          <span>📖</span> Why This Matters
        </h2>
        <p className="text-sm leading-relaxed text-slate-700">
          {content}
        </p>
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
