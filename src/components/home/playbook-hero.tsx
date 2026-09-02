'use client';

import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import { useMemo } from 'react';

import type { Team } from '@/features/team/team-store';
import { getDeterministicPlayIndex, getHeroPalette, getPlaybookDayKey } from '@/lib/playbook-hero';

type NextGame = {
  opponentAbbr: string;
  startsAt: string;
};

type PlaybookHeroProps = {
  team?: Team;
  frontOfficeHref: string;
  nextGame?: NextGame | null;
};

const plays = [
  {
    name: 'Mesh',
    featured: 'M48 165 C132 165 142 93 226 93 S342 116 414 43',
    support: 'M76 188 C143 188 171 232 244 232 S339 190 391 188',
    alternate: 'M132 165 C167 131 179 72 179 35',
    motion: 'M291 165 C328 140 353 106 361 70',
  },
  {
    name: 'Trips',
    featured: 'M86 171 C119 128 123 76 121 28',
    support: 'M171 171 C196 124 202 77 199 36',
    alternate: 'M256 171 C292 139 319 94 326 40',
    motion: 'M344 171 C365 143 387 126 428 116',
  },
  {
    name: 'Outside zone',
    featured: 'M220 190 C268 188 306 174 344 143 S399 112 443 113',
    support: 'M195 172 C217 148 239 135 271 126',
    alternate: 'M112 172 C139 133 144 86 142 47',
    motion: 'M333 171 C309 146 286 129 253 119',
  },
  {
    name: 'Play action',
    featured: 'M204 191 C231 155 265 147 290 120 S318 68 319 30',
    support: 'M123 171 C159 134 184 95 186 40',
    alternate: 'M358 171 C383 148 407 141 447 142',
    motion: 'M205 191 C177 210 151 218 116 216',
  },
  {
    name: 'Levels',
    featured: 'M78 170 C122 137 173 126 242 127 S355 123 431 79',
    support: 'M125 191 C170 169 213 166 278 166 S369 161 417 144',
    alternate: 'M294 170 C316 126 321 78 321 37',
    motion: 'M218 170 C196 139 176 119 146 104',
  },
  {
    name: 'Red zone',
    featured: 'M340 178 C382 151 402 119 405 73 C406 52 421 39 448 35',
    support: 'M264 178 C298 148 306 113 304 72',
    alternate: 'M175 178 C207 152 218 128 222 100',
    motion: 'M94 178 C127 163 151 139 162 108',
  },
] as const;

const formatBriefingDate = (dayKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dayKey}T12:00:00Z`));

const splitTeamName = (fullName: string) => {
  const words = fullName.trim().split(/\s+/);
  if (words.length < 2) return { city: fullName, nickname: '' };
  return { city: words.slice(0, -1).join(' '), nickname: words.at(-1) ?? '' };
};

function ArrowHead({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3">
      <path d="M0 0 L6 3 L0 6" fill="none" stroke={color} strokeLinecap="round" strokeWidth="1.5" />
    </marker>
  );
}

function PlayDiagram({
  teamAbbr,
  dayKey,
  nextGame,
}: {
  teamAbbr: string;
  dayKey: string;
  nextGame?: NextGame | null;
}) {
  const palette = getHeroPalette(teamAbbr);
  const playIndex = getDeterministicPlayIndex(teamAbbr, dayKey, plays.length);
  const play = plays[playIndex];
  const primaryMarker = `primary-arrow-${teamAbbr.toLowerCase()}`;
  const secondaryMarker = `secondary-arrow-${teamAbbr.toLowerCase()}`;
  const chalkMarker = `chalk-arrow-${teamAbbr.toLowerCase()}`;

  return (
    <div
      className="relative min-h-[280px] w-full md:min-h-[330px] lg:min-h-[430px]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 300" role="presentation">
        <defs>
          <filter id="chalk-roughness">
            <feTurbulence
              baseFrequency="0.025"
              numOctaves="2"
              result="noise"
              seed={playIndex + 4}
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" />
          </filter>
          <pattern id="chalk-dust" height="34" patternUnits="userSpaceOnUse" width="34">
            <circle cx="4" cy="7" fill={palette.chalk} opacity="0.035" r="0.8" />
            <circle cx="27" cy="19" fill={palette.chalk} opacity="0.025" r="0.6" />
          </pattern>
          <ArrowHead color={palette.primaryRoute} id={primaryMarker} />
          <ArrowHead color={palette.secondaryRoute} id={secondaryMarker} />
          <ArrowHead color={palette.chalk} id={chalkMarker} />
        </defs>
        <rect fill="url(#chalk-dust)" height="300" width="500" />
        {[52, 112, 172, 232].map((y) => (
          <path
            key={y}
            d={`M15 ${y} H485`}
            stroke={palette.chalk}
            strokeDasharray="2 13"
            strokeLinecap="round"
            strokeWidth="1"
            opacity="0.23"
          />
        ))}
        {[85, 415].map((x) => (
          <g key={x} opacity="0.26">
            {[28, 70, 112, 154, 196, 238, 280].map((y) => (
              <path
                key={y}
                d={`M${x - 5} ${y} H${x + 5}`}
                stroke={palette.chalk}
                strokeWidth="1.4"
              />
            ))}
          </g>
        ))}
        <path
          d="M30 180 H470"
          stroke={palette.chalk}
          strokeDasharray="8 6"
          strokeWidth="2"
          opacity="0.44"
        />
        <text
          fill={palette.chalk}
          fontFamily="Arial, sans-serif"
          fontSize="10"
          fontWeight="900"
          opacity="0.4"
          x="25"
          y="176"
        >
          20
        </text>
        <text
          fill={palette.chalk}
          fontFamily="Arial, sans-serif"
          fontSize="10"
          fontWeight="900"
          opacity="0.4"
          x="458"
          y="176"
        >
          20
        </text>
        <g fill="none" filter="url(#chalk-roughness)" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={play.support}
            markerEnd={`url(#${chalkMarker})`}
            stroke={palette.chalk}
            strokeDasharray="3 2"
            strokeWidth="3"
            opacity="0.76"
          />
          <path
            d={play.alternate}
            markerEnd={`url(#${secondaryMarker})`}
            stroke={palette.secondaryRoute}
            strokeWidth="3.5"
            opacity="0.9"
          />
          <path
            d={play.motion}
            markerEnd={`url(#${chalkMarker})`}
            stroke={palette.chalk}
            strokeDasharray="5 5"
            strokeWidth="2.5"
            opacity="0.58"
          />
          <path
            d={play.featured}
            markerEnd={`url(#${primaryMarker})`}
            stroke={palette.primaryRoute}
            strokeWidth="5"
          />
        </g>
        <g
          fill="none"
          stroke={palette.chalk}
          strokeLinecap="round"
          strokeWidth="2.5"
          opacity="0.92"
        >
          {[95, 155, 215, 275, 335, 395].map((x) => (
            <circle key={`o-${x}`} cx={x} cy="180" r="8" />
          ))}
          {[125, 195, 265, 335, 405].map((x, index) => (
            <path
              key={`x-${x}`}
              d={`M${x - 7} ${117 + (index % 2) * 12} l14 14 M${x + 7} ${117 + (index % 2) * 12} l-14 14`}
            />
          ))}
        </g>
        <text
          fill={palette.chalk}
          fontFamily="Comic Sans MS, Bradley Hand, cursive"
          fontSize="12"
          fontWeight="700"
          opacity="0.72"
          transform="rotate(-4 30 32)"
          x="30"
          y="32"
        >
          1ST &amp; 10
        </text>
        <text
          fill={palette.chalk}
          fontFamily="Comic Sans MS, Bradley Hand, cursive"
          fontSize="10"
          opacity="0.45"
          x="213"
          y="207"
        >
          MIKE
        </text>
      </svg>
      <div className="absolute bottom-3 left-4 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/35 sm:left-8">
        D&amp;D concept · {play.name}
      </div>
      {nextGame ? (
        <div className="absolute right-3 top-3 border-l-2 border-[var(--hero-secondary)] bg-black/25 px-4 py-3 text-right backdrop-blur-[2px] sm:right-8 sm:top-6">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
            Next game
          </p>
          <p className="mt-1 text-xl font-black text-[var(--hero-chalk)]">
            VS {nextGame.opponentAbbr}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
            {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(nextGame.startsAt))}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function PlaybookHero({ team, frontOfficeHref, nextGame }: PlaybookHeroProps) {
  const teamAbbr = team?.abbr ?? 'NFL';
  const teamName = team?.name ?? 'NFL';
  const { city, nickname } = splitTeamName(teamName);
  const dayKey = useMemo(() => getPlaybookDayKey(), []);
  const palette = getHeroPalette(team?.abbr);
  const style = {
    '--hero-background': palette.background,
    '--hero-chalk': palette.chalk,
    '--hero-primary': palette.primaryRoute,
    '--hero-secondary': palette.secondaryRoute,
    '--hero-cta-text': palette.ctaText,
  } as React.CSSProperties;

  return (
    <section
      className="relative isolate overflow-hidden bg-[var(--hero-background)] text-[var(--hero-chalk)]"
      style={style}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 20%, rgba(255,255,255,.055), transparent 22%), radial-gradient(circle at 78% 64%, rgba(255,255,255,.03), transparent 30%), linear-gradient(103deg, transparent 0 47%, rgba(255,255,255,.018) 48%, transparent 49%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--hero-primary)]" />
      <div className="relative mx-auto grid max-w-[1440px] lg:min-h-[520px] lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,.85fr)] lg:items-center">
        <div className="relative z-10 px-5 pb-3 pt-9 sm:px-8 sm:pb-6 sm:pt-12 lg:px-12 lg:py-16 xl:pl-16">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
              {team ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-8 w-8 object-contain" src={team.logo_url} />
              ) : (
                <Shield className="h-6 w-6 text-[var(--hero-primary)]" />
              )}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--hero-primary)]">
                Team briefing
              </p>
              <p className="mt-1 text-xs font-semibold text-white/45">
                {formatBriefingDate(dayKey)} · {teamAbbr}
              </p>
            </div>
          </div>
          <h1 className="mt-7 max-w-[780px] text-[clamp(2.9rem,7vw,6.6rem)] font-black uppercase leading-[0.84] tracking-[-0.055em] text-[var(--hero-chalk)]">
            {team ? (
              <>
                Everything <span className="text-[var(--hero-primary)]">{city}</span>
                <br />
                {nickname}, all in one place.
              </>
            ) : (
              <>Everything NFL, all in one place.</>
            )}
          </h1>
          <div className="mt-5 h-1 w-24 rounded-full bg-[var(--hero-primary)]" />
          <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/62 sm:text-lg">
            The stories, videos, roster moves, and fan conversations that matter—ranked and
            explained for you.
          </p>
          <Link
            className="group mt-7 inline-flex min-h-13 items-center gap-5 rounded-full bg-[var(--hero-primary)] px-6 py-3.5 text-sm font-black uppercase tracking-[0.08em] text-[var(--hero-cta-text)] transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-white/20"
            href={frontOfficeHref}
          >
            Open Front Office{' '}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="relative -mt-5 overflow-hidden px-2 pb-5 sm:-mt-10 sm:px-8 sm:pb-8 lg:-ml-16 lg:mt-0 lg:px-0 lg:pb-0 lg:pr-8">
          <PlayDiagram dayKey={dayKey} nextGame={nextGame} teamAbbr={teamAbbr} />
        </div>
      </div>
    </section>
  );
}
