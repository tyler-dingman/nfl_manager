'use client';

import React, { useEffect, useState } from 'react';
import { DdProfileIcon as UserRound } from '@/components/ui/football-icons';

type UserAvatarProps = {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
  fallback?: 'icon' | 'initials';
};

export default function UserAvatar({
  src,
  name,
  size = 'sm',
  className = '',
  fallback = 'icon',
}: UserAvatarProps) {
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
        {fallback === 'initials' ? (
          name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
        ) : (
          <UserRound className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />
        )}
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
