import React, { useState } from "react";

type Problem = {
  id?: string;
  name?: string;
  title?: string;
  platform?: string;
  difficulty?: string;
  url?: string;
};

interface ProblemsSectionProps {
  problems?: Problem[] | null;
}

const platformColors: Record<string, string> = {
  LeetCode: "bg-orange-100 text-orange-700",
  "GeeksForGeeks": "bg-green-100 text-green-700",
  GFG: "bg-green-100 text-green-700",
  CodeChef: "bg-purple-100 text-purple-700",
};

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-50 text-green-700 border-green-200",
  Medium: "bg-yellow-50 text-yellow-800 border-yellow-200",
  Hard: "bg-red-50 text-red-700 border-red-200",
};

export const ProblemsSection: React.FC<ProblemsSectionProps> = ({ problems }) => {
  const [tappedIds, setTappedIds] = useState<Record<string, boolean>>({});

  if (!problems || problems.length === 0) return null;

  const handleTap = (key: string) => {
    setTappedIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="mb-6">
      <p className="text-sm font-semibold text-gray-800 mb-3">
        💻 Practice Problems
      </p>
      <div className="space-y-2">
        {problems.map((p, idx) => {
          const key = p.id ?? `${p.platform}-${p.name ?? p.title}-${idx}`;
          const name = p.name ?? p.title ?? "Problem";
          const platform = p.platform ?? "";
          const difficulty = p.difficulty ?? "";

          const platformClass =
            platformColors[platform] ?? "bg-gray-100 text-gray-700";
          const diffClass =
            difficultyColors[difficulty] ?? "bg-gray-50 text-gray-600 border-gray-200";

          const tapped = !!tappedIds[key];

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => handleTap(key)}
                  className={[
                    "w-5 h-5 rounded-full border flex items-center justify-center text-[11px]",
                    tapped
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 text-gray-300",
                  ].join(" ")}
                >
                  ✓
                </button>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{name}</p>
                  <div className="flex flex-wrap gap-1 mt-1 text-[11px]">
                    {platform && (
                      <span
                        className={[
                          "px-2 py-0.5 rounded-full font-medium",
                          platformClass,
                        ].join(" ")}
                      >
                        {platform}
                      </span>
                    )}
                    {difficulty && (
                      <span
                        className={[
                          "px-2 py-0.5 rounded-full font-medium border",
                          diffClass,
                        ].join(" ")}
                      >
                        {difficulty}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  Solve →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

