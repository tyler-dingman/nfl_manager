'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { FrontOfficeEvent } from '@/types/front-office';

import { frontOfficeMessages } from '../../../packages/front-office/messages';

export function FrontOfficeMessages() {
  const saveId = useSaveStore((state) => state.saveId);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const messages = useMemo(() => frontOfficeMessages(events), [events]);
  useEffect(() => {
    if (!saveId) return;
    let active = true;
    void apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (active) setEvents(payload.events ?? []);
      });
    return () => {
      active = false;
    };
  }, [saveId]);

  return (
    <main className="fo-messages-page">
      <section className="fo-messages-list">
        {messages.map((event) => (
          <article key={event.id}>
            {typeof event.metadata.headshotUrl === 'string' ? (
              <img src={event.metadata.headshotUrl} alt="" />
            ) : (
              <span>{String(event.metadata.senderName ?? event.headline).slice(0, 1)}</span>
            )}
            <div>
              <h2>{event.headline}</h2>
              <small>{String(event.metadata.senderRole ?? 'Front Office')}</small>
              <p>{event.summary}</p>
            </div>
          </article>
        ))}
        {!messages.length ? <p className="fo-home-empty-copy">No messages yet.</p> : null}
      </section>
    </main>
  );
}
