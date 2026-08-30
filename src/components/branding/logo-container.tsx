import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type LogoContainerProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function LogoContainer({ children, className, style }: LogoContainerProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-[5px] border-2 border-[var(--secondary)] bg-[var(--dark)] p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.2)] ring-1 ring-[var(--primary)]/30 transition-colors duration-300',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
