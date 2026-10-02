'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  latestVisualization,
  playGeometry,
  type FieldPlayer,
} from '../../../packages/huddle/play-visualization';
import type { Game } from '../../../packages/huddle';
import { fieldArtwork } from '../../../packages/huddle/field-artwork';
import { fieldUI, firstDownPosition } from '../../../packages/huddle/field-position';
import { getFrontOfficeTeamTheme } from '@/lib/team-theme-tokens';
import { TEAM_LIST } from '@/data/teams';
import s from './huddle.module.css';
import {
  FIELD_BASE_ASSET,
  FIELD_WIDTH,
  FIELD_HEIGHT,
  getHuddleEndZoneAsset,
} from '../../../packages/huddle/field-assets';
export function HuddleField({ game }: { game: Game }) {
  const play = latestVisualization(game);
  const playId = game.plays.at(-1)?.id;
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    setProgress(0);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 750);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playId]);
  const position = game.ball ?? 50,
    target = firstDownPosition(game);
  const geometry = play ? playGeometry(play, progress) : null;
  if (game.ball === null) return <p>Field position unavailable.</p>;
  const accent = getFrontOfficeTeamTheme(game.possession ?? game.away).accent;
  const { point, badge, logo } = fieldUI(position, game.direction);
  const layers = [
    FIELD_BASE_ASSET,
    getHuddleEndZoneAsset(game.away, 'left'),
    getHuddleEndZoneAsset(game.home, 'right'),
  ].filter((source): source is string => !!source);
  return (
    <div
      className={s.perspectiveField}
      role="group"
      aria-label={`${game.away} left end zone, ${game.home} right end zone. ${game.possession} ball at ${game.location}. ${game.down}. Moving ${game.direction === 1 ? 'right' : 'left'}.`}
    >
      <div
        className={s.fieldCanvas}
        data-field-position={position}
        style={{ '--field-focus': point.x / FIELD_WIDTH } as CSSProperties}
      >
        {layers.map((src, index) => (
          <img
            key={src}
            className={s.fieldImage}
            data-field-layer={index === 0 ? 'base' : index === 1 ? 'left-endzone' : 'right-endzone'}
            src={src}
            alt=""
            draggable={false}
          />
        ))}
        <div
          className={s.fieldOverlay}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: fieldArtwork(game, accent, position, target, !play) }}
        />
        <img
          className={s.possessionLogo}
          src={TEAM_LIST.find((t) => t.abbr === game.possession)?.logoUrl}
          alt=""
          style={{
            left: `${(logo.x / FIELD_WIDTH) * 100}%`,
            top: `${(logo.y / FIELD_HEIGHT) * 100}%`,
            width: `${(logo.width / FIELD_WIDTH) * 100}%`,
            height: `${(logo.height / FIELD_HEIGHT) * 100}%`,
          }}
        />
        {geometry && (
          <>
            <svg
              className={s.playPath}
              viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
              aria-hidden="true"
            >
              <defs>
                <mask id="play-reveal">
                  <path
                    d={geometry.path}
                    pathLength={1}
                    fill="none"
                    stroke="white"
                    strokeWidth="20"
                    strokeDasharray={1}
                    strokeDashoffset={1 - Math.min(1, progress / 0.65)}
                  />
                </mask>
                <marker
                  id="play-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0 0 L5 3 L0 6" fill="none" stroke="#d8e9e9" strokeWidth="1.3" />
                </marker>
              </defs>
              {geometry.path && (
                <path
                  d={geometry.path}
                  mask="url(#play-reveal)"
                  fill="none"
                  stroke="#d8e9e9"
                  strokeWidth="3"
                  strokeDasharray="9 7"
                  opacity={Math.min(1, progress * 2)}
                  markerEnd="url(#play-arrow)"
                />
              )}
            </svg>
            {geometry.markers.map(({ player, point, reveal }) => (
              <PlayerFieldMarker
                key={`${playId}-${player.id}`}
                player={player}
                x={point.x}
                y={point.y}
                visible={progress >= reveal}
              />
            ))}
            {geometry.indicator && (
              <span
                className={s.playIndicator}
                style={{
                  left: `${(geometry.destination.x / FIELD_WIDTH) * 100}%`,
                  top: `${(geometry.destination.y / FIELD_HEIGHT) * 100}%`,
                }}
              >
                {geometry.indicator}
              </span>
            )}
          </>
        )}
        <span
          className={s.fieldBadge}
          style={{
            left: `${(badge.x / FIELD_WIDTH) * 100}%`,
            top: `${(badge.y / FIELD_HEIGHT) * 100}%`,
            width: `${(badge.width / FIELD_WIDTH) * 100}%`,
            height: `${(badge.height / FIELD_HEIGHT) * 100}%`,
            backgroundColor: accent,
          }}
        >
          {game.down}
        </span>
      </div>
    </div>
  );
}

function PlayerFieldMarker({
  player,
  x,
  y,
  visible,
}: {
  player: FieldPlayer;
  x: number;
  y: number;
  visible: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className={s.playerMarker}
      style={{
        left: `${(x / FIELD_WIDTH) * 100}%`,
        top: `${(y / FIELD_HEIGHT) * 100}%`,
        opacity: visible ? 1 : 0,
      }}
      aria-label={`${player.name}, ${player.position}, ${player.team}`}
    >
      {player.headshotUrl && !failed ? (
        <img src={player.headshotUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>
          {player.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </span>
      )}
      <span className={s.playerTooltip}>
        {player.name}
        <small>
          {player.position} · {player.team}
        </small>
      </span>
    </button>
  );
}
