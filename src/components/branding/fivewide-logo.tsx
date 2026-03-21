import Image from 'next/image';
import type { CSSProperties } from 'react';

import { LogoContainer } from '@/components/branding/logo-container';
import { cn } from '@/lib/utils';

type FiveWideLogoProps = {
  size?: number;
  imageClassName?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  priority?: boolean;
};

export function FiveWideLogo({
  size = 28,
  imageClassName,
  containerClassName,
  containerStyle,
  priority = false,
}: FiveWideLogoProps) {
  return (
    <LogoContainer className={containerClassName} style={containerStyle}>
      <Image
        src="/images/five_wide_logo.png"
        alt="Five Wide"
        width={size}
        height={size}
        className={cn('h-auto w-auto object-contain', imageClassName)}
        priority={priority}
      />
    </LogoContainer>
  );
}
