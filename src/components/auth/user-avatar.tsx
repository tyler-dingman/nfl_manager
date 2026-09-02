'use client';

import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

type UserAvatarProps = {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
};

export default function UserAvatar({ src, name, size = 'sm', className = '' }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === 'md' ? 'h-10 w-10' : 'h-7 w-7';

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${dimensions} ${className}`}
        aria-hidden="true"
        data-avatar-fallback
      >
        <UserRound className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
    );
  }

  return (
    // A plain image keeps OAuth avatar hosts constrained to the URL supplied by the authenticated API.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} profile photo`}
      className={`shrink-0 rounded-full object-cover ${dimensions} ${className}`}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      data-user-avatar
    />
  );
}
