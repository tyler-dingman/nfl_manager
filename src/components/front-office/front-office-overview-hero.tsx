'use client';

import Image from 'next/image';

export function FrontOfficeOverviewHero() {
  return (
    <section className="fo-overview-hero">
      <Image
        src="/images/fo_hero.png"
        fill
        priority
        sizes="(min-width: 768px) 75vw, 100vw"
        alt=""
      />
      <div aria-hidden="true" className="fo-overview-shade" />
      <div className="fo-overview-copy">
        <p className="fo-title-eyebrow text-[var(--team-secondary-on-dark)]">
          Your team. Your moves.
        </p>
        <h1 className="dd-home-hero-display">
          Front <em>Office</em>
        </h1>
        <div aria-hidden="true" />
        <p className="fo-overview-description">
          Manage your roster, explore trades, sign talent, and build for the future. All in one
          place.
        </p>
      </div>
    </section>
  );
}
