import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glow?: 'none' | 'critical' | 'evaluate' | 'primary' | 'stable';
    variant?: 'flat' | 'inset';
  }
>(({ className, glow = 'none', variant = 'flat', ...props }, ref) => {
  const glowClasses = {
    none: '',
    critical: 'neu-glow-critical border-rose-500/50',
    evaluate: 'neu-glow-evaluate border-orange-500/50',
    primary: 'neu-glow-primary border-sky-500/50',
    stable: 'neu-glow-stable border-emerald-500/40',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl transition-all duration-200 text-card-foreground',
        variant === 'inset' ? 'neu-inset' : 'neu-flat',
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
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-bold leading-none tracking-tight text-foreground', className)}
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
    <div ref={ref} className={cn('p-5 sm:p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 sm:p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';
