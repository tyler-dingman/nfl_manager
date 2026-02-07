import Image from 'next/image';

import { cn } from '@/lib/utils';

type FalcoAvatarProps = {
  size?: number;
  className?: string;
};

export default function FalcoAvatar({ size = 28, className }: FalcoAvatarProps) {
  return (
    <Image
      src="/images/falco_icon.png"
      alt="Falco"
      width={size}
      height={size}
      className={cn('rounded-full ring-1 ring-border object-cover', className)}
    />
  );
}
