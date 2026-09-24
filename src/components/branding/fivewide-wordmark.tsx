import { TeamBrandedLogo } from './team-branded-logo';

import { cn } from '@/lib/utils';

type FiveWideWordmarkProps = {
  className?: string;
  priority?: boolean;
};

export function FiveWideWordmark({ className }: FiveWideWordmarkProps) {
  return (
    <TeamBrandedLogo
      width={1594}
      height={806}
      style={{ aspectRatio: '1601 / 818' }}
      className={cn('h-auto w-auto object-contain', className)}
    />
  );
}
