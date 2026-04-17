import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-sm border border-border bg-surface px-3 py-2 text-body-sm text-foreground',
          'placeholder:text-muted-light',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-fast',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
