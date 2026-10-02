'use client';
import Link from 'next/link';
import { Clock, BarChart3, Trophy, ArrowRight } from 'lucide-react';
import type { DailyHuddle } from '../../../packages/huddle/daily';
import { dailyDate, compactCount, pollResult } from '../../../packages/huddle/daily';
import type { Poll } from '../../../packages/huddle';
import s from './huddle.module.css';
export function ArchiveIntro({ daily }: { daily: DailyHuddle }) {
  return (
    <div className={`${s.dailyIntro} ${s.archiveIntro}`}>
      <div className={s.pastBadge}>
        <Clock size={28} />
        <div>
          <b>PAST HUDDLE</b>
          <span>{dailyDate(daily.date)}</span>
        </div>
      </div>
      <h2>{daily.summary}</h2>
      <Link className={s.todayLink} href={`/huddle?team=${daily.team}`}>
        Join Today’s Huddle <ArrowRight size={18} />
      </Link>
    </div>
  );
}
export function ArchivePoll({ poll, inline = false }: { poll: Poll; inline?: boolean }) {
  const { total } = pollResult(poll);
  return (
    <div className={s.archivePoll}>
      {inline && <div className={s.systemLabel}>HUDDLE POLL</div>}
      <h3>{poll.question}</h3>
      {poll.options.map((o, i) => {
        const percent = total ? Math.round(((poll.counts[i] ?? 0) / total) * 100) : 0;
        return (
          <div className={s.resultRow} key={o}>
            <div className={s.resultTrack}>
              <span style={{ width: `${percent}%` }} />
              <b>{o}</b>
            </div>
            <strong>{percent}%</strong>
          </div>
        );
      })}
      <small>{total.toLocaleString()} votes · Final results</small>
    </div>
  );
}
export function ArchiveCommunity({ daily, polls }: { daily: DailyHuddle; polls: Poll[] }) {
  const featured = polls.find((p) => p.id === daily.featuredPollId),
    top = polls.find((p) => p.id === daily.topPollId),
    { total, percent } = pollResult(featured);
  return (
    <div className={s.community}>
      <section>
        <h3>
          <BarChart3 size={20} /> FINAL HUDDLE PULSE
        </h3>
        <div className={s.pulse}>
          <strong>{percent}%</strong>
          <span>
            <b>{daily.pulseLabel.toUpperCase()}</b>
            <small>Based on {total.toLocaleString()} Huddle votes.</small>
          </span>
        </div>
      </section>
      <section>
        <h3>
          <Trophy size={20} /> HUDDLE RESULTS
        </h3>
        <div className={s.archiveMetrics}>
          {[
            [compactCount(daily.metrics.comments), 'Comments'],
            [compactCount(daily.metrics.fans), 'Fans participated'],
            [daily.metrics.polls, 'Polls'],
            ...(daily.finalRecord ? [[daily.finalRecord, 'Final record after this game']] : []),
          ].map(([n, l]) => (
            <div key={l}>
              <b>{n}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </section>
      {top && (
        <section>
          <h3>
            <BarChart3 size={20} /> TOP POLL FROM THIS HUDDLE
          </h3>
          <ArchivePoll poll={top} />
        </section>
      )}
    </div>
  );
}
