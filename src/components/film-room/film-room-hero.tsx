import { Play, ChevronRight } from 'lucide-react';
import { EditorialSectionHero } from '@/components/beat/editorial-section-hero';
import styles from '@/components/beat/beat-hero.module.css';
import type { FilmRoomVideo } from '@/features/film-room/types';

export function FilmRoomHero({
  teamAbbr,
  videos,
  onPlay,
  loading,
}: {
  teamAbbr: string;
  videos: FilmRoomVideo[];
  loading: boolean;
  onPlay: (video: FilmRoomVideo, trigger: HTMLButtonElement) => void;
}) {
  const featured = [...videos]
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.publishedAt ?? b.addedAt) - Date.parse(a.publishedAt ?? a.addedAt),
    )
    .slice(0, 3);
  return (
    <EditorialSectionHero
      teamAbbr={teamAbbr}
      firstWord="FILM"
      accentWord="ROOM"
      variant="film-room"
      taglineLabel="Get into the Film Room and put on the tape."
      tagline="GET INTO THE FILM ROOM AND PUT ON THE TAPE."
    >
      <h2 className={`dd-three-out-display ${styles.threeTitle}`}>
        ROLL <span className="dd-three-out-ampersand">THE</span> TAPE
      </h2>
      <p className={styles.subtitle}>THE 3 THINGS YOU NEED TO KNOW</p>
      <ol className={`${styles.stories} ${styles.videoStories}`}>
        {featured.map((video, index) => (
          <li key={video.id}>
            <button
              type="button"
              onClick={(event) => onPlay(video, event.currentTarget)}
              aria-label={`Play ${video.title}`}
            >
              <span className={styles.videoControls}>
                <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.playCircle}>
                  <Play size={14} fill="currentColor" aria-hidden="true" />
                </span>
              </span>
              <span className={styles.storyTitle}>{video.title}</span>
              <ChevronRight className={styles.rowChevron} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {featured.length ? (
        <p className={styles.meta}>
          {featured.length} {featured.length === 1 ? 'VIDEO' : 'VIDEOS'} · TRENDING NOW
        </p>
      ) : (
        <p className={styles.empty}>
          {loading
            ? 'Loading current videos…'
            : 'Current team videos will appear here when available.'}
        </p>
      )}
    </EditorialSectionHero>
  );
}
