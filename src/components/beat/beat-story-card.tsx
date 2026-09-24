'use client';

import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { DdSaveIcon as Bookmark } from '@/components/ui/football-icons';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';
import type { HuddleStoryCardProps } from '@/components/huddle/huddle-story-card';
import { BeatGraphic } from './beat-graphic';
import { beatPalette, validBeatGraphic, standardVariant } from './beat-model';
import { adaptBeatStory } from './beat-story-adapter';
import styles from './beat-card.module.css';

export function BeatStoryCard({
  id,
  teamId,
  headline,
  summary,
  category,
  sourceCount,
  updatedAt,
  materialUpdateCount,
  hotReadUntil,
  firstReportedBy,
  sources = [],
  saved,
  onSave,
  onOpen,
  graphic,
  graphicDecision,
  lead,
}: HuddleStoryCardProps) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const timestamp = new Date(updatedAt).getTime();
  const minutes =
    now !== null && Number.isFinite(timestamp)
      ? Math.max(0, Math.floor((now - timestamp) / 60000))
      : null;
  const age =
    minutes === null
      ? null
      : minutes < 1
        ? 'now'
        : minutes < 60
          ? `${minutes}m`
          : minutes < 1440
            ? `${Math.floor(minutes / 60)}h`
            : `${Math.floor(minutes / 1440)}d`;
  const hot = now !== null && !!hotReadUntil && new Date(hotReadUntil).getTime() > now;
  const palette = beatPalette(teamId);
  const decision =
    graphicDecision ??
    adaptBeatStory({
      id,
      teamAbbr: teamId,
      headline,
      summary,
      category,
      graphic,
      updatedAt,
      sources,
    });
  const data = validBeatGraphic(decision.graphic)
    ? decision.graphic
    : { family: standardVariant(id) };
  const href = `/content/${encodeURIComponent(id)}`;
  return (
    <article
      data-story-id={id}
      data-beat-reason={decision.reason}
      data-beat-fallback={decision.fallbackReason}
      data-beat-card
      data-lead={lead || undefined}
      className={styles.card}
      style={
        { '--beat-accent': palette.accent, '--beat-on-accent': palette.onAccent } as CSSProperties
      }
    >
      <BeatGraphic
        data={data}
        selectedTeam={teamId}
        category={decision.displayCategory}
        age={age}
      />
      <div className={styles.body}>
        <Link
          href={href}
          onClick={onOpen}
          className={styles.storyLink}
          aria-label={`Open story: ${headline}`}
        >
          <h3 className={styles.headline}>{headline}</h3>
          <p className={styles.summary}>{summary}</p>
        </Link>
        {hot ? (
          <p className={styles.hot}>
            <Flame aria-hidden="true" /> Hot Read
            {firstReportedBy ? ` · First reported by ${firstReportedBy}` : ''}
          </p>
        ) : firstReportedBy ? (
          <span className="sr-only">First reported by {firstReportedBy}</span>
        ) : null}
        <footer className={styles.footer}>
          <div className={styles.metadata}>
            {sources.length ? (
              <details className={styles.sources}>
                <summary
                  aria-label={`View ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`}
                >
                  {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
                </summary>
                <div>
                  {sources.map((source) => (
                    <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                      {firstReportedBy === source.publisher ? 'First reported by · ' : ''}
                      {source.publisher}
                      <ArrowRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </details>
            ) : (
              <span>
                {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
              </span>
            )}
            {materialUpdateCount ? <span> · {materialUpdateCount} updates</span> : null}
            {age ? (
              <time dateTime={updatedAt}>
                {' '}
                · Updated {age}
                {age === 'now' ? '' : ' ago'}
              </time>
            ) : (
              <time dateTime={Number.isFinite(timestamp) ? updatedAt : undefined}>
                {Number.isFinite(timestamp) ? ` · ${updatedAt.slice(0, 10)}` : ''}
              </time>
            )}
          </div>
          <div className={styles.actions}>
            {onSave ? (
              <button
                type="button"
                className={styles.control}
                onClick={onSave}
                aria-pressed={!!saved}
                aria-label={saved ? `Remove ${headline} from saved stories` : `Save ${headline}`}
              >
                <Bookmark aria-hidden="true" className={saved ? styles.saved : ''} />
                {saved ? 'Saved' : 'Save'}
              </button>
            ) : null}
            <ShareToCrewButton
              contentId={id}
              contentType="BEAT_STORY"
              href={href}
              title={headline}
              className={styles.control}
            />
            <Link
              href={href}
              onClick={onOpen}
              className={`${styles.control} ${styles.arrow}`}
              tabIndex={-1}
              aria-hidden="true"
            >
              <ArrowRight />
            </Link>
          </div>
        </footer>
      </div>
    </article>
  );
}
