'use client';

import type { CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { getEditorialHeroTheme, getTeamDisplayAccent } from '@/lib/team-theme-tokens';
import beatStyles from '@/components/beat/beat-hero.module.css';
import ThreeOutDeliveryPreferences from './three-out-delivery-preferences';

export function HomeThreeAndOut({
  teamAbbr,
  stories,
  onOpen,
}: {
  teamAbbr: string;
  stories: { id: string; title: string }[];
  onOpen: (id: string) => void;
}) {
  const { heroBrightAccent } = getEditorialHeroTheme(teamAbbr);
  return (
    <section
      id="three-and-out"
      aria-label="Three & Out"
      className={`${beatStyles.hero} rounded-2xl border border-[#65819855] p-5`}
      style={
        {
          '--hero-beat-detail': heroBrightAccent,
          '--hero-beat-accent': getTeamDisplayAccent(teamAbbr),
          '--team-secondary-on-dark': heroBrightAccent,
        } as CSSProperties
      }
    >
      <h3 className={`dd-three-out-display ${beatStyles.threeTitle}`}>
        THREE <span className="dd-three-out-ampersand">&amp;</span> OUT
      </h3>
      <p className={beatStyles.subtitle}>THE 3 THINGS YOU NEED TO KNOW</p>
      <ol className={beatStyles.stories}>
        {stories.slice(0, 3).map((story, index) => (
          <li key={story.id}>
            <button type="button" className="w-full text-left" onClick={() => onOpen(story.id)}>
              <span className={beatStyles.number}>{String(index + 1).padStart(2, '0')}</span>
              <span className={beatStyles.storyTitle}>{story.title}</span>
              <ChevronRight className={beatStyles.rowChevron} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {!stories.length && (
        <p className={beatStyles.empty}>
          Current developments will appear here as reporting becomes available.
        </p>
      )}
      <div className="mt-4">
        <ThreeOutDeliveryPreferences appearance="dark" />
      </div>
    </section>
  );
}
