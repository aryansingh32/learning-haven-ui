import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuestionData } from '../types';
import { Separator } from "@/components/ui/separator";

interface QuestionPanelProps {
    question: QuestionData;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({ question }) => {
    const getDifficultyStyles = (diff: string) => {
        switch (diff) {
            case 'Easy': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'Hard': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
        }
    };

    return (
        <div className="h-full flex flex-col bg-card/50">
            <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">{question.title}</h2>
                    <Badge
                        className={getDifficultyStyles(question.difficulty)}
                        variant="outline"
                    >
                        {question.difficulty}
                    </Badge>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-6 py-8 max-w-3xl space-y-8">
                    <div className="prose dark:prose-invert prose-p:text-zinc-400 prose-headings:text-zinc-100 prose-code:text-emerald-400 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none max-w-none text-[15px] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {question.description}
                        </ReactMarkdown>
                    </div>

                    {question.examples.length > 0 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-zinc-200">Examples</h3>
                            {question.examples.map((ex, idx) => (
                                <div key={idx} className="group relative bg-zinc-900/50 border border-border/50 rounded-xl overflow-hidden transition-all hover:bg-zinc-900/80">
                                    <div className="p-4 space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Input</p>
                                            <pre className="text-sm font-mono text-zinc-300 bg-black/30 p-3 rounded-lg border border-white/5">
                                                {ex.input}
                                            </pre>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Output</p>
                                            <pre className="text-sm font-mono text-emerald-400 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                                                {ex.output}
                                            </pre>
                                        </div>
                                        {ex.explanation && (
                                            <div className="space-y-2 pt-2">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Explanation</p>
                                                <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-zinc-700 pl-3">
                                                    {ex.explanation}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {question.constraints.length > 0 && (
                        <div className="pb-8">
                            <h3 className="text-lg font-semibold text-zinc-200 mb-4">Constraints</h3>
                            <ul className="space-y-2.5">
                                {question.constraints.map((c, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-zinc-400">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/40 shrink-0" />
                                        <code className="bg-zinc-800/50 px-1.5 py-0.5 rounded border border-white/5 text-zinc-300 font-mono text-xs">
                                            {c}
                                        </code>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
