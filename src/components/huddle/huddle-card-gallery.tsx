'use client';

import { useMemo, useState, type ReactNode } from 'react';

import HuddleStoryCard from '@/components/huddle/huddle-story-card';
import TeamThemeProvider from '@/components/team-theme-provider';
import { HUDDLE_CARD_GALLERY_FIXTURES } from '@/features/content/huddle-card-gallery-fixtures';
import { useTeamStore } from '@/features/team/team-store';

type CardSize = 'lead' | 'standard' | 'all';
type GalleryBackground = 'huddle' | 'dark';

export default function HuddleCardGallery() {
  const teams = useTeamStore((state) => state.teams);
  const [teamAbbr, setTeamAbbr] = useState('KC');
  const [cardSize, setCardSize] = useState<CardSize>('all');
  const [background, setBackground] = useState<GalleryBackground>('huddle');
  const team = useMemo(() => teams.find((item) => item.abbr === teamAbbr), [teamAbbr, teams]);
  const sizes: Array<{ key: 'lead' | 'standard'; lead: boolean }> =
    cardSize === 'all'
      ? [
          { key: 'lead', lead: true },
          { key: 'standard', lead: false },
        ]
      : [{ key: cardSize, lead: cardSize === 'lead' }];

  return (
    <TeamThemeProvider team={team}>
      <main
        className={`min-h-screen px-4 py-8 text-[#00172B] sm:px-6 lg:px-8 ${background === 'huddle' ? 'bg-[#f7f4ee]' : 'bg-[#252725]'}`}
      >
        <div className="mx-auto max-w-[1500px]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--team-primary-text)]">
            Development only · Fixture content
          </p>
          <h1 className={`mt-2 text-4xl font-black ${background === 'dark' ? 'text-white' : ''}`}>
            Beat Card Gallery
          </h1>
          <p
            className={`mt-3 max-w-3xl text-sm leading-6 ${background === 'dark' ? 'text-white/60' : 'text-[#40556b]'}`}
          >
            This page exercises the production Beat story card across team palettes. Nothing shown
            here is saved to the database or returned by the Story Engine.
          </p>
          <div
            className={`mt-7 grid gap-4 rounded-2xl border p-5 md:grid-cols-3 ${background === 'dark' ? 'border-white/15 bg-black/20 text-white' : 'border-[#00172B]/10 bg-white/65'}`}
          >
            <Control label="Team">
              <select
                className="mt-2 h-11 w-full rounded-xl border border-current/15 bg-white px-3 font-bold text-[#00172B]"
                onChange={(event) => setTeamAbbr(event.target.value)}
                value={teamAbbr}
              >
                {teams.map((item) => (
                  <option key={item.abbr} value={item.abbr}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Control>
            <Control label="Card size">
              <select
                className="mt-2 h-11 w-full rounded-xl border border-current/15 bg-white px-3 font-bold text-[#00172B]"
                onChange={(event) => setCardSize(event.target.value as CardSize)}
                value={cardSize}
              >
                <option value="lead">Lead</option>
                <option value="standard">Standard</option>
                <option value="all">Show All</option>
              </select>
            </Control>
            <Control label="Background">
              <select
                className="mt-2 h-11 w-full rounded-xl border border-current/15 bg-white px-3 font-bold text-[#00172B]"
                onChange={(event) => setBackground(event.target.value as GalleryBackground)}
                value={background}
              >
                <option value="huddle">Actual Huddle</option>
                <option value="dark">Dark QA</option>
              </select>
            </Control>
          </div>
          <div className="mt-10 space-y-14">
            {HUDDLE_CARD_GALLERY_FIXTURES.map((fixture) => (
              <section key={fixture.id}>
                <h2
                  className={`text-sm font-black uppercase tracking-[0.18em] ${background === 'dark' ? 'text-white' : ''}`}
                >
                  {fixture.family}
                </h2>
                <div className="mt-4 grid items-start gap-6 xl:grid-cols-2">
                  {sizes.map(({ key, lead }) => (
                    <div key={key}>
                      <p
                        className={`mb-2 text-xs font-black uppercase tracking-[0.14em] ${background === 'dark' ? 'text-white/50' : 'text-[#7890a8]'}`}
                      >
                        {lead ? 'Lead Beat Story' : 'Standard Beat Story'} · Default variant
                      </p>
                      <div className={lead ? 'max-w-4xl' : 'max-w-md'}>
                        <HuddleStoryCard
                          id={`${fixture.id}-${key}`}
                          teamId={teamAbbr}
                          headline={fixture.headline}
                          summary={fixture.summary}
                          category={fixture.family}
                          status={fixture.visual.status}
                          sourceCount={fixture.sourceCount}
                          updatedAt="2026-09-01T14:14:00.000Z"
                          materialUpdateCount={fixture.materialUpdateCount}
                          lead={lead}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </TeamThemeProvider>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-[0.18em]">
      {label}
      {children}
    </label>
  );
}
