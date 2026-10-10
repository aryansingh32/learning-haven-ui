import React from 'react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';

interface CheatsheetSectionProps {
    url: string;
    source: string;
    title: string;
    onMarkDone?: () => void;
}

export const CheatsheetSection: React.FC<CheatsheetSectionProps> = ({
    url,
    source,
    title,
    onMarkDone
}) => {
    if (!url) return null;

    return (
        <div className="pt-2">
            <div className="bg-secondary/40 border border-border rounded-xl p-5 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="inline-block px-2.5 py-1 bg-secondary text-muted-foreground text-xs font-bold rounded-md mb-2">
                            {source || 'Article'}
                        </span>
                        <h3 className="text-lg font-bold text-foreground line-clamp-2">
                            {title || 'Essential Reading Material'}
                        </h3>
                    </div>

                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 font-semibold py-2.5 px-5 rounded-xl transition-colors"
                    >
                        Open Article <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {onMarkDone && (
                <button 
                    onClick={onMarkDone}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors mt-6"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    Mark as Done
                </button>
            )}
        </div>
    );
};
