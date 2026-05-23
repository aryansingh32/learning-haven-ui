import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/github.css';

type Props = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: Props) {
  if (!content) return null;
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-headings:font-display prose-headings:font-semibold',
        'prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-muted/50',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:text-foreground',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
