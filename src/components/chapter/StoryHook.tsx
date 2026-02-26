import React from "react";

interface StoryHookProps {
  story: string | null | undefined;
}

export const StoryHook: React.FC<StoryHookProps> = ({ story }) => {
  if (!story) return null;

  return (
    <section className="mb-6">
      <div className="border-l-4 border-orange-400 bg-white rounded-xl shadow-sm px-4 py-3">
        <p className="text-xs font-semibold uppercase text-orange-700 mb-2">
          📖 Why This Matters
        </p>
        <p className="text-base leading-relaxed text-gray-700">
          {story}
        </p>
      </div>
    </section>
  );
};

