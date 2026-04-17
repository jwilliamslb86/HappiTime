import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body-sm text-foreground',
          'file:border-0 file:bg-transparent file:text-body-sm file:font-medium',
          'placeholder:text-muted-light',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:bg-background read-only:text-muted',
          'transition-colors duration-fast',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
export default Input;
