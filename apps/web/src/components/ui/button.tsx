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
    'bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-600/30 active:scale-[0.98] border border-sky-500/40',
  neu:
    'neu-button text-foreground font-semibold hover:text-sky-600 dark:hover:text-sky-400',
  destructive:
    'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30 active:scale-[0.98] border border-rose-500/40',
  outline:
    'neu-button text-foreground hover:text-sky-600 dark:hover:text-sky-400 active:scale-[0.98] border border-border/70',
  secondary:
    'neu-button text-muted-foreground hover:text-foreground active:scale-[0.98]',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-muted/40',
  link:
    'text-sky-600 dark:text-sky-400 underline-offset-4 hover:underline p-0 h-auto',
  emerald:
    'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30 active:scale-[0.98] border border-emerald-500/40',
  amber:
    'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/30 active:scale-[0.98] border border-amber-400/40',
  critical:
    'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/50 hover:bg-rose-500/30 shadow-md shadow-rose-950/20 font-bold',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2 text-xs',
  sm: 'h-8 rounded-lg px-3 text-[11px]',
  lg: 'h-10 rounded-xl px-6 text-sm',
  icon: 'h-9 w-9 p-0 flex items-center justify-center rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', active = false, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70',
          'disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none',
          variantStyles[variant],
          sizeStyles[size],
          active && 'neu-inset',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
