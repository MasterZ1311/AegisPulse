import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, icon, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        {icon && <span className="absolute left-3 pointer-events-none text-muted-foreground">{icon}</span>}
        <select
          ref={ref}
          className={cn(
            'neu-inset-sm h-9 appearance-none rounded-xl py-1.5 text-xs text-foreground font-semibold',
            'pr-8 focus:outline-none focus:ring-2 focus:ring-sky-400/50 cursor-pointer transition-all border border-border/40',
            icon ? 'pl-8' : 'pl-3',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }
);
Select.displayName = 'Select';
