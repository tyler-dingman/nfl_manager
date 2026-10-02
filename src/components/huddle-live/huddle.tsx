'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Reply,
  Send,
  ThumbsUp,
  MoreHorizontal,
  ImagePlus,
  Smile,
  X,
} from 'lucide-react';
import { useTeamStore } from '@/features/team/team-store';
import { TEAM_LIST } from '@/data/teams';
import { getFrontOfficeTeamTheme } from '@/lib/team-theme-tokens';
import { gameDayHeroAsset } from '@/config/game-day-hero';
import { createUseHuddle } from '../../../packages/huddle/use-huddle';
import {
  filterPlays,
  relativeTime,
  type Game,
  type PlayFilter,
  type Message,
} from '../../../packages/huddle';
import { useAuthUser } from '@/features/auth/auth-session';
import UserAvatar from '@/components/auth/user-avatar';
import s from './huddle.module.css';
import { GifPicker, PostedGif, gifProvider, gifEvent } from './gif';
import { toGifReference, type GifItem } from '../../../packages/gifs';
import { huddleFont } from './huddle-font';
import { HuddleField } from './field';
import { DailyIntro, DailyUpdate, DailyPoll, DailyCommunity } from './daily';
import { ArchiveIntro, ArchiveCommunity, ArchivePoll } from './archive';
import { compactCount, dailyDate, dailyEntries } from '../../../packages/huddle/daily';
const useHuddle = createUseHuddle({ useCallback, useEffect, useRef, useState });
const request = (url: string, init?: RequestInit) => fetch(url, init);
const filters: PlayFilter[] = ['All Plays', 'Current Drive', 'Scoring', 'Key Plays'];
const logo = (abbr: string) => TEAM_LIST.find((t) => t.abbr === abbr)?.logoUrl;
function Score({ game, participants }: { game: Game; participants: number | null }) {
  const last = [...game.plays].sort((a, b) => b.sequence - a.sequence)[0];
  return (
    <div className={s.scoreRow}>
      <div className={s.attendance}>
        <i /> {participants?.toLocaleString() ?? '—'} <span>IN THE HUDDLE</span>
      </div>
      <section className={s.score} aria-label="Game score">
        <div>
          <img src={logo(game.away)} alt="" />
          <div className={s.teamNumbers}>
            <strong>{game.awayScore ?? '—'}</strong>
            <span>{game.away}</span>
            <small>({game.awayRecord ?? '—'})</small>
          </div>
        </div>
        <div>
          <b>
            {game.status === 'live' ? `Q${game.quarter} ${game.clock}` : game.status.toUpperCase()}
          </b>
          <span>{game.down}</span>
          <span>{game.location}</span>
          {game.status === 'pregame' && <time>{new Date(game.kickoff).toLocaleString()}</time>}
        </div>
        <div>
          <div className={s.teamNumbers}>
            <strong>{game.homeScore ?? '—'}</strong>
            <span>{game.home}</span>
            <small>({game.homeRecord ?? '—'})</small>
          </div>
          <img src={logo(game.home)} alt="" />
        </div>
      </section>
      <div className={s.driveOverview}>
        <span>LAST PLAY · {last ? `Q${last.quarter} ${last.clock}` : '—'}</span>
        <strong>{last?.text ?? 'Waiting for the first play.'}</strong>
      </div>
    </div>
  );
}
function Plays({ game }: { game: Game | null }) {
  const [filter, setFilter] = useState<PlayFilter>('All Plays');
  const plays = filterPlays(game, filter);
  return (
    <>
      <div className={s.tabs}>
        {filters.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {filter === 'Current Drive' && <p>{game?.driveSummary ?? 'Drive details unavailable.'}</p>}
      {!plays.length && <p className={s.empty}>No plays available for this view.</p>}
      {plays.map((p, i) => (
        <div key={p.id}>
          {(i === 0 || plays[i - 1].quarter !== p.quarter) && (
            <h3 className={s.quarter}>{p.quarter > 4 ? 'OVERTIME' : `QUARTER ${p.quarter}`}</h3>
          )}
          <div className={s.play}>
            <time>{p.clock}</time>
            <div>
              <b>{p.down}</b>
              <small>{p.location}</small>
            </div>
            <p>{p.text}</p>
            <b className={p.yards !== null && p.yards < 0 ? s.negative : s.positive}>
              {p.scoring ? 'SCORE' : p.yards === null ? '—' : p.yards > 0 ? `+${p.yards}` : p.yards}
            </b>
          </div>
        </div>
      ))}
    </>
  );
}
export default function Huddle({ archive = false }: { archive?: boolean } = {}) {
  const { user } = useAuthUser();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (attachment) URL.revokeObjectURL(attachment);
    },
    [attachment],
  );
  const params = useSearchParams() ?? new URLSearchParams(),
    selected = useTeamStore((x) => x.selectedTeamId);
  const teams = useTeamStore((x) => x.teams);
  const team =
    TEAM_LIST.find((t) => t.abbr === params.get('team')) ??
    TEAM_LIST.find((t) => t.id === selected) ??
    TEAM_LIST[0];
  const theme = getFrontOfficeTeamTheme(team.abbr);
  const query = new URLSearchParams({
    team: team.abbr,
    teamName: team.name,
    ...(archive ? { archive: '1', date: params.get('date') ?? '2026-09-27' } : {}),
    ...(params.get('mode') ? { mode: params.get('mode')! } : {}),
    ...(params.get('game') ? { game: params.get('game')! } : {}),
    ...(params.get('discussion') ? { discussion: params.get('discussion')! } : {}),
  }).toString();
  const { data, error, busy, act, load, simulator } = useHuddle(query, request);
  const [tab, setTab] = useState('Live'),
    [draft, setDraft] = useState(''),
    [menu, setMenu] = useState<string | null>(null),
    [notice, setNotice] = useState(''),
    [playContext, setPlayContext] = useState<string | null>(params.get('play'));
  const composerInput = useRef<HTMLInputElement>(null);
  const replyInput = useRef<HTMLTextAreaElement>(null);
  const replyTrigger = useRef<HTMLButtonElement | null>(null);
  const cancelReply = () => {
    setReplyTo(undefined);
    setEmojiOpen(false);
    replyTrigger.current?.focus({ preventScroll: true });
  };

  const [gifOpen, setGifOpen] = useState(false),
    [selectedGif, setSelectedGif] = useState<GifItem | null>(null),
    [gifQuery, setGifQuery] = useState(''),
    [replyTo, setReplyTo] = useState<string | undefined>();
  useEffect(() => {
    if (replyTo) replyInput.current?.focus({ preventScroll: true });
  }, [replyTo]);
  const [reports, setReports] = useState<
    Array<{ id: string; userId: string; body: string; name: string; reports: number }>
  >([]);
  const bottom = useRef<HTMLDivElement>(null),
    atLive = useRef(true),
    seen = useRef(new Set<string>()),
    playSeen = useRef(new Set<string>()),
    [updates, setUpdates] = useState({ messages: 0, plays: 0 });
  useEffect(() => {
    seen.current = new Set();
    playSeen.current = new Set();
    setUpdates({ messages: 0, plays: 0 });
  }, [query]);
  useEffect(() => {
    if (!data || data.daily?.fixture) return;
    const added = data.messages.filter((m) => !seen.current.has(m.id)).length,
      last = data.game?.plays.at(-1)?.id ?? null;
    const newPlay = (data.game?.plays ?? []).filter((p) => !playSeen.current.has(p.id)).length;
    if (seen.current.size && !data.historyPage) {
      if (atLive.current) bottom.current?.scrollIntoView({ block: 'nearest' });
      else
        setUpdates((n) => ({
          messages: n.messages + added,
          plays: n.plays + newPlay,
        }));
    }
    seen.current = new Set(data.messages.map((m) => m.id));
    playSeen.current = new Set((data.game?.plays ?? []).map((p) => p.id));
  }, [data]);
  const jump = () => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
    atLive.current = true;
    setUpdates({ messages: 0, plays: 0 });
  };
  const perform = async (b: object) => {
    if (await act(b)) {
      setNotice(
        data?.daily?.fixture ? 'Preview only — no changes were saved to a server.' : 'Saved.',
      );
      setMenu(null);
    }
  };
  const daily = data?.game ? undefined : data?.daily;
  const archived = archive || daily?.status === 'ARCHIVED';
  const messages =
    (daily
      ? dailyEntries(data?.messages ?? [], tab, daily.status === 'ARCHIVED')
      : data?.messages
    )?.filter(
      (m) =>
        !m.removed &&
        !data?.hiddenUsers.includes(m.userId) &&
        (!playContext || m.playId === playContext),
    ) ?? [];
  const game = data?.game ?? null;
  const latest = game?.plays.at(-1);
  const effective = game || daily ? tab : tab === 'Live' ? 'Chat' : tab;
  const renderComposer = () => (
    <form
      className={replyTo ? `${s.composer} ${s.inlineReply}` : s.composer}
      onSubmit={async (e) => {
        e.preventDefault();
        if (attachment) {
          setNotice(
            'Image uploads are still preview-only. Remove the image to send text or a GIF.',
          );
          return;
        }
        if (
          await act({
            action: 'message',
            body: draft,
            clientId: crypto.randomUUID(),
            name: user?.name ?? 'You',
            avatar: user?.avatarUrl,
            replyTo,
            ...(selectedGif
              ? { media: toGifReference(selectedGif), resolvedGif: selectedGif }
              : {}),
          })
        ) {
          if (selectedGif) {
            gifEvent('sent');
            void gifProvider.share(selectedGif.id, gifQuery).catch(() => {});
          }
          setDraft('');
          setSelectedGif(null);
          setReplyTo(undefined);
          setNotice('Posted in this preview only. Nothing was saved to a server.');
        }
      }}
    >
      {replyTo && <span className={s.threadNode} aria-hidden="true" />}
      {replyTo && (
        <div className={s.replyContext}>
          Replying to <b>{data?.messages.find((m) => m.id === replyTo)?.name ?? 'message'}</b>
        </div>
      )}
      {!replyTo && <UserAvatar src={user?.avatarUrl} name={user?.name ?? 'Guest'} />}
      <div className={s.composerEntry}>
        {selectedGif && (
          <div className={s.gifAttachment}>
            <img src={selectedGif.stillUrl} alt={selectedGif.title} />
            <button type="button" aria-label="Remove GIF" onClick={() => setSelectedGif(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {replyTo ? (
          <textarea
            ref={replyInput}
            aria-label="Write your reply"
            placeholder="Write your reply..."
            value={draft}
            maxLength={1000}
            rows={3}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelReply();
              }
            }}
          />
        ) : (
          <input
            ref={composerInput}
            aria-label="Say something"
            placeholder={selectedGif ? 'Add a message…' : 'Say something…'}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
        <button
          type="button"
          className={`${s.composerTool} ${s.gifButton}`}
          aria-label="Add GIF"
          onClick={() => {
            setEmojiOpen(false);
            setGifOpen(true);
          }}
        >
          GIF
        </button>
        <button
          type="button"
          className={s.composerTool}
          aria-label="Add image"
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={22} />
        </button>
        <button
          type="button"
          className={s.composerTool}
          aria-label="Choose emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen(!emojiOpen)}
        >
          <Smile size={22} />
        </button>
      </div>
      <input
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        ref={fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 10 * 1024 * 1024) setNotice('Choose an image under 10 MB.');
            else {
              setAttachment(URL.createObjectURL(file));
              setSelectedGif(null);
            }
          }
          e.target.value = '';
        }}
      />
      {emojiOpen && (
        <div className={s.emojiTray}>
          {['🏈', '🔥', '👏', '🙌', '💪', '😂', '🎉', '❤️'].map((emoji) => (
            <button
              type="button"
              key={emoji}
              aria-label={`Insert ${emoji}`}
              onClick={() => {
                setDraft((d) => (d + emoji).slice(0, 1000));
                setEmojiOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {attachment && (
        <div className={s.attachment}>
          <img src={attachment} alt="Selected image preview" />
          <button type="button" aria-label="Remove image" onClick={() => setAttachment(null)}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className={replyTo ? s.replyActions : s.messageActions}>
        {replyTo && <span className={s.replyCounter}>{draft.length}/1000</span>}
        {replyTo && (
          <button
            className={s.replyCancel}
            type="button"
            aria-label="Cancel reply"
            onClick={cancelReply}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          aria-label={replyTo ? 'Send reply' : 'Send message'}
          disabled={busy || (!draft.trim() && !attachment && !selectedGif)}
        >
          {replyTo ? busy ? 'Replying…' : 'Reply' : <Send size={22} />}
        </button>
      </div>
      {gifOpen && (
        <GifPicker
          onClose={() => setGifOpen(false)}
          onSelect={(gif, q) => {
            setSelectedGif(gif);
            setGifQuery(q);
            setAttachment(null);
            setGifOpen(false);
            (replyTo ? replyInput.current : composerInput.current)?.focus();
          }}
        />
      )}
    </form>
  );
  return (
    <TeamThemeProvider team={teams.find((candidate) => candidate.abbr === team.abbr)}>
      <MainSiteHeader teamAbbr={team.abbr} active="community" />
      <main
        className={`${s.shell} ${huddleFont.variable} ${daily ? s.dailyShell : ''}`}
        style={
          {
            '--accent': theme.accent,
            '--fill': theme.interactive,
            '--on-fill': theme.interactiveForeground,
            '--daily-text': theme.interactiveText,
            '--stadium': `url(${gameDayHeroAsset(team.abbr)})`,
          } as CSSProperties
        }
      >
        <div className={s.main}>
          {archive && (
            <nav className={s.breadcrumb} aria-label="Breadcrumb">
              <Link href={`/huddle?team=${team.abbr}`}>The Huddle</Link>
              <span>›</span>
              <Link href={`/huddle/archive?team=${team.abbr}`}>Previous Huddles</Link>
              {daily && (
                <>
                  <span>›</span>
                  <span>{dailyDate(daily.date, true)}</span>
                </>
              )}
            </nav>
          )}
          {archive && !daily && <p>{data?.unavailable ?? 'Archived Huddles are not available.'}</p>}
          {daily ? (
            <header className={s.dailyHero}>
              <div className={s.dailyBrand}>
                <img src={team.logoUrl} alt="" />
                <div>
                  <h1>
                    THE <span>HUDDLE</span>
                  </h1>
                  <p>{daily.description}</p>
                  {archived && (
                    <div className={s.archiveParticipation}>
                      {compactCount(daily.metrics.fans)} fans participated ·{' '}
                      {compactCount(daily.metrics.comments)} comments · {daily.metrics.polls} polls
                    </div>
                  )}
                </div>
              </div>
              {archived ? (
                <ArchiveIntro daily={daily} />
              ) : (
                <DailyIntro
                  daily={daily}
                  onJoin={() => {
                    setTab('Live');
                    requestAnimationFrame(() => {
                      composerInput.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      composerInput.current?.focus({ preventScroll: true });
                    });
                  }}
                />
              )}
            </header>
          ) : (
            <header className={s.hero}>
              <img src={team.logoUrl} alt="" />
              <div>
                <h1>THE HUDDLE</h1>
                <p>REAL FANS. REAL CONVERSATION.</p>
              </div>
            </header>
          )}
          {error && (
            <div role="status" className={s.status}>
              {error} <button onClick={() => void load()}>Reconnect</button>
            </div>
          )}
          {data?.gameError && <p role="status">{data.gameError}</p>}
          {!data && !error && <p>Opening your team’s Huddle…</p>}
          <div className={s.columns}>
            <section className={s.center}>
              {game && (
                <>
                  <Score game={game} participants={data?.participants ?? null} />
                </>
              )}
              {!game && !daily && (
                <div className={s.context}>
                  <h2>
                    {params.get('discussion') ? 'Team discussion' : 'Your team. Your conversation.'}
                  </h2>
                  <p>
                    Talk news, roster moves, film and everything {team.name}. No live game is
                    available.
                  </p>
                  {params.get('discussion') && (
                    <Link href={`/the-beat?story=${encodeURIComponent(params.get('discussion')!)}`}>
                      Read the story →
                    </Link>
                  )}
                </div>
              )}
              {effective === 'Live' && game && (
                <>
                  <HuddleField game={game} />
                </>
              )}
              <div className={s.tabs} role="group" aria-label="Huddle views">
                {(game
                  ? ['Live', 'Chat', 'Polls', 'Play-by-Play']
                  : daily
                    ? ['Live', 'Chat', 'Polls']
                    : ['Chat', 'Polls']
                ).map((t) => (
                  <button key={t} aria-pressed={effective === t} onClick={() => setTab(t)}>
                    {archived ? (t === 'Live' ? 'All Activity' : t === 'Chat' ? 'Comments' : t) : t}
                  </button>
                ))}
                {daily && (
                  <span className={s.sort}>Sort: {archived ? 'Oldest first' : 'Latest'}⌄</span>
                )}
              </div>
              {effective === 'Play-by-Play' ? (
                <Plays game={game} />
              ) : effective === 'Polls' ? (
                <section className={s.polls}>
                  {!data?.polls.length && <p>No polls yet. Check back during the conversation.</p>}
                  {daily
                    ? data?.polls.map((p) =>
                        archived ? (
                          <ArchivePoll key={p.id} poll={p} inline />
                        ) : (
                          <DailyPoll
                            key={p.id}
                            poll={p}
                            choice={data?.voted[p.id]}
                            onVote={(i) => void act({ action: 'vote', id: p.id, choice: i })}
                          />
                        ),
                      )
                    : data?.polls.map((p) => (
                        <article key={p.id}>
                          <h3>{p.question}</h3>
                          {p.options.map((o, i) => (
                            <button
                              disabled={busy || p.closed || data.voted[p.id] !== undefined}
                              key={i}
                              onClick={() => void perform({ action: 'vote', id: p.id, choice: i })}
                            >
                              {data.voted[p.id] === i ? '✓ ' : ''}
                              {o} <b>{p.counts[i] ?? 0}</b>
                            </button>
                          ))}
                          {p.closed && <small>Poll closed</small>}
                        </article>
                      ))}
                  {data?.canModerate && (
                    <button
                      onClick={() => {
                        const question = prompt('Poll question'),
                          a = prompt('First option'),
                          b = prompt('Second option');
                        if (question && a && b)
                          void perform({ action: 'poll', question, options: [a, b] });
                      }}
                    >
                      Create poll
                    </button>
                  )}
                </section>
              ) : (
                <>
                  <div
                    className={s.chat}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      atLive.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                    }}
                  >
                    {playContext && (
                      <button onClick={() => setPlayContext(null)}>Show all conversation</button>
                    )}
                    {data?.before && (
                      <button onClick={() => void load(data.before!)}>Load earlier messages</button>
                    )}
                    {!messages.length && (
                      <p className={s.empty}>Start the conversation. What’s on your mind?</p>
                    )}
                    {messages.map((m: Message) =>
                      daily && m.kind === 'update' ? (
                        <DailyUpdate key={m.id} entry={m} archived={archived} />
                      ) : daily && m.kind === 'poll' ? (
                        (() => {
                          const poll = data?.polls.find((p) => p.id === m.pollId);
                          return poll ? (
                            archived ? (
                              <article className={s.dailySystem} key={m.id}>
                                <ArchivePoll poll={poll} inline />
                              </article>
                            ) : (
                              <DailyPoll
                                key={m.id}
                                poll={poll}
                                choice={data?.voted[poll.id]}
                                onVote={(i) => void act({ action: 'vote', id: poll.id, choice: i })}
                              />
                            )
                          ) : null;
                        })()
                      ) : (
                        <Fragment key={m.id}>
                          <article key={m.id} className={s.message} id={`message-${m.id}`}>
                            <div className={s.avatar}>
                              {m.avatar ? (
                                <img
                                  src={m.avatar}
                                  alt=""
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                m.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className={s.bubble}>
                              <b>{m.name}</b>{' '}
                              <small>
                                {archived
                                  ? new Date(m.at).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      timeZone: 'America/Chicago',
                                    })
                                  : daily?.fixture && m.userId !== 'preview-self'
                                    ? `${Math.round((Date.parse('2026-09-30T16:44:00Z') - Date.parse(m.at)) / 60000)}m ago`
                                    : simulator
                                      ? 'Fixture comment'
                                      : relativeTime(m.at)}
                              </small>
                              <p className={s.commentText}>
                                {m.body}{' '}
                                {!archived && (
                                  <button
                                    type="button"
                                    className={s.replyButton}
                                    onClick={(e) => {
                                      replyTrigger.current = e.currentTarget;
                                      setReplyTo(m.id);
                                    }}
                                  >
                                    <Reply size={16} aria-hidden="true" /> Reply
                                  </button>
                                )}
                              </p>
                              {m.replyTo && (
                                <small>
                                  Replying to{' '}
                                  {data?.messages.find((x) => x.id === m.replyTo)?.name ??
                                    'a message'}
                                </small>
                              )}
                              {m.media && <PostedGif media={m.media} resolved={m.resolvedGif} />}
                            </div>
                            <button
                              className={s.likeButton}
                              aria-label={`Like message from ${m.name}`}
                              aria-pressed={data?.liked.includes(m.id)}
                              disabled={busy || archived}
                              onClick={() =>
                                void perform({
                                  action: 'like',
                                  id: m.id,
                                  enabled: !data?.liked.includes(m.id),
                                })
                              }
                            >
                              <ThumbsUp size={16} />
                              {m.likes}
                            </button>
                            <button
                              aria-label={`Options for message from ${m.name}`}
                              onClick={() => setMenu(menu === m.id ? null : m.id)}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                            {menu === m.id && (
                              <div className={s.options}>
                                {[
                                  'report',
                                  'mute',
                                  'block',
                                  ...(data?.canModerate ? ['remove', 'suspend'] : []),
                                ].map((action) => (
                                  <button
                                    key={action}
                                    onClick={() => {
                                      const reason =
                                        action === 'report' || action === 'suspend'
                                          ? prompt('Reason')
                                          : undefined;
                                      if ((action === 'report' || action === 'suspend') && !reason)
                                        return;
                                      void perform({ action, id: m.id, userId: m.userId, reason });
                                    }}
                                  >
                                    {action.charAt(0).toUpperCase() + action.slice(1)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </article>
                          {!archived && replyTo === m.id && renderComposer()}
                        </Fragment>
                      ),
                    )}
                    <div ref={bottom} />
                  </div>
                  {!!(updates.messages || updates.plays) && (
                    <button className={s.newItems} onClick={jump}>
                      ↓ {updates.plays ? `${updates.plays} NEW PLAYS · ` : ''}
                      {updates.messages} NEW COMMENTS
                    </button>
                  )}
                  {!archived && !replyTo && renderComposer()}
                </>
              )}
              {data?.canModerate && (
                <details>
                  <summary>Moderation</summary>
                  <button
                    onClick={async () => {
                      const r = await request(`/api/huddle?${query}&review=1`);
                      const b = await r.json();
                      if (r.ok) setReports(b.reports);
                      else setNotice(b.error);
                    }}
                  >
                    Review reported messages
                  </button>
                  {reports.map((r) => (
                    <article key={r.id}>
                      <b>
                        {r.name} · {r.reports} reports
                      </b>
                      <p>{r.body}</p>
                      <button onClick={() => void perform({ action: 'remove', id: r.id })}>
                        Remove message
                      </button>
                      <button
                        onClick={() =>
                          void perform({
                            action: 'suspend',
                            userId: r.userId,
                            reason: 'Moderator review of reported message',
                          })
                        }
                      >
                        Suspend 24 hours
                      </button>
                    </article>
                  ))}
                </details>
              )}
              <small role="status">{notice}</small>
              {!!data?.hiddenUsers.length && (
                <details>
                  <summary>Muted / blocked users</summary>
                  {data.hiddenUsers.map((id) => (
                    <button key={id} onClick={() => void perform({ action: 'unhide', userId: id })}>
                      Unhide user {id.slice(0, 8)}
                    </button>
                  ))}
                </details>
              )}
            </section>
            {daily ? (
              <aside className={s.dailyRail}>
                {archived ? (
                  <ArchiveCommunity daily={daily} polls={data?.polls ?? []} />
                ) : (
                  <DailyCommunity
                    daily={daily}
                    polls={data?.polls ?? []}
                    onPoll={() => setTab('Polls')}
                  />
                )}
              </aside>
            ) : (
              <aside className={s.rail}>
                <h2>Play-by-Play</h2>
                <Plays game={game} />
                <button onClick={() => setTab('Play-by-Play')}>View full Play-by-Play →</button>
              </aside>
            )}
          </div>
          <p role="status">
            {daily?.fixture
              ? 'DAILY HUDDLE PREVIEW · Sample conversation and metrics. Posts stay in this preview; nothing is uploaded.'
              : simulator
                ? 'DEVELOPMENT SIMULATOR · Fictional PHI vs DAL game. No live data.'
                : 'THE HUDDLE · Concept only. Live data is disabled.'}
          </p>
          {simulator && (
            <div className={s.simulator} aria-label="Development game simulator">
              <button disabled={simulator.step === 0} onClick={simulator.previous}>
                ← PREVIOUS PLAY
              </button>
              <button disabled={simulator.step === 9} onClick={simulator.next}>
                NEXT PLAY →
              </button>
              <button onClick={simulator.reset}>RESET GAME</button>
              <small>
                Play {simulator.step + 1} / 10 · Field shows the resulting state ·{' '}
                {game?.possession} ball: {game?.location} · Normalized: {game?.ball} · {game?.down}{' '}
                · →
              </small>
            </div>
          )}
        </div>
      </main>
    </TeamThemeProvider>
  );
}
