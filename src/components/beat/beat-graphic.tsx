'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type ReactNode } from 'react';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import { TEAM_LIST } from '@/data/teams';
import { beatAssets } from './beat-assets';
import { beatFont } from './beat-font';
import { beatTeam, type BeatGraphicData } from './beat-model';
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
  const recipe = manifest.recipes[data.family];
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
    case 'game-matchup':
      Object.assign(text, { week: data.week, versus: 'VS', kickoff: data.kickoff });
      extra.push(
        <Logo key="home" abbr={data.home} x={20} y={60} width={78} height={72} />,
        <Logo key="away" abbr={data.away} x={222} y={60} width={78} height={72} />,
      );
      break;
    case 'game-result':
      Object.assign(text, {
        'score-home': data.homeScore,
        'score-away': data.awayScore,
        final: data.final,
      });
      extra.push(
        <Logo key="home" abbr={data.home} x={16} y={68} width={66} height={56} />,
        <Logo key="away" abbr={data.away} x={240} y={68} width={66} height={56} />,
      );
      break;
    case 'numbered':
      Object.assign(text, { number: data.count, descriptor: data.descriptor });
      if (data.count.length === 2) overrides.number = { fontSize: 86 };
      if (data.count.length > 2) {
        overrides.number = { fontSize: 64, width: 120, y: 60 };
        overrides.descriptor = { x: 148, width: 106, fontSize: 26 };
      }
      break;
    case 'stats':
      Object.assign(text, { number: data.count, descriptor: data.descriptor });
      if (data.count.length > 1) overrides.number = { fontSize: 72, y: 61 };
      data.rows.forEach((row, i) => {
        extra.push(
          slot(`value${i}`, row.value, {
            x: 198,
            y: [42, 83, 123][i],
            width: 102,
            height: 21,
            fontSize: 19,
            weight: 700,
            color: 'white',
          }),
        );
        extra.push(
          slot(`label${i}`, row.label, {
            x: 198,
            y: [64, 105, 145][i],
            width: 102,
            height: 22,
            fontSize: 10,
            weight: 600,
            color: 'white',
          }),
        );
      });
      break;
    case 'player':
      Object.assign(text, {
        name: data.name,
        position: data.position,
        jersey: data.jersey ? `#${data.jersey}` : '',
      });
      if (data.name.length > 16) overrides.name = { fontSize: 23 };
      if (data.position.length > 2) overrides.position = { fontSize: 72, y: 65 };
      break;
    case 'injury':
      text.week = data.period;
      if (data.period.length > 2) overrides.week = { fontSize: 82, y: 61 };
      data.rows.forEach((row, i) =>
        extra.push(
          slot(`status${i}`, `${row.count} ${row.status}`, {
            x: 186,
            y: 69 + i * 30,
            width: 115,
            height: 26,
            fontSize: row.status.length > 9 ? 16 : 20,
            weight: 600,
            color: 'white',
          }),
        ),
      );
      break;
    case 'transaction':
      Object.assign(text, {
        action: data.action,
        name: data.name,
        'position-number': `${data.position}${data.jersey ? ` · ${data.jersey}` : ''}`,
      });
      if (data.action.length > 6) overrides.action = { fontSize: 26 };
      if (data.name.length > 18) overrides.name = { fontSize: 16 };
      if (data.contract)
        text.contract = (
          <>
            <small className={styles.contractLabel}>Contract</small>
            {data.contract.term}
            <br />
            {data.contract.value}
          </>
        );
      extra.push(<Logo key="team" abbr={data.team} x={25} y={48} width={75} height={49} />);
      break;
    case 'quote':
      Object.assign(text, { quote: data.quote, attribution: `— ${data.attribution}` });
      break;
    case 'film':
      text.title = 'FILM\nROOM';
      break;
    case 'developing':
      data.updates.forEach((update, i) => {
        extra.push(
          slot(`time${i}`, update.time, {
            x: 60,
            y: [51, 92, 134][i],
            width: 242,
            height: 15,
            fontSize: 13,
            weight: 600,
            color: 'white',
          }),
        );
        extra.push(
          slot(`detail${i}`, update.detail, {
            x: 60,
            y: [67, 108, 150][i],
            width: 242,
            height: 27,
            fontSize: 12,
            weight: 500,
            color: 'white',
          }),
        );
      });
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
      text.title = 'GAME\nPLAN';
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
    if (id === 'contract-divider' && data.family === 'transaction' && !data.contract) return false;
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
                opacity: asset.cssOpacity,
                color: asset.colorRole === 'accent' ? 'var(--beat-accent)' : '#fff',
              }}
            >
              {beatAssets[id as keyof typeof beatAssets]}
            </div>
          );
        })}
        {recipe.textSlots
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
          <span className="sr-only">Position: {data.position}</span>
        ) : null}
        {extra}
        <span className={styles.marker} aria-hidden="true" />
        <span className={styles.category}>{category.replaceAll('_', ' ')}</span>
        {age ? <span className={styles.age}>{age}</span> : null}
      </div>
    </div>
  );
}
