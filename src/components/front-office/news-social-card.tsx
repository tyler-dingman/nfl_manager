'use client';
import { newsCategory, newsPersona } from '@/lib/front-office-news-presentation';
import { relativeNewsTime } from '@/lib/front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';
export function NewsSocialCard({ event }: { event: FrontOfficeEvent }) {
  return (
    <>
      <span className="fo-social-avatar" aria-hidden="true">
        {newsPersona(event) === 'LEAGUE BUZZ' ? 'LB' : 'D&D'}
      </span>
      <span className="fo-news-row-copy">
        <span className="fo-social-byline">
          <b>{newsPersona(event)}</b>
          <time>{relativeNewsTime(event.createdAt)}</time>
        </span>
        <span className="fo-social-context">
          Simulated league · {event.teamAbbr} · {newsCategory(event).replaceAll('_', ' ')}
        </span>
        <strong>{event.headline}</strong>
        <span className="fo-social-body">
          {event.summary !== event.headline ? event.summary : ''}
        </span>
        <span className="fo-social-read">
          {event.readAt ? 'Read story' : '● Unread · Read story'} →
        </span>
      </span>
    </>
  );
}
