import React from 'react';

interface StoryHookProps {
  content?: string;
}

export const StoryHook: React.FC<StoryHookProps> = ({ content }) => {
  if (!content) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
      <div className="px-6 py-5 border-l-4 border-orange-400 bg-orange-50/30">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
          <span>📖</span> Why This Matters
        </h2>
        <p className="text-base leading-relaxed text-slate-700">
          {content}
        </p>
      </div>
    </div>
  );
};
