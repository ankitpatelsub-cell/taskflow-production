import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export function MarkdownContent({ content, className }) {
  if (!content) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn('prose prose-sm max-w-none text-gray-700 dark:text-slate-300', className)}
      components={{
        // Override default elements with Tailwind-friendly versions
        a: ({ node, ...props }) => (
          <a
            {...props}
            className="text-indigo-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          />
        ),
        code: ({ node, inline, ...props }) =>
          inline ? (
            <code
              {...props}
              className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono"
            />
          ) : (
            <code
              {...props}
              className="block bg-gray-100 dark:bg-slate-700 p-3 rounded-lg text-xs font-mono overflow-x-auto"
            />
          ),
        ul: ({ node, ...props }) => (
          <ul {...props} className="list-disc list-inside space-y-1" />
        ),
        ol: ({ node, ...props }) => (
          <ol {...props} className="list-decimal list-inside space-y-1" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
