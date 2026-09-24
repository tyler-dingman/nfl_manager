import type { CSSProperties } from 'react';
/* School marks come from the existing prospect feed's multiple approved providers. */
/* eslint-disable @next/next/no-img-element */
import styles from './front-office-story-graphic.module.css';
import {
  comparableRankDirection,
  normalizeStoryTemplate,
  type FrontOfficeStoryGraphicModel,
  type StoryGraphicSize,
} from './story-graphic-model';

const HEX = /^#[0-9a-f]{6}$/i;
type GraphicStyle = CSSProperties & Record<`--${string}`, string>;

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
      <div className={styles.copy}>
        <div className={styles.eyebrow}>
          {story.primaryIdentity?.logoUrl ? (
            <img src={story.primaryIdentity.logoUrl} alt="" width="30" height="30" />
          ) : null}
          <span>{story.eyebrow ?? 'Front Office'}</span>
        </div>
        {rank ? (
          <div className={styles.rank}>
            <div className={styles.movement}>
              <span aria-hidden="true">
                {rank.direction === 'up' ? '↑' : rank.direction === 'down' ? '↓' : '−'}
              </span>
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
