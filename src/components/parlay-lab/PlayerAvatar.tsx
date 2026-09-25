'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import styles from './player-avatar.module.css';

type Props = {
  name: string | null | undefined;
  headshotUrl?: string | null;
  teamColor?: string | null;
  size?: number;
  rounded?: boolean;
  transparent?: boolean;
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
};

export default function PlayerAvatar({
  name,
  headshotUrl,
  teamColor,
  size = 30,
  rounded = false,
  transparent = false,
}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [headshotUrl]);
  if (!name) return null;

  return (
    <span
      className={styles.avatar}
      style={
        {
          '--avatar-size': `${size}px`,
          borderRadius: rounded ? 5 : undefined,
          background: transparent ? 'transparent' : undefined,
          '--avatar-color': teamColor ?? '#526a80',
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {headshotUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headshotUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}
