'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { FrontOfficeEvent } from '@/types/front-office';

const messageTypes = new Set([
  'welcome_message',
  're_sign_ready',
  'trade_interest',
  'deadline_alert',
  'trade_offer',
]);

export function FrontOfficeMessages() {
  const saveId = useSaveStore((state) => state.saveId);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const messages = useMemo(
    () =>
      events
        .filter((event) => messageTypes.has(event.type))
        .sort((a, b) => {
          if (a.type === 'welcome_message' && b.type === 'welcome_message') {
            return Number(a.metadata.messageOrder ?? 99) - Number(b.metadata.messageOrder ?? 99);
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    [events],
  );
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
