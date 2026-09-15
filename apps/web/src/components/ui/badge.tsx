import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'critical'
    | 'evaluate'
    | 'watch'
    | 'low'
    | 'stale'
    | 'online'
    | 'degraded'
    | 'offline';
  dot?: boolean;
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:
    'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/40 shadow-sm font-semibold',
  secondary:
    'bg-slate-200/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-border/70 font-medium',
  destructive:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/50 font-bold',
  outline:
    'border border-border/80 text-foreground bg-transparent font-medium',
  critical:
    'bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.25)] font-black tracking-wider',
  evaluate:
    'bg-orange-500/20 text-orange-900 dark:text-orange-200 border border-orange-500/60 shadow-[0_0_10px_rgba(249,115,22,0.25)] font-black tracking-wider',
  watch:
    'bg-yellow-500/25 text-yellow-900 dark:text-yellow-200 border border-yellow-500/60 font-black tracking-wider',
  low:
    'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-500/60 font-black tracking-wider',
  stale:
    'bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/60 font-bold',
  online:
    'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-500/60 font-bold',
  degraded:
    'bg-orange-500/20 text-orange-900 dark:text-orange-200 border border-orange-500/60 animate-pulse font-bold',
  offline:
    'bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/60 font-bold',
};

const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-sky-600 dark:bg-sky-400',
  secondary: 'bg-slate-500',
  destructive: 'bg-rose-600 dark:bg-rose-400',
  outline: 'bg-slate-500',
  critical: 'bg-rose-600 dark:bg-rose-400 animate-pulse',
  evaluate: 'bg-orange-600 dark:bg-orange-400',
  watch: 'bg-yellow-500 dark:bg-yellow-400',
  low: 'bg-emerald-600 dark:bg-emerald-400',
  stale: 'bg-rose-600 dark:bg-rose-400 animate-ping',
  online: 'bg-emerald-600 dark:bg-emerald-400',
  degraded: 'bg-orange-600 dark:bg-orange-400',
  offline: 'bg-rose-600 dark:bg-rose-400',
};

export function Badge({ className, variant = 'default', dot = false, children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs tracking-wide transition-colors font-mono select-none',
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-2 w-2 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </div>
  );
}
