import type { CSSProperties } from 'react';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import { beatAssets } from './beat-assets';
import { beatFont } from './beat-font';
import { beatPalette, type BeatGraphicData } from './beat-model';
import styles from './beat-card.module.css';

/** One Editorial top for every team, using the Colts' Standard D geometry. */
export function EditorialCardGraphic({
  team,
  age,
  family,
}: {
  team: string;
  age: string | null;
  family: BeatGraphicData['family'];
}) {
  const palette = beatPalette(team);
  const layers = [...manifest.sharedLayers, 'diagonal-accent-stripes'];
  return (
    <div
      className={`${styles.graphic} ${beatFont.variable}`}
      data-beat-family={family}
      data-beat-composition="editorial"
      style={{ '--beat-accent': palette.accent } as CSSProperties}
    >
      <div className={styles.canvas}>
        {layers.map((id) => {
          const asset = manifest.assets.find((asset) => asset.id === id)!;
          return (
            <div
              key={id}
              className={styles.layer}
              data-beat-layer={id}
              aria-hidden="true"
              style={{
                opacity:
                  (
                    {
                      'dark-grain-texture': 0.12,
                      'etched-schematic-texture': 0.045,
                      'diagonal-shadow-bands': 0.015,
                      'diagonal-accent-stripes': 0.38,
                    } as Record<string, number>
                  )[id] ?? asset.cssOpacity,
                color: asset.colorRole === 'accent' ? 'var(--beat-accent)' : '#fff',
              }}
            >
              {beatAssets[id as keyof typeof beatAssets]}
            </div>
          );
        })}
        <span className={styles.editorialGhost} data-editorial-part="word" aria-hidden="true">
          EDITORIAL
        </span>
        <svg
          className={styles.editorialRule}
          viewBox="0 0 320 180"
          aria-hidden="true"
          data-editorial-part="rule"
        >
          <path
            d="M24 149h115"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.editorialTeam} data-editorial-part="team">
          {palette.team ?? 'NFL'}
        </span>
        <span className={styles.marker} aria-hidden="true" />
        <span className={styles.category}>EDITORIAL</span>
        {age ? <span className={styles.age}>{age}</span> : null}
      </div>
    </div>
  );
}
