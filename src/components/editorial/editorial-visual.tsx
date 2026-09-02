import type { CSSProperties } from 'react';

import {
  getEditorialVisualForStory,
  type EditorialStoryInput,
  type EditorialVisualData,
  type EditorialVisualType,
  type EditorialVisualVariant,
} from '../../../packages/editorial-visual';
import { getHeroPalette } from '@/lib/playbook-hero';

type Props = {
  story?: EditorialStoryInput;
  visual?: EditorialVisualData;
  teamId?: string;
  variant?: EditorialVisualVariant;
  className?: string;
  decorative?: boolean;
};

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');
const legacyTypeMap: Partial<Record<EditorialVisualType, EditorialVisualType>> = {
  ROSTER_MOVE: 'TRANSACTION',
  INJURY_REPORT: 'INJURY_AVAILABILITY',
  STAT: 'DATA',
  FILM_ROOM: 'PLAYBOOK',
  GAME_DAY: 'GAME_PREVIEW',
  FINAL: 'GAME_RESULT',
  DRAFT: 'DRAFT_FRONT_OFFICE',
  HEADLINE: 'GENERIC_NEWS',
};
const modernType = (type: EditorialVisualType) => legacyTypeMap[type] ?? type;

export default function EditorialVisual({
  story,
  visual,
  teamId,
  variant = 'card',
  className,
  decorative = false,
}: Props) {
  const data = visual ?? getEditorialVisualForStory({ ...story, teamId: teamId ?? story?.teamId });
  const palette = getHeroPalette(data.teamId);
  const style = {
    '--ev-primary': palette.primaryRoute,
    '--ev-secondary': palette.secondaryRoute,
    '--ev-background': palette.background,
    '--ev-foreground': palette.chalk,
  } as CSSProperties;
  const compact = variant === 'compact';
  const hero = variant === 'hero';
  return (
    <div
      style={style}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${data.eyebrow}: ${data.primaryText}`}
      className={cx(
        'editorial-visual relative isolate flex overflow-hidden bg-[var(--ev-background)] text-[var(--ev-foreground)]',
        hero ? 'min-h-64 p-6 sm:min-h-72 sm:p-7' : compact ? 'min-h-36 p-4' : 'min-h-48 p-5 sm:p-6',
        className,
      )}
    >
      <VisualTexture />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex w-fit border-l-4 border-[var(--ev-primary)] pl-2 text-[9px] font-black uppercase tracking-[0.2em] text-white sm:text-[10px]">
            {data.eyebrow}
          </span>
          <span className="shrink-0 text-[9px] font-black tracking-[0.16em] text-white/65 sm:text-[10px]">
            {data.teamId} · D&amp;D
          </span>
        </div>
        <Template
          data={{
            ...data,
            visualType: modernType(data.visualType) as EditorialVisualData['visualType'],
          }}
          compact={compact}
          hero={hero}
        />
      </div>
    </div>
  );
}

function Template({
  data,
  compact,
  hero,
}: {
  data: EditorialVisualData;
  compact: boolean;
  hero: boolean;
}) {
  const headline = cx(
    hero ? 'text-3xl sm:text-5xl' : compact ? 'text-xl' : 'text-2xl sm:text-3xl',
    'font-black uppercase leading-[0.9] tracking-[-0.035em]',
  );
  const type = data.visualType;
  const secondary = data.secondaryText ? (
    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/65 sm:text-xs">
      {data.secondaryText}
    </p>
  ) : null;

  if (type === 'PLAYER')
    return (
      <div className="mt-auto grid grid-cols-[auto_1fr] items-end gap-4 pt-7">
        {data.number ? <OutlineNumber value={data.number} /> : null}
        <div className="pb-1">
          <p className={headline}>{data.primaryText}</p>
          {secondary}
          {data.stats?.length ? <StatStrip stats={data.stats} compact={compact} /> : null}
        </div>
      </div>
    );
  if (type === 'INJURY_AVAILABILITY')
    return (
      <div className="mt-auto pt-8">
        <p className={cx(headline, 'max-w-[82%]')}>{data.primaryText}</p>
        {secondary}
        {data.status ? (
          <div className="mt-4 flex items-center gap-2 text-sm font-black uppercase text-[var(--ev-primary)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current">
              +
            </span>
            {data.status}
          </div>
        ) : null}
        {data.items?.length ? <Participation items={data.items} /> : null}
        <NumberGhost value={data.number} />
      </div>
    );
  if (type === 'DEPTH_CHART' || type === 'ROSTER_WATCH')
    return (
      <div className="mt-auto pt-7">
        <p className={cx(headline, 'text-[var(--ev-primary)]')}>
          {data.secondaryText || 'DEPTH CHART'}
        </p>
        <RankedItems items={data.items} fallback={data.primaryText} compact={compact} />
      </div>
    );
  if (type === 'TRANSACTION' || type === 'TRADE')
    return (
      <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-5 pt-8">
        <div>
          <p className={cx(headline, 'text-[var(--ev-primary)]')}>
            {data.action || 'ROSTER UPDATE'}
          </p>
          <p className="mt-3 max-w-[92%] text-base font-black uppercase leading-tight sm:text-xl">
            {data.primaryText}
          </p>
          {secondary}
        </div>
        <span className="pb-2 text-4xl font-black text-[var(--ev-primary)]">→</span>
      </div>
    );
  if (type === 'DEVELOPING')
    return (
      <div
        className={cx(
          'mt-auto gap-5 pt-7',
          hero && data.timeline?.length ? 'grid sm:grid-cols-2' : '',
        )}
      >
        <div>
          <p className="text-sm font-black uppercase text-[var(--ev-primary)]">Developing</p>
          <p className={cx(headline, 'mt-2 max-w-[92%]')}>{data.primaryText}</p>
          {data.status ? (
            <p className="mt-3 text-xs font-black uppercase text-white/60">
              Status · {data.status}
            </p>
          ) : null}
        </div>
        {data.timeline?.length ? <Timeline items={data.timeline} compact={compact} /> : null}
      </div>
    );
  if (type === 'DATA')
    return (
      <div className="mt-auto pt-7">
        <p className="text-5xl font-black leading-none tracking-[-0.06em] text-[var(--ev-primary)] sm:text-7xl">
          {data.value || 'DATA'}
        </p>
        <p className="mt-2 max-w-[88%] text-sm font-black uppercase leading-tight sm:text-lg">
          {data.label || data.primaryText}
        </p>
        {data.stats?.length ? <StatStrip stats={data.stats} compact={compact} /> : null}
      </div>
    );
  if (type === 'PLAYBOOK')
    return (
      <div className="mt-auto grid grid-cols-[1fr_42%] items-end gap-3 pt-5">
        <p className={headline}>{data.primaryText}</p>
        <PlaybookDiagram />
      </div>
    );
  if (type === 'GAME_PREVIEW' || type === 'GAME_RESULT')
    return (
      <div className="mt-auto pt-8">
        <p className="text-4xl font-black uppercase tracking-[-0.04em] sm:text-5xl">
          {data.teamId}{' '}
          <span className="text-[var(--ev-primary)]">
            {type === 'GAME_RESULT' ? data.value || 'FINAL' : 'VS'}
          </span>{' '}
          {data.opponentTeamId || data.opponent || ''}
        </p>
        <p className="mt-4 max-w-[90%] text-sm font-black uppercase leading-tight sm:text-lg">
          {data.primaryText}
        </p>
        {secondary}
        {data.kickoff || data.venue ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/55">
            {data.kickoff ? <span>{data.kickoff}</span> : null}
            {data.venue ? <span>{data.venue}</span> : null}
          </div>
        ) : null}
      </div>
    );
  if (type === 'DRAFT_FRONT_OFFICE' || type === 'DRAFT')
    return (
      <div className="mt-auto pt-8">
        <p className={cx(headline, 'text-[var(--ev-primary)]')}>{data.action || 'FRONT OFFICE'}</p>
        <p className="mt-3 max-w-[90%] text-base font-black uppercase leading-tight sm:text-xl">
          {data.primaryText}
        </p>
        {secondary}
      </div>
    );
  return (
    <div className="mt-auto pt-8">
      <p className={cx(headline, hero ? 'max-w-[88%]' : 'max-w-[95%]')}>{data.primaryText}</p>
      {secondary}
      {data.status ? (
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ev-primary)]">
          {data.status.replaceAll('_', ' ')}
        </p>
      ) : null}
    </div>
  );
}

function OutlineNumber({ value }: { value: string }) {
  return (
    <span className="text-7xl font-black leading-[0.75] text-transparent [-webkit-text-stroke:2px_var(--ev-primary)] sm:text-8xl">
      {value}
    </span>
  );
}
function NumberGhost({ value }: { value?: string }) {
  return value ? (
    <span className="pointer-events-none absolute bottom-1 right-3 text-8xl font-black leading-none text-transparent opacity-35 [-webkit-text-stroke:2px_var(--ev-primary)]">
      {value}
    </span>
  ) : null;
}
function StatStrip({
  stats,
  compact,
}: {
  stats: NonNullable<EditorialVisualData['stats']>;
  compact: boolean;
}) {
  return (
    <div className="mt-4 flex divide-x divide-white/20">
      {stats.slice(0, compact ? 2 : 4).map((stat) => (
        <div className="pr-3 first:pl-0 [&+&]:pl-3" key={stat.label}>
          <p className="text-lg font-black">{stat.value}</p>
          <p className="text-[8px] font-black uppercase tracking-wider text-white/45">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
function Participation({ items }: { items: NonNullable<EditorialVisualData['items']> }) {
  return (
    <div className="mt-4 flex divide-x divide-white/15">
      {items.slice(0, 3).map((item) => (
        <div className="pr-4 [&+&]:pl-4" key={item.label}>
          <p className="text-[9px] font-black uppercase text-white/45">{item.label}</p>
          <p className="mt-1 text-xs font-black uppercase">{item.detail || '—'}</p>
        </div>
      ))}
    </div>
  );
}
function RankedItems({
  items,
  fallback,
  compact,
}: {
  items?: EditorialVisualData['items'];
  fallback: string;
  compact: boolean;
}) {
  const rows = items?.length ? items : [{ label: fallback }];
  return (
    <div className="mt-4 space-y-3">
      {rows.slice(0, compact ? 2 : 4).map((item, index) => (
        <div className="flex items-center gap-3" key={`${item.label}-${index}`}>
          <span className="w-5 text-sm font-black text-[var(--ev-primary)]">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-black uppercase sm:text-sm">
            {item.label}
          </span>
          {item.detail ? (
            <span className="text-[10px] font-black uppercase text-white/45">{item.detail}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
function Timeline({
  items,
  compact,
}: {
  items: NonNullable<EditorialVisualData['timeline']>;
  compact: boolean;
}) {
  return (
    <div className="border-l-2 border-[var(--ev-primary)] pl-4">
      {items.slice(0, compact ? 2 : 4).map((item) => (
        <div className="relative mb-3 last:mb-0" key={`${item.time}-${item.label}`}>
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--ev-primary)]" />
          <p className="text-[9px] font-black text-white/55">{item.time}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase leading-tight">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
function PlaybookDiagram() {
  return (
    <svg aria-hidden="true" className="h-28 w-full" viewBox="0 0 180 120">
      <g
        fill="none"
        stroke="var(--ev-foreground)"
        strokeLinecap="round"
        strokeWidth="2"
        opacity=".8"
      >
        {[25, 55, 85, 115, 145].map((x) => (
          <circle cx={x} cy="88" key={x} r="6" />
        ))}
        {[42, 74, 108, 139].map((x) => (
          <path d={`M${x - 5} 48 l10 10 M${x + 5} 48 l-10 10`} key={x} />
        ))}
        <path d="M25 82 C25 45 55 40 70 15" stroke="var(--ev-primary)" strokeWidth="3" />
        <path d="M85 82 C110 69 121 42 128 18" strokeDasharray="4 4" />
        <path d="M145 82 C155 64 160 50 166 39" stroke="var(--ev-primary)" strokeWidth="3" />
      </g>
    </svg>
  );
}
function VisualTexture() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_18%,rgba(255,255,255,.06),transparent_25%),radial-gradient(circle_at_80%_72%,rgba(255,255,255,.035),transparent_30%)]" />
      <div className="absolute inset-y-0 right-[12%] w-px bg-white/10" />
      <div className="absolute bottom-4 left-5 right-5 flex justify-between opacity-25">
        {Array.from({ length: 13 }, (_, i) => (
          <i className={cx('block w-px bg-white', i % 3 === 0 ? 'h-4' : 'h-2')} key={i} />
        ))}
      </div>
      <div className="absolute -right-16 -top-16 h-48 w-48 rotate-12 rounded-full border-[20px] border-white/[0.025]" />
    </div>
  );
}
