import Image from 'next/image';

import { cn } from '@/lib/utils';

type FiveWideWordmarkProps = {
  className?: string;
  priority?: boolean;
};

export function FiveWideWordmark({ className, priority = false }: FiveWideWordmarkProps) {
  return (
    <Image
      src="/images/five_wide_wordmark_black.png"
      alt="Five Wide"
      width={659}
      height={66}
      className={cn('h-auto w-auto object-contain', className)}
      priority={priority}
    />
  );
}
