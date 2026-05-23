import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = { content: string; className?: string };

export function MarkdownPreview({ content, className }: Props) {
  if (!content) return null;
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold text-foreground">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 text-lg font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 text-base font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>,
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{children}</ol>,
          code: ({ className, children, ...props }) => {
            const isBlock = String(className || '').includes('language-');
            if (isBlock) {
              return (
                <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
