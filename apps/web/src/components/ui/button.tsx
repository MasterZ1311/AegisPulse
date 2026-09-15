import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'neu'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'emerald'
    | 'amber'
    | 'critical';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  active?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-xs active:scale-[0.98] border border-sky-500/30',
  neu:
    'bg-secondary/80 hover:bg-secondary text-foreground font-semibold active:scale-[0.98] border border-border/70 shadow-xs',
  destructive:
    'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs active:scale-[0.98] border border-rose-500/30',
  outline:
    'border border-border bg-background hover:bg-muted hover:text-foreground text-foreground active:scale-[0.98] shadow-xs',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium active:scale-[0.98]',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-muted/50',
  link:
    'text-sky-600 dark:text-sky-400 underline-offset-4 hover:underline p-0 h-auto',
  emerald:
    'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs active:scale-[0.98] border border-emerald-500/30',
  amber:
    'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs active:scale-[0.98] border border-amber-400/30',
  critical:
    'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 font-bold shadow-xs',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2 text-xs',
  sm: 'h-8 rounded-lg px-2.5 text-[11px]',
  lg: 'h-10 rounded-xl px-5 text-sm',
  icon: 'h-8 w-8 p-0 flex items-center justify-center rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', active = false, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none',
          variantStyles[variant],
          sizeStyles[size],
          active && 'ring-2 ring-primary ring-offset-1',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
