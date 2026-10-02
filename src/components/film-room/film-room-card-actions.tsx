'use client';
import { ExternalLink } from 'lucide-react';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';
import type { FilmRoomVideo } from '@/features/film-room/types';
import { normalizeDisplayHeadline } from '@/lib/display-headline';
import styles from '../ui/compact-card-actions.module.css';

export function FilmRoomCardActions({
  video,
  mobile = false,
}: {
  video: FilmRoomVideo;
  mobile?: boolean;
}) {
  return (
    <div
      className={`${styles.actions} ${mobile ? styles.mobile : styles.desktop}`}
      aria-label="Video actions"
    >
      <a
        className={styles.action}
        href={video.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink aria-hidden="true" />
        YOUTUBE
      </a>
      <ShareToCrewButton
        contentId={video.id}
        contentType="FILM_ROOM"
        href={`/watch?video=${encodeURIComponent(video.id)}`}
        title={normalizeDisplayHeadline(video.title)}
        className={styles.action}
        label="SHARE"
      />
      <a
        className={styles.action}
        href={video.channelUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink aria-hidden="true" />
        CHANNEL
      </a>
    </div>
  );
}
