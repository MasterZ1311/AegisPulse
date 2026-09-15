import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glow?: 'none' | 'critical' | 'evaluate' | 'primary' | 'stable';
    variant?: 'flat' | 'inset' | 'elevated';
  }
>(({ className, glow = 'none', variant = 'flat', ...props }, ref) => {
  const glowClasses = {
    none: '',
    critical: 'border-rose-500/50 shadow-sm shadow-rose-500/10',
    evaluate: 'border-orange-500/50 shadow-sm shadow-orange-500/10',
    primary: 'border-sky-500/50 shadow-sm shadow-sky-500/10',
    stable: 'border-emerald-500/40 shadow-sm shadow-emerald-500/10',
  };

  const variantClasses = {
    flat: 'bg-card text-card-foreground border border-border/70 shadow-xs',
    inset: 'bg-muted/40 text-foreground border border-border/60 shadow-inner',
    elevated: 'bg-card text-card-foreground border border-border/80 shadow-md',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl transition-all duration-200',
        variantClasses[variant],
        glowClasses[glow],
        className
      )}
      {...props}
    />
  );
});
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4 sm:p-5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-sm sm:text-base font-bold leading-tight tracking-tight text-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-muted-foreground leading-relaxed', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 sm:p-5 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-4 sm:p-5 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';
