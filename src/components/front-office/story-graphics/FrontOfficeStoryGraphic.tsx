import type { CSSProperties } from 'react';
import { StoryArtwork, type StoryArtworkId } from './StoryArtwork';
/* School marks come from the existing prospect feed's multiple approved providers. */
/* eslint-disable @next/next/no-img-element */
import styles from './front-office-story-graphic.module.css';
import {
  comparableRankDirection,
  normalizeStoryTemplate,
  STORY_TEMPLATE_ASSETS,
  type FrontOfficeStoryGraphicModel,
  type StoryGraphicSize,
} from './story-graphic-model';

const HEX = /^#[0-9a-f]{6}$/i;
type GraphicStyle = CSSProperties & Record<`--${string}`, string>;

function StoryAsset({ id, className = '' }: { id: StoryArtworkId; className?: string }) {
  return <StoryArtwork id={id} className={`${styles.asset} ${className}`} />;
}

export function FrontOfficeStoryGraphic({
  story,
  size = 'card',
  className,
  identityLine,
  actionLabel,
}: {
  story: FrontOfficeStoryGraphicModel;
  size?: StoryGraphicSize;
  className?: string;
  identityLine?: string;
  actionLabel?: string;
}) {
  const template = normalizeStoryTemplate(story.template);
  const assets = STORY_TEMPLATE_ASSETS[template];
  const isMovement = template === 'rising-prospect' || template === 'falling-prospect';
  const rank = comparableRankDirection(story.previousRank, story.currentRank);
  const primary = HEX.test(story.primaryIdentity?.primary ?? '')
    ? story.primaryIdentity?.primary
    : '#b8c1cc';
  const secondary = HEX.test(story.primaryIdentity?.secondary ?? '')
    ? story.primaryIdentity?.secondary
    : '#f4f6f8';
  const rootStyle = {
    '--school-primary': primary,
    '--school-secondary': secondary,
    '--fo-bg': '#0b0d10',
    '--fo-surface': '#171b21',
    '--fo-text': '#f4f6f8',
    '--fo-muted': '#b8c1cc',
  } as GraphicStyle;

  return (
    <article
      className={`${styles.root} ${styles[size]} ${styles[template]} ${className ?? ''}`}
      style={rootStyle}
      data-template={template}
      data-breaking={story.status === 'BREAKING' || undefined}
    >
      <StoryAsset id="etched-texture" className={styles.grain} />
      <StoryAsset id="playbook-pattern" className={styles.playbook} />
      <StoryAsset id="diagonal-slashes" className={styles.ribbon} />
      <div className={styles.copy}>
        <div className={styles.eyebrow}>
          {story.primaryIdentity?.logoUrl && (!isMovement || size === 'compact') ? (
            <img src={story.primaryIdentity.logoUrl} alt="" width="30" height="30" />
          ) : null}
          <span>{story.eyebrow ?? 'Front Office'}</span>
        </div>
        {rank ? (
          <div className={styles.rank}>
            <div className={styles.movement}>
              <StoryAsset
                id={
                  rank.direction === 'up'
                    ? 'arrow-up'
                    : rank.direction === 'down'
                      ? 'arrow-down'
                      : 'minus'
                }
              />
              <strong>
                {rank.movement > 0 ? '+' : rank.movement < 0 ? '−' : ''}
                {Math.abs(rank.movement)}
              </strong>
            </div>
            <span className={styles.rankLabel}>
              {rank.direction === 'steady' ? 'Holding steady' : 'Rank movement'}
            </span>
            <div className={styles.rankPair}>
              <div>
                <strong>#{story.previousRank}</strong>
                <span>Prev rank</span>
              </div>
              <span aria-hidden="true">›</span>
              <div>
                <strong>#{story.currentRank}</strong>
                <span>Current rank</span>
              </div>
            </div>
          </div>
        ) : null}
        <h3>{story.headline}</h3>
        {identityLine || story.primaryIdentity?.displayName ? (
          <div className={styles.identityLine}>
            {identityLine ?? story.primaryIdentity?.displayName}
          </div>
        ) : null}
        {story.summary && (!isMovement || size === 'article') ? <p>{story.summary}</p> : null}
        {story.metrics?.length ? (
          <dl className={styles.metrics}>
            {story.metrics.slice(0, 3).map((metric) => (
              <div key={`${metric.label}-${metric.value}`}>
                <dt>{metric.label}</dt>
                <dd>
                  {metric.value}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actionLabel ? (
          <span className={styles.storyAction}>
            {actionLabel}
            <span aria-hidden="true">→</span>
          </span>
        ) : null}
        <footer>{[story.source, story.dateLabel].filter(Boolean).join(' · ')}</footer>
      </div>
      <div className={styles.art} aria-hidden="true">
        {template === 'rising-prospect' || template === 'falling-prospect' ? (
          <>
            {story.primaryIdentity?.logoUrl ? (
              <img
                className={styles.heroIdentity}
                src={story.primaryIdentity.logoUrl}
                alt=""
                width="160"
                height="120"
              />
            ) : (
              <span className={styles.identityText}>
                {story.primaryIdentity?.displayName ?? 'D&D'}
              </span>
            )}
            <StoryAsset
              id={template === 'rising-prospect' ? 'bars-ascending' : 'bars-descending'}
              className={styles.bars}
            />
          </>
        ) : (
          <>
            {story.primaryIdentity?.logoUrl ? (
              <img
                className={styles.storyIdentityLogo}
                src={story.primaryIdentity.logoUrl}
                alt=""
                width="120"
                height="90"
              />
            ) : null}
            <StoryAsset id={assets[0]} className={styles.primaryArtwork} />
          </>
        )}
      </div>
      {story.secondaryIdentity ? (
        <div className={styles.secondaryIdentity}>
          {story.secondaryIdentity.logoUrl ? (
            <img src={story.secondaryIdentity.logoUrl} alt="" width="28" height="28" />
          ) : null}
          <span>{story.secondaryIdentity.displayName}</span>
        </div>
      ) : null}
    </article>
  );
}

export const DraftNewsGraphic = FrontOfficeStoryGraphic;
