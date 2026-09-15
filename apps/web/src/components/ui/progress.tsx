import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
  variant?: 'default' | 'rose' | 'amber' | 'emerald';
}

const variantColors: Record<NonNullable<ProgressProps['variant']>, string> = {
  default: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]',
  rose: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
  amber: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  emerald: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', indicatorClassName, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-800/80 border border-slate-700/40', className)}
        {...props}
      >
        <div
          className={cn('h-full w-full flex-1 transition-all duration-300', variantColors[variant], indicatorClassName)}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';
