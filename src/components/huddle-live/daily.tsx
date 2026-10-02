'use client';
import Link from 'next/link';
import { BarChart3, Clock, MessageCircle, Pin, Users, ArrowRight, ThumbsUp } from 'lucide-react';
import type { DailyHuddle } from '../../../packages/huddle/daily';
import { compactCount, dailyDate, pollResult } from '../../../packages/huddle/daily';
import type { Message, Poll } from '../../../packages/huddle';
import s from './huddle.module.css';
export function DailyIntro({ daily, onJoin }: { daily: DailyHuddle; onJoin: () => void }) {
  return (
    <div className={s.dailyIntro}>
      <time className={s.heroDate}>{dailyDate(daily.date).toUpperCase()}</time>
      <h2>{daily.summary}</h2>
      <div className={s.dailyJoin}>
        <div className={s.avatarStack} aria-hidden="true">
          {['CM', 'RF', 'A4', 'CC'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <span>
          <i className={s.liveDot} /> {compactCount(daily.metrics.hereNow)} IN THE HUDDLE
        </span>
        <span>· {compactCount(daily.metrics.comments)} comments today</span>
        <div className={s.joinButtonRow}>
          <button onClick={onJoin}>
            Join the Huddle <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
export function DailyUpdate({ entry, archived = false }: { entry: Message; archived?: boolean }) {
  return (
    <article className={s.dailySystem}>
      <span className={s.systemIcon}>D&D</span>
      <div>
        <div className={s.systemMeta}>
          <b>D&D UPDATE</b>
          <time>
            {new Date(entry.at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/Chicago',
            })}
          </time>
        </div>
        <p>{entry.body}</p>
        {archived && (
          <small style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThumbsUp size={14} />
            {entry.likes}
          </small>
        )}
      </div>
      <Pin size={20} />
    </article>
  );
}
export function DailyPoll({
  poll,
  choice,
  onVote,
}: {
  poll: Poll;
  choice?: number;
  onVote: (choice: number) => void;
}) {
  const { total } = pollResult(poll);
  return (
    <article className={s.dailySystem}>
      <span className={`${s.systemIcon} ${s.pollIcon}`}>
        <BarChart3 size={22} />
      </span>
      <div className={s.pollContent}>
        <b className={s.systemLabel}>HUDDLE POLL</b>
        <h3>{poll.question}</h3>
        <div className={s.pollBar}>
          {poll.options.map((option, i) => (
            <button
              key={option}
              disabled={poll.closed || choice !== undefined}
              aria-pressed={choice === i}
              onClick={() => onVote(i)}
              style={{ flex: Math.max(poll.counts[i] ?? 0, 1) }}
            >
              <b>{total ? Math.round(((poll.counts[i] ?? 0) / total) * 100) : 0}%</b>{' '}
              {option.toUpperCase()}
              {choice === i ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <small>
          {total.toLocaleString()} votes{choice !== undefined ? ' · Preview selection only' : ''}
        </small>
      </div>
    </article>
  );
}
export function DailyCommunity({
  daily,
  polls,
  onPoll,
}: {
  daily: DailyHuddle;
  polls: Poll[];
  onPoll: () => void;
}) {
  const featured = polls.find((p) => p.id === daily.featuredPollId),
    result = pollResult(featured);
  return (
    <div className={s.community}>
      <section>
        <h3>
          <BarChart3 size={20} /> HUDDLE PULSE
        </h3>
        {featured ? (
          <button className={s.pulse} onClick={onPoll}>
            <strong>{result.percent}%</strong>
            <span>
              <b>{daily.pulseLabel.toUpperCase()}</b>
              <small>Based on {result.total.toLocaleString()} Huddle votes.</small>
            </span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <p>No poll results yet.</p>
        )}
      </section>
      <section>
        <h3>
          <Users size={20} /> TODAY IN THE HUDDLE
        </h3>
        <div className={s.dailyMetrics}>
          {[
            [daily.metrics.hereNow, 'Here now'],
            [daily.metrics.comments, 'Comments today'],
            [daily.metrics.fans, 'Fans participated'],
            [daily.metrics.polls, 'Polls'],
          ].map(([n, label]) => (
            <div key={label}>
              <MessageCircle size={17} />
              <b>{compactCount(Number(n))}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>
          <Clock size={20} /> PREVIOUS HUDDLES{' '}
          <Link href={`/huddle/archive?team=${daily.team}`}>View All →</Link>
        </h3>
        <div className={s.previous}>
          {daily.previous.map((p) => (
            <Link key={p.id} href={`/huddle/archive?team=${daily.team}&date=${p.date}`}>
              <span className={s.archiveIcon}>
                <MessageCircle size={20} />
              </span>
              <span>
                The Huddle — {p.summary}
                <small>
                  {dailyDate(p.date, true)} · {compactCount(p.comments)} comments
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
