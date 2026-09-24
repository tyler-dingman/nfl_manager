'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type ReactNode } from 'react';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import { TEAM_LIST } from '@/data/teams';
import { beatAssets } from './beat-assets';
import { beatFont } from './beat-font';
import { beatTeam, type BeatGraphicData } from './beat-model';
import { beatComposition } from './beat-composition';
import styles from './beat-card.module.css';

type Slot = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  weight: number;
  color: string;
  name?: string;
};
function slotStyle(slot: Slot): CSSProperties {
  return {
    left: `${slot.x / 3.2}%`,
    top: `${slot.y / 1.8}%`,
    width: `${slot.width / 3.2}%`,
    height: `${slot.height / 1.8}%`,
    fontSize: `${slot.fontSize / 3.2}cqw`,
    fontWeight: slot.weight,
    color:
      slot.color === 'accent'
        ? 'var(--beat-accent)'
        : slot.color === 'outline'
          ? 'transparent'
          : '#fff',
    opacity: slot.color === 'ghost' ? 0.085 : slot.color === 'muted' ? 0.65 : 1,
    ...(slot.color === 'ghost' ? { letterSpacing: '-.04em' } : {}),
    ...(slot.color === 'outline' ? { WebkitTextStroke: '.40625cqw var(--beat-accent)' } : {}),
  };
}
function Logo({
  abbr,
  x,
  y,
  width,
  height,
}: {
  abbr: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  const team = TEAM_LIST.find((team) => team.abbr === beatTeam(abbr));
  return (
    <div
      className={styles.logo}
      style={{
        left: `${x / 3.2}%`,
        top: `${y / 1.8}%`,
        width: `${width / 3.2}%`,
        height: `${height / 1.8}%`,
      }}
    >
      {team && !failed ? (
        <Image
          src={team.logoUrl}
          alt={team.name}
          fill
          unoptimized
          sizes="100px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{abbr}</span>
      )}
    </div>
  );
}

export function BeatGraphic({
  data,
  selectedTeam,
  category,
  age,
}: {
  data: BeatGraphicData;
  selectedTeam: string;
  category: string;
  age: string | null;
}) {
  const composition = beatComposition(
    data,
    (abbr) => <Logo abbr={abbr} x={0} y={0} width={80} height={80} />,
    beatTeam(selectedTeam) ?? 'NFL',
  );
  const recipeFamily =
    data.family === 'depth-chart'
      ? 'league'
      : data.family === 'mailbag'
        ? 'business-community'
        : data.family === 'practice'
          ? 'standard-c'
          : data.family === 'roster-roundup'
            ? 'transaction'
            : data.family === 'recap'
              ? 'game-matchup'
              : data.family === 'interview' || data.family === 'team-update'
                ? 'league'
                : data.family;
  const recipe = manifest.recipes[recipeFamily];
  const team = beatTeam(selectedTeam) ?? 'NFL';
  const text: Record<string, ReactNode> = {
    ghost: team,
    category: category.replaceAll('_', ' '),
    'team-small': team,
  };
  const overrides: Record<string, Partial<Slot>> = {};
  const extra: ReactNode[] = [];
  const slot = (key: string, content: ReactNode, spec: Slot) => (
    <span key={key} className={styles.slot} style={slotStyle(spec)}>
      {content}
    </span>
  );
  switch (data.family) {
    case 'roster-roundup':
      Object.assign(text, { action: 'ROSTER', name: 'MOVES' });
      extra.push(<Logo key="team" abbr={data.team} x={25} y={48} width={75} height={49} />);
      overrides.name = { x: 181, y: 94, width: 119, height: 40, fontSize: 34 };
      break;
    case 'interview':
      text.title = data.transcript ? 'PRESS\nTRANSCRIPT' : 'INTERVIEW';
      overrides.title = { x: 24, y: 57, width: 260, height: 76, fontSize: 32 };
      if (data.name)
        extra.push(
          slot('speaker', data.name, {
            x: 24,
            y: 140,
            width: 270,
            height: 26,
            fontSize: 19,
            weight: 600,
            color: 'white',
          }),
        );
      break;
    case 'team-update':
      text.title = data.label;
      break;
    case 'quote':
      Object.assign(text, { quote: data.quote, attribution: `— ${data.attribution}` });
      break;
    case 'film':
      text.title = 'FILM\nROOM';
      break;
    case 'business-community':
      text.title = data.label;
      break;
    case 'scouting':
      text.title = 'KNOW\nYOUR FOE';
      if (data.opponent)
        extra.push(
          <Logo key="opponent" abbr={data.opponent} x={223} y={47} width={65} height={60} />,
        );
      break;
    case 'coaching':
      text.title = data.label ?? 'GAME\nPLAN';
      break;
    case 'league':
      text.title = 'LEAGUE\nUPDATE';
      break;
    case 'video':
      text.title = data.title;
      if (data.title.split(/\s+/).some((word) => word.length > 9))
        overrides.title = { fontSize: 25 };
      break;
    case 'standard-d':
      overrides.category = { fontSize: Math.min(70, 480 / Math.max(category.length, 1)) };
      extra.push(
        slot('team-small', team, {
          x: 246,
          y: 119,
          width: 54,
          height: 30,
          fontSize: 24,
          weight: 700,
          color: 'white',
        }),
      );
      break;
  }
  const layerIds = [...manifest.sharedLayers, ...recipe.layers].filter((id) => {
    if (
      data.family === 'transaction' &&
      ['directional-four-chevrons', 'contract-divider'].includes(id)
    )
      return false;
    if (data.family === 'depth-chart' && id === 'around-nfl-network') return false;
    if (data.family === 'mailbag' && id === 'interlocking-lines') return false;
    if (data.family === 'developing' && id === 'story-timeline') return false;
    if (
      composition &&
      [
        'name-underline',
        'status-divider',
        'data-dividers',
        'result-separator',
        'matchup-framing',
      ].includes(id)
    )
      return false;
    if (
      id === 'contract-divider' &&
      (data.family === 'roster-roundup' || (data.family === 'transaction' && !data.contract))
    )
      return false;
    if (id === 'status-divider' && data.family === 'injury' && !data.period && !data.rows.length)
      return false;
    if (id === 'data-dividers' && data.family === 'stats' && !data.rows.length) return false;
    if (id === 'closing-quote-marks' && data.family === 'quote') {
      const lines = data.quote.split('\n');
      return lines.length > 1 ? lines[lines.length - 1].length <= 15 : data.quote.length <= 40;
    }
    return true;
  });
  return (
    <div className={`${styles.graphic} ${beatFont.variable}`} data-beat-family={data.family}>
      <div className={styles.canvas}>
        {layerIds.map((id) => {
          const asset = manifest.assets.find((asset) => asset.id === id)!;
          return (
            <div
              key={id}
              data-beat-layer={id}
              className={styles.layer}
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
        {!composition &&
          recipe.textSlots
            .filter((spec) => text[spec.name] != null)
            .map((spec) => {
              const decorative = spec.color === 'ghost';
              return (
                <span
                  key={spec.name}
                  data-beat-slot={spec.name}
                  aria-hidden={decorative || spec.color === 'outline' || undefined}
                  className={`${styles.slot} ${styles[spec.name] ?? ''}`}
                  style={slotStyle({ ...spec, ...overrides[spec.name] })}
                >
                  {text[spec.name]}
                </span>
              );
            })}
        {data.family === 'player' ? (
          <span className="sr-only">Position: {data.position ?? ''}</span>
        ) : null}
        {composition ?? extra}
        <span className={styles.marker} aria-hidden="true" />
        <span className={styles.category}>{category.replaceAll('_', ' ')}</span>
        {age ? <span className={styles.age}>{age}</span> : null}
      </div>
    </div>
  );
}
