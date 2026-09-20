'use client';
import * as React from 'react';
import Image from 'next/image';
import type { DraftSessionDTO } from '@/types/draft';
import type { TeamDTO } from '@/types/team';
import styles from '@/app/draft/room/mock-draft-room.module.css';

export function DraftDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.liveDialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close dialog">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function LiveDraftPanels({
  session,
  teams,
  clockText,
}: {
  session: DraftSessionDTO;
  teams: TeamDTO[];
  clockText: string;
}) {
  const current = session.picks[session.currentPickIndex];
  const [round, setRound] = React.useState(current?.round ?? 1);
  const activeRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (current?.round && current.round <= session.maxRounds) setRound(current.round);
  }, [current?.round, session.maxRounds]);
  React.useEffect(() => {
    const active = activeRef.current,
      list = listRef.current;
    if (active && list) list.scrollTop = Math.max(0, active.offsetTop - list.offsetTop - 110);
  }, [session.currentPickIndex, round]);
  return (
    <aside className={`${styles.workspacePanel} ${styles.liveRail}`}>
      <header>
        <h2>Draft Feed</h2>
        <select
          aria-label="Draft feed round"
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
        >
          {Array.from({ length: session.maxRounds }, (_, i) => (
            <option key={i} value={i + 1}>
              Round {i + 1}
            </option>
          ))}
        </select>
      </header>
      {current && current.round !== round && session.status === 'in_progress' && (
        <div className={styles.feedCurrentSummary}>
          <span>
            Pick {current.overall} · {current.ownerTeamAbbr}
            {current.ownerTeamAbbr === session.userTeamAbbr ? ' · YOUR PICK' : ''}
            {session.isPaused ? ' · Paused' : ''}
          </span>
          <time>{clockText}</time>
          <button onClick={() => setRound(current.round)}>Show current round</button>
        </div>
      )}
      <div ref={listRef} className={styles.livePickList}>
        {session.picks
          .filter((p) => p.round === round)
          .map((p) => {
            const owner = teams.find((t) => t.abbr === p.ownerTeamAbbr),
              player = session.prospects.find((a) => a.id === p.selectedPlayerId),
              active = p.id === current?.id;
            return (
              <div
                key={p.id}
                ref={active ? activeRef : undefined}
                className={`${styles.livePick} ${active ? styles.liveCurrent : p.ownerTeamAbbr === session.userTeamAbbr ? styles.liveUserPick : ''}`}
              >
                <b>{p.overall}</b>
                {owner?.logoUrl && (
                  <Image src={owner.logoUrl} alt="" width={30} height={30} unoptimized />
                )}
                <div>
                  <strong>{owner?.name ?? p.ownerTeamAbbr}</strong>
                  <small>
                    {player
                      ? `${player.firstName} ${player.lastName} · ${player.position} · ${player.college ?? player.school ?? 'School unavailable'}`
                      : active
                        ? p.ownerTeamAbbr === session.userTeamAbbr
                          ? `YOUR PICK${session.isPaused ? ' · Paused' : ''}`
                          : session.isPaused
                            ? 'Paused on the clock'
                            : 'On the clock'
                        : p.ownerTeamAbbr === session.userTeamAbbr
                          ? 'Your pick'
                          : 'Upcoming'}
                  </small>
                  {p.ownerTeamAbbr !== p.originalTeamAbbr && (
                    <small>⇄ Acquired from {p.originalTeamAbbr}</small>
                  )}
                </div>
                {active && <time>{clockText}</time>}
              </div>
            );
          })}
      </div>
      {(session.tradeState?.history ?? [])
        .filter((t) => session.picks[t.pick]?.round === round)
        .map((t) => (
          <article className={styles.liveTrade} key={t.id}>
            <strong>
              Trade · {session.userTeamAbbr} / {t.team}
            </strong>
            <p>
              {session.userTeamAbbr} receives {t.receive.map((p) => p.label).join(' + ')}
            </p>
            <p>
              {t.team} receives {t.send.map((p) => p.label).join(' + ')}
            </p>
          </article>
        ))}
    </aside>
  );
}
