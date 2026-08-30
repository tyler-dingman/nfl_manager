import Image from 'next/image';

import { cn } from '@/lib/utils';

type FiveWideWordmarkProps = {
  className?: string;
  priority?: boolean;
};

export function FiveWideWordmark({ className, priority = false }: FiveWideWordmarkProps) {
  return (
    <Image
      src="/images/down_distance_badge.png"
      alt="Down & Distance"
      width={1594}
      height={806}
      className={cn('h-auto w-auto object-contain', className)}
      priority={priority}
    />
  );
}
