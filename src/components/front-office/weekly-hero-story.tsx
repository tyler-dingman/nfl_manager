'use client';
import { heroStoryLabel } from '../../../packages/front-office/hero-story';
import { apiFetch } from '@/lib/api';
import {
  heroBackgroundPosition,
  heroBackgroundScale,
  heroGraphic,
} from '../../../packages/front-office/hero-assets';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';
import type { HeroStory } from '../../../packages/front-office/hero-story';
import { gameDayHeroAsset } from '@/config/game-day-hero';
import { getTeamThemeTokens } from '@/lib/team-theme-tokens';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import PlayerDetailsModal from '@/components/player-details-modal';
import { FrontOfficeFeatureHeading } from './front-office-feature-heading';
import styles from './front-office-home.module.css';
export function WeeklyHeroStory({ story, team }: { story: HeroStory; team: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const save = useSaveStore();
  const teams = useTeamStore((s) => s.teams);
  const stadium = story.visualType === 'stadium' || failed === story.image;
  const graphic = failed === story.image ? undefined : heroGraphic(story.visualType);
  const image = failed === story.image ? gameDayHeroAsset(team) : story.image;
  const environment = stadium || Boolean(graphic);
  const focal = heroBackgroundPosition(stadium ? 'stadium' : story.visualType, team);
  const theme = getTeamThemeTokens(team);
  const opensPlayer = Boolean(
    story.subjectPlayer &&
    (story.cta !== 'VIEW FREE AGENT' || !story.phase) &&
    ['VIEW PLAYER', 'VIEW FREE AGENT', 'VIEW YOUR NEWEST PLAYER'].includes(story.cta),
  );
  const acknowledge = () => {
    if (!story.postActionId) return;
    void apiFetch('/api/front-office/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: save.saveId,
        action: 'acknowledge-hero',
        heroActionId: story.postActionId,
      }),
    })
      .then(() => window.dispatchEvent(new Event('front-office-simulation-advanced')))
      .catch(() => {});
  };
  return (
    <>
      <section
        className={`${styles.hero} ${styles.editorialHero} ${!environment ? styles.personHero : ''}`}
        aria-label="Franchise cover story"
        style={
          {
            '--fo-accent': theme.primary,
            '--fo-interactive': theme.primaryFill,
            '--fo-interactive-fg': theme.onPrimary,
          } as React.CSSProperties
        }
      >
        {environment && image && (
          <Image
            className={styles.environmentPhoto}
            src={image}
            alt=""
            fill
            unoptimized
            style={
              {
                '--hero-position': focal.desktopPosition,
                '--hero-background-scale': heroBackgroundScale(
                  stadium ? 'stadium' : story.visualType,
                ),
                '--hero-mobile-position': focal.mobilePosition,
              } as React.CSSProperties
            }
            onError={() => setFailed(story.image)}
          />
        )}
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <CalendarDays size={14} />
            <span>{heroStoryLabel(story)}</span>
          </p>
          <FrontOfficeFeatureHeading>{story.headline}</FrontOfficeFeatureHeading>
          {story.simulatedDialogue && (
            <small className={styles.quoteDisclosure}>SIMULATED COACH QUOTE</small>
          )}
          <p className={styles.heroSummary}>{story.body}</p>
          {opensPlayer ? (
            <button
              className={styles.cta}
              onClick={() => {
                setDetails(true);
              }}
            >
              {story.cta}
              <ArrowRight size={16} />
            </button>
          ) : (
            <Link className={styles.cta} href={story.href} onClick={acknowledge}>
              {story.cta}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
        {!environment && image && (
          <div className={styles.heroVisual}>
            <Image
              className={styles.personPhoto}
              src={image}
              alt={story.subjectName ?? ''}
              width={440}
              height={360}
              unoptimized
              onError={() => setFailed(story.image)}
            />
            {story.subjectName && (
              <div className={styles.personCaption}>
                <span className={styles.storySubject}>{story.subjectName}</span>
                <span>{story.subjectDetail}</span>
              </div>
            )}
          </div>
        )}
      </section>
      {details && story.subjectPlayer && (
        <PlayerDetailsModal
          isOpen
          source={{
            kind: story.visualType === 'free-agent' ? 'freeAgent' : 'roster',
            player: story.subjectPlayer,
          }}
          roster={save.roster}
          teams={teams}
          userTeamAbbr={team}
          capSpace={save.capSpace}
          capLimit={save.capLimit}
          onClose={() => {
            setDetails(false);
            acknowledge();
          }}
        />
      )}
    </>
  );
}
