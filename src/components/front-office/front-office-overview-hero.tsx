'use client';

import Image from 'next/image';

import { gameDayHeroAsset } from '@/config/game-day-hero';
import { useTeamStore } from '@/features/team/team-store';

export function FrontOfficeOverviewHero() {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const team = teams.find((entry) => entry.id === selectedTeamId) ?? teams[0];
  const asset = team ? gameDayHeroAsset(team.abbr) : null;

  return (
    <section className="fo-overview-hero">
      {asset ? (
        <Image src={asset} fill priority sizes="(min-width: 768px) 75vw, 100vw" alt="" />
      ) : null}
      <div aria-hidden="true" className="fo-overview-shade" />
      <div className="fo-overview-copy">
        <p>
          Down <span>&amp;</span> Distance
        </p>
        <h1 className="dd-display-title">
          Front <em>Office</em>
        </h1>
        <h2>
          Your team. Your moves.
          <br />A bigger tomorrow.
        </h2>
        <div aria-hidden="true" />
        <p className="fo-overview-description">
          Manage your roster, explore trades, sign talent, and build for the future. All in one
          place.
        </p>
        <small>Champions are built, not bought.</small>
      </div>
    </section>
  );
}
