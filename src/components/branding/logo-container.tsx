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
        'inline-flex items-center justify-center rounded-[5px] bg-[#0B0B0B] p-2 shadow-[0_1px_3px_rgba(0,0,0,0.2)]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
