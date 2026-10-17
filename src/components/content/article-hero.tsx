'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { BeatGraphic } from '@/components/beat/beat-graphic';
import { beatAssets } from '@/components/beat/beat-assets';
import { beatPalette } from '@/components/beat/beat-model';
import { TEAM_LIST } from '@/data/teams';
import { normalizeDisplayHeadline } from '@/lib/display-headline';
import {
  articleAge,
  articleDate,
  articleHeroDesign,
  articlePublishedAt,
  beatLayerOpacity,
  resolveBeatArtwork,
  type ArticleHeroStory,
} from '../../../packages/beat/article-hero';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import styles from './article-hero.module.css';

export function ArticleHero({ story }: { story: ArticleHeroStory }) {
  const decision = resolveBeatArtwork(story);
  const palette = beatPalette(story.teamAbbr);
  const team = TEAM_LIST.find((t) => t.abbr === palette.team);
  const headline = normalizeDisplayHeadline(story.headline);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [story.id, story.updatedAt]);
  const published = articlePublishedAt(story);
  return (
    <header
      className={styles.hero}
      data-article-hero
      data-story-id={story.id}
      style={
        {
          '--beat-accent': palette.accent,
          '--beat-on-accent': palette.onAccent,
          '--article-min-height': `${articleHeroDesign.minHeight}px`,
        } as CSSProperties
      }
    >
      <div className={styles.texture} aria-hidden="true">
        {manifest.sharedLayers.map((id) => {
          const asset = manifest.assets.find((a) => a.id === id)!;
          return (
            <div key={id} style={{ opacity: beatLayerOpacity(id, asset.cssOpacity) }}>
              {beatAssets[id as keyof typeof beatAssets]}
            </div>
          );
        })}
      </div>
      <div className={styles.inner}>
        <div className={styles.artwork} aria-hidden="true">
          <BeatGraphic
            data={decision.graphic}
            selectedTeam={story.teamAbbr}
            category={decision.displayCategory}
            age={null}
            presentation="article"
          />
        </div>
        <div className={styles.topline}>
          <p className={styles.category}>
            <span>{decision.displayCategory.replaceAll('_', ' ')}</span>
            <span className={styles.team}>{team ? team.name : story.teamAbbr}</span>
          </p>
          {story.updatedAt ? (
            <time className={styles.age} dateTime={story.updatedAt}>
              {now === null ? story.updatedAt.slice(0, 10) : articleAge(story.updatedAt, now)}
            </time>
          ) : null}
        </div>
        <div className={styles.copy}>
          <h1
            className={styles.headline}
            data-long={headline.length > 110}
            data-extra-long={headline.length > 180}
          >
            {headline}
          </h1>
          <p className={styles.deck}>{story.summary}</p>
        </div>
        <div className={styles.metadata}>
          {published ? <time dateTime={published}>Published {articleDate(published)}</time> : null}
          {story.updatedAt ? (
            <time dateTime={story.updatedAt}>Updated {articleDate(story.updatedAt)}</time>
          ) : null}
          <span>
            {story.sourceCount} {story.sourceCount === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </div>
    </header>
  );
}
