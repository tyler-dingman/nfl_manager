'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { gameDayHeroAsset } from '@/config/game-day-hero';
import type { HomepageGame } from '@/features/game-day/homepage-game';
import type { Team } from '@/features/team/team-store';

const timeLabel = (game: HomepageGame) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: game.timeZone,
  }).format(new Date(game.startsAt));

const actionLabel = (state: HomepageGame['state']) =>
  state === 'LIVE' ? 'ENTER LIVE GAME DAY' : state === 'FINAL' ? 'VIEW GAME DAY' : 'ENTER GAME DAY';

const teamNickname = (team: Team) => team.name.trim().split(/\s+/).at(-1) ?? team.name;

export default function GameDayHomepageHero({
  team,
  game,
  frontOfficeHref,
}: {
  team: Team;
  game?: HomepageGame | null;
  frontOfficeHref: string;
}) {
  const asset = gameDayHeroAsset(team.abbr);
  const isGameDay = Boolean(game);

  return (
    <section className="relative isolate min-h-[570px] overflow-hidden bg-[#070a0d] text-[#fff8ed] sm:min-h-[620px] lg:min-h-[650px]">
      {asset ? (
        <Image
          src={asset}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] sm:object-center"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,10,.96)_0%,rgba(3,7,10,.88)_25%,rgba(3,7,10,.48)_53%,rgba(3,7,10,.08)_78%,rgba(3,7,10,.12)_100%)] max-sm:bg-[linear-gradient(90deg,rgba(3,7,10,.93)_0%,rgba(3,7,10,.72)_66%,rgba(3,7,10,.25)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent"
      />

      <div className="relative mx-auto flex min-h-[570px] max-w-[1440px] items-center px-5 py-10 sm:min-h-[620px] sm:px-8 lg:min-h-[650px] lg:px-12 xl:px-16">
        <div className="w-full max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/75 sm:text-xs">
              {team.name}
              {isGameDay ? (
                <>
                  {' '}
                  <span className="px-1 text-[var(--secondary)]">•</span> GAMEDAY
                </>
              ) : null}
            </p>
            {game?.devOverride ? (
              <span className="rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/65">
                Dev preview
              </span>
            ) : null}
          </div>

          <h1 className="mt-7 text-[clamp(4rem,10vw,8.5rem)] font-black uppercase leading-[0.78] tracking-[-0.065em]">
            {isGameDay ? (
              <>
                IT&apos;S
                <span className="block text-[var(--secondary)]">GAMEDAY.</span>
              </>
            ) : (
              <>
                YOUR ALL-IN-ONE
                <span className="block text-[var(--secondary)]">{teamNickname(team)} HUB.</span>
              </>
            )}
          </h1>

          <div className="mt-8 border-l-4 border-[var(--secondary)] pl-4 sm:pl-5">
            {game ? (
              <>
                <p className="text-xl font-black uppercase tracking-tight sm:text-3xl">
                  {game.teamName} <span className="text-white/50">vs</span> {game.opponentName}
                </p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.15em] text-white/72 sm:text-sm">
                  {timeLabel(game)}
                </p>
              </>
            ) : (
              <p className="max-w-xl text-base font-semibold leading-7 text-white/75 sm:text-lg">
                The stories, videos, roster moves, and fan conversations that matter—ranked and
                explained for you.
              </p>
            )}
          </div>

          <Link
            href={game ? `/game-day?team=${team.abbr}&game=${game.id}` : frontOfficeHref}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[var(--secondary)] px-7 text-sm font-black uppercase tracking-[0.08em] text-[var(--team-on-secondary)] shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
          >
            {game ? actionLabel(game.state) : 'OPEN FRONT OFFICE'}{' '}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
