import React from 'react';
import { ExternalLink } from 'lucide-react';

interface CheatsheetSectionProps {
    url: string;
    source: string;
    title: string;
}

export const CheatsheetSection: React.FC<CheatsheetSectionProps> = ({
    url,
    source,
    title
}) => {
    if (!url) return null;

    return (
        <div className="mb-10">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-1">
                <span>📄</span> Read This (Just This One Article)
            </h2>
            <p className="text-slate-500 text-sm mb-4">
                This is the only article you need for this topic.
            </p>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md mb-2">
                            {source || 'Article'}
                        </span>
                        <h3 className="text-lg font-bold text-slate-800 line-clamp-2">
                            {title || 'Essential Reading Material'}
                        </h3>
                    </div>

                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold py-2.5 px-5 rounded-xl transition-colors"
                    >
                        Open Article <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};
