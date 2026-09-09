'use client';

import Link from 'next/link';
import { Bell, Radio, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FrontOfficeEvent } from '@/types/front-office';

const labels: Record<FrontOfficeEvent['type'], string> = {
  breaking_news: 'Breaking News', trade_rumor: 'Rumor Mill', trade_interest: 'Trade Desk',
  trade_offer: 'Trade Offer', free_agent_signing: 'Free Agency', player_release: 'League Wire',
  contract_extension: 'League Wire', draft_buzz: 'Draft Buzz', deadline_alert: 'Deadline Alert',
  league_transaction: 'League Wire', playoff_update: 'Playoff Update',
};

export function FrontOfficeEventCenter({ saveId }: { saveId: string }) {
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [toast, setToast] = useState<FrontOfficeEvent | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { events: FrontOfficeEvent[] };
    setEvents(payload.events);
  }, [saveId]);

  const surface = useCallback(async () => {
    const response = await apiFetch('/api/front-office/events/next', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveId }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { event: FrontOfficeEvent | null };
    if (payload.event) setToast(payload.event);
    await load();
  }, [load, saveId]);

  useEffect(() => {
    void load().then(surface);
    const onAdvanced = () => void surface();
    window.addEventListener('front-office-simulation-advanced', onAdvanced);
    return () => window.removeEventListener('front-office-simulation-advanced', onAdvanced);
  }, [load, surface]);

  useEffect(() => {
    if (!toast || toast.type === 'trade_offer' || toast.type === 'deadline_alert') return;
    const timer = window.setTimeout(() => void dismiss(toast), 8500);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  const update = async (event: FrontOfficeEvent, action: 'read' | 'dismiss') => {
    await apiFetch(`/api/front-office/events/${encodeURIComponent(event.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    await load();
  };
  const dismiss = async (event: FrontOfficeEvent) => {
    setToast(null);
    await update(event, 'dismiss');
  };
  const unread = events.filter((event) => !event.readAt).length;

  return (
    <>
      <button className="fo-wire-trigger" type="button" onClick={() => setOpen(true)} aria-label={`League Wire, ${unread} unread events`}>
        <Bell aria-hidden="true" /> <span>League Wire</span>{unread ? <strong>{unread > 9 ? '9+' : unread}</strong> : null}
      </button>
      {toast ? (
        <aside className={`fo-event-toast priority-${toast.priority}`} role={toast.priority === 'urgent' ? 'alert' : 'status'} aria-live={toast.priority === 'urgent' ? 'assertive' : 'polite'}>
          <div className="fo-event-kicker"><Radio aria-hidden="true" /> {labels[toast.type]} <span>Week {toast.simulationWeek}</span></div>
          <button className="fo-event-close" type="button" onClick={() => void dismiss(toast)} aria-label="Dismiss notification"><X /></button>
          <h2>{toast.headline}</h2><p>{toast.summary}</p>
          <div className="fo-event-actions">
            {toast.actionUrl ? <Link href={toast.actionUrl} onClick={() => void update(toast, 'read')}>{toast.type === 'trade_offer' ? 'View offer' : 'Open update'}</Link> : null}
            <button type="button" onClick={() => void dismiss(toast)}>Dismiss</button>
          </div>
        </aside>
      ) : null}
      {open ? (
        <div className="fo-wire-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div ref={panelRef} className="fo-wire-panel" role="dialog" aria-modal="true" aria-labelledby="fo-wire-title">
            <header><div><span>Front Office</span><h2 id="fo-wire-title">League Wire</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close League Wire"><X /></button></header>
            <div className="fo-wire-list">
              {events.length ? events.map((event) => (
                <article key={event.id} className={!event.readAt ? 'unread' : undefined}>
                  <span>{labels[event.type]} · Week {event.simulationWeek}</span><h3>{event.headline}</h3><p>{event.summary}</p>
                  {event.actionUrl ? <Link href={event.actionUrl} onClick={() => { void update(event, 'read'); setOpen(false); }}>View details</Link> : <button onClick={() => void update(event, 'read')}>Mark read</button>}
                </article>
              )) : <p className="fo-wire-empty">The wire is quiet. Advance the franchise to generate league events.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
