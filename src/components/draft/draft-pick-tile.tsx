'use client';

import type { CSSProperties } from 'react';
import { getAccessibleTeamPickColor } from '@/lib/team-theme-tokens';
import styles from './draft-pick-tile.module.css';

type Props = {
  ownerTeamId: string;
  originalOwnerTeamId?: string;
  year: number;
  round: number;
  overallPick?: number | null;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function DraftPickTile({
  ownerTeamId,
  originalOwnerTeamId,
  year,
  round,
  overallPick,
  selected = false,
  disabled = false,
  onClick,
}: Props) {
  const label = `${ownerTeamId} · ${year} Round ${round}${overallPick != null ? ` · Pick ${overallPick}` : ''}${originalOwnerTeamId && originalOwnerTeamId !== ownerTeamId ? ` · via ${originalOwnerTeamId}` : ''}`;
  return (
    <button
      type="button"
      className={styles.tile}
      data-known={overallPick != null}
      data-owner={ownerTeamId}
      style={{ '--pick-color': getAccessibleTeamPickColor(ownerTeamId) } as CSSProperties}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.round}>R{round}</span>
      {overallPick != null && <strong className={styles.overall}>{overallPick}</strong>}
      {selected && (
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
