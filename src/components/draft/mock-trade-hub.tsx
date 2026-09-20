'use client';
import * as React from 'react';
import Image from 'next/image';
import { DraftPickTile } from './draft-pick-tile';
import {
  useDraftTradeNotifications,
  unreadDraftOffers,
} from '@/features/draft/trade-notifications';
import { apiFetch } from '@/lib/api';
import {
  evaluateMockPackage,
  evaluateMockProposal,
  mockTradeAssets,
  tradeYear,
} from '@/lib/mock-draft-trades';
import { orderedMockOffers } from '@/lib/mock-trade-presentation';
import { getPickTradeValue } from '@/lib/trade-chart';
import { DraftDialog } from './live-draft-panels';
import type { DraftSessionDTO } from '@/types/draft';
import type { TeamDTO } from '@/types/team';
import styles from '@/app/draft/room/mock-draft-room.module.css';

type Props = {
  session: DraftSessionDTO;
  teams: TeamDTO[];
  saveId: string;
  saveSnapshot: unknown;
  onUpdate: (session: DraftSessionDTO) => void;
  onBusy: (busy: boolean) => void;
  openRequest: number;
  busy?: boolean;
  onReveal: () => void;
};
export function MockTradeHub({
  session,
  teams,
  saveId,
  saveSnapshot,
  onUpdate,
  onBusy,
  openRequest,
  busy = false,
  onReveal,
}: Props) {
  const notifications = useDraftTradeNotifications();
  const unread = unreadDraftOffers(notifications);
  const revealRef = React.useRef(onReveal);
  revealRef.current = onReveal;
  const hubRef = React.useRef<HTMLElement>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'incoming' | 'propose' | 'picks' | 'history'>('propose');
  const [partner, setPartner] = React.useState(
    teams.find((t) => t.abbr !== session.userTeamAbbr)?.abbr ?? '',
  );
  const [send, setSend] = React.useState<string[]>([]),
    [receive, setReceive] = React.useState<string[]>([]);
  const [counter, setCounter] = React.useState<string>();
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [chart, setChart] = React.useState(false),
    [chartRound, setChartRound] = React.useState(1);
  const assets = mockTradeAssets(session);
  const offers = orderedMockOffers(session);
  const active = offers.filter((o) => o.valid).map((o) => o.offer);
  const team = (abbr: string) => teams.find((t) => t.abbr === abbr);
  React.useEffect(() => {
    if (openRequest) setTab('propose');
  }, [openRequest]);
  React.useEffect(() => {
    const fresh = useDraftTradeNotifications.getState().sync(session);
    if (!fresh.length) return;
    const bounds = hubRef.current?.getBoundingClientRect();
    if (tab === 'incoming' && bounds && bounds.top >= 0 && bounds.top < window.innerHeight - 100) {
      useDraftTradeNotifications.getState().markRead(fresh);
      setHighlight(fresh[fresh.length - 1]);
    } else useDraftTradeNotifications.setState({ toastId: fresh[fresh.length - 1] });
  }, [session, tab]);
  React.useEffect(
    () => () => useDraftTradeNotifications.getState().clear(session.id),
    [session.id],
  );
  React.useEffect(() => {
    if (!notifications.request) return;
    const id = notifications.request.offerId;
    setTab('incoming');
    setHighlight(id);
    revealRef.current();
    const timer = window.setTimeout(() => {
      const card = document.getElementById(`draft-offer-${id}`);
      card?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
      card?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [notifications.request]);
  React.useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 5000);
    return () => clearTimeout(timer);
  }, [highlight]);
  const request = async (body: Record<string, unknown>) => {
    if (pending || busy) return;
    setPending(true);
    onBusy(true);
    setMessage('');
    try {
      const response = await apiFetch(
        '/api/draft/trade-hub',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId,
            draftSessionId: session.id,
            sessionSnapshot: session,
            saveSnapshot,
            ...body,
          }),
        },
        { skipSaveGuard: true },
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Unable to process trade.');
      onUpdate(payload.session);
      useDraftTradeNotifications.getState().sync(payload.session);
      setMessage(
        payload.reason ||
          (payload.outcome === 'accepted'
            ? 'Trade accepted. Pick ownership updated.'
            : 'Offer declined.'),
      );
      if (payload.outcome === 'accepted' || payload.outcome === 'countered') {
        setTab('incoming');
        setSend([]);
        setReceive([]);
        setCounter(undefined);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to process trade.');
    } finally {
      setPending(false);
      onBusy(false);
    }
  };
  const names = (ids: string[]) =>
    ids.map(
      (id) => mockTradeAssets(session, true).find((a) => a.id === id)?.label ?? 'Unavailable pick',
    );
  const selectedSend = assets.filter(
      (a) => send.includes(a.id) && a.owningTeamAbbr === session.userTeamAbbr,
    ),
    selectedReceive = assets.filter((a) => receive.includes(a.id) && a.owningTeamAbbr === partner);
  const value = evaluateMockPackage(selectedSend, selectedReceive, tradeYear(session));
  let preview: ReturnType<typeof evaluateMockProposal> | undefined;
  let validation = '';
  try {
    if (session.status !== 'in_progress') throw new Error('This draft is complete.');
    if (counter && !active.some((o) => o.id === counter))
      throw new Error('This negotiation has expired.');
    preview = evaluateMockProposal(session, partner, send, receive);
  } catch (error) {
    validation = error instanceof Error ? error.message : 'Select a valid package.';
  }
  const original = session.tradeState?.offers.find((o) => o.id === counter);
  const builder = (
    owner: string,
    ids: string[],
    setter: (ids: string[]) => void,
    label: string,
  ) => {
    const picks = assets.filter((p) => p.owningTeamAbbr === owner);
    return (
      <fieldset className={styles.tradePickSide}>
        <legend>
          {label} · {owner}
        </legend>
        {Array.from(new Set(picks.map((p) => p.year)))
          .sort()
          .map((year) => (
            <section key={year}>
              <h4>{year}</h4>
              <div
                className={styles.pickChips}
                data-known={picks.some((p) => p.year === year && p.overallSlot != null)}
              >
                {picks
                  .filter((p) => p.year === year)
                  .map((p) => (
                    <DraftPickTile
                      key={p.id}
                      ownerTeamId={p.owningTeamAbbr}
                      originalOwnerTeamId={p.originalTeamAbbr}
                      year={p.year}
                      round={p.round}
                      overallPick={p.overallSlot}
                      selected={ids.includes(p.id)}
                      disabled={pending || busy || (!ids.includes(p.id) && ids.length >= 3)}
                      onClick={() =>
                        setter(
                          ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
                        )
                      }
                    />
                  ))}
              </div>
            </section>
          ))}
        {!picks.length && <p>No available picks.</p>}
        <div className={styles.selectedPackage}>
          <b>Selected · {ids.length}/3</b>
          {names(ids).map((name, i) => (
            <p key={ids[i]}>{name}</p>
          ))}
          {!ids.length && <p>Select picks above.</p>}
        </div>
      </fieldset>
    );
  };
  const valuation = (v: ReturnType<typeof evaluateMockPackage>) => (
    <div>
      <b>Trade Value</b>
      <p>
        {session.userTeamAbbr} sends: {v.sent.toFixed(0)}
      </p>
      <p>Receives: {v.received.toFixed(0)}</p>
      <p data-positive={v.difference >= 0}>
        {v.difference >= 0 ? '+' : ''}
        {v.difference.toFixed(0)} ({v.sent ? ((v.difference / v.sent) * 100).toFixed(1) : '0'}%)
      </p>
      <small>Received / sent: {Math.round(v.ratio * 100)}%</small>
    </div>
  );
  return (
    <aside ref={hubRef} className={`${styles.workspacePanel} ${styles.tradeHub}`}>
      <header>
        <h2>Trade Hub</h2>
        <button type="button" onClick={() => setChart(true)}>
          Trade Value Chart ↗
        </button>
      </header>
      <div className={styles.tradeHubTabs} role="tablist" aria-label="Trade Hub">
        {(['propose', 'incoming', 'picks', 'history'] as const).map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              if (t === 'incoming') notifications.markRead(active.map((o) => o.id));
            }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const buttons = Array.from(
                event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                  '[role=tab]',
                ),
              );
              const index = buttons.indexOf(event.currentTarget);
              buttons[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) %
                      buttons.length
              ]?.focus();
            }}
          >
            {t === 'propose' ? (
              'Propose a Trade'
            ) : t === 'incoming' ? (
              <>
                Trade Offers{' '}
                {unread > 0 && (
                  <b aria-label={`${unread} unread trade offers`}>{unread > 9 ? '9+' : unread}</b>
                )}
              </>
            ) : t === 'picks' ? (
              'Your Picks'
            ) : (
              'Trade History'
            )}
          </button>
        ))}
      </div>
      {message && (
        <p className={styles.tradeMessage} role="status">
          {message}
        </p>
      )}
      <div className={styles.tradeHubBody}>
        {tab === 'incoming' && (
          <>
            <h3>Trade Offers</h3>
            <p className={styles.tradeHelp}>
              Review offers from other teams. You can accept, counter, or decline.
            </p>
            {!active.length && (
              <p className={styles.tradeEmpty}>
                No active trade offers. Other teams may contact you as the draft develops. You can
                keep drafting or propose your own trade.
              </p>
            )}
            {!active.length && (
              <button className={styles.proposeTradeLink} onClick={() => setTab('propose')}>
                Propose a Trade
              </button>
            )}
            {offers.map(
              ({
                offer: o,
                send: outgoing,
                receive: incoming,
                valid,
                value: assessment,
                expiration,
              }) => (
                <article
                  className={styles.tradeOfferCard}
                  key={o.id}
                  data-expired={!valid}
                  id={`draft-offer-${o.id}`}
                  tabIndex={-1}
                  data-highlight={highlight === o.id}
                >
                  <div className={styles.tradeOfferTitle}>
                    {team(o.team)?.logoUrl && (
                      <Image
                        src={team(o.team)!.logoUrl}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                      />
                    )}
                    <strong>
                      {team(o.team)?.name ?? o.team}{' '}
                      {o.originalPackage
                        ? 'counteroffer'
                        : `want to ${o.intent === 'move_up' ? 'move up' : 'move back'}`}
                    </strong>
                    <span data-value={assessment.label}>{assessment.label}</span>
                  </div>
                  <p className={styles.tradeHelp}>{o.reason}</p>
                  <small className={styles.offerExpiry}>{expiration}</small>
                  {o.originalPackage && (
                    <details>
                      <summary>Compare with original proposal</summary>
                      <p>You send: {names(o.originalPackage.send).join(', ')}</p>
                      <p>You receive: {names(o.originalPackage.receive).join(', ')}</p>
                    </details>
                  )}
                  <div className={styles.tradeOfferSides}>
                    <div>
                      <b>{o.team} receives:</b>
                      {outgoing.map((p) => (
                        <p
                          key={p.id}
                          data-changed={
                            !!o.originalPackage && !o.originalPackage.send.includes(p.id)
                          }
                        >
                          {p.label}
                        </p>
                      ))}
                    </div>
                    <div>
                      <b>{session.userTeamAbbr} receives:</b>
                      {incoming.map((p) => (
                        <p
                          key={p.id}
                          data-changed={
                            !!o.originalPackage && !o.originalPackage.receive.includes(p.id)
                          }
                        >
                          {p.label}
                        </p>
                      ))}
                    </div>
                    {valuation(assessment)}
                  </div>
                  <div className={styles.tradeOfferActions}>
                    <button
                      disabled={pending || busy || !valid}
                      onClick={() => void request({ action: 'accept', offerId: o.id })}
                    >
                      {o.originalPackage ? 'Accept Counter' : 'Accept'}
                    </button>
                    <button
                      disabled={pending || busy || !valid}
                      onClick={() => {
                        notifications.markRead([o.id]);
                        setPartner(o.team);
                        setSend(o.send);
                        setReceive(o.receive);
                        setCounter(o.id);
                        setTab('propose');
                        setMessage('');
                      }}
                    >
                      {o.originalPackage ? 'Modify' : 'Counter'}
                    </button>
                    <button
                      disabled={pending || busy || !valid}
                      onClick={() => void request({ action: 'decline', offerId: o.id })}
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ),
            )}
          </>
        )}
        {tab === 'propose' && (
          <div className={styles.tradeBuilder}>
            <h3>Propose a Trade</h3>
            <label>
              Trade partner
              <span className={styles.tradePartnerSelector}>
                {team(partner)?.logoUrl && (
                  <Image
                    className={styles.tradePartnerLogo}
                    src={team(partner)!.logoUrl}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                  />
                )}
                <select
                  aria-label="Trade partner"
                  value={partner}
                  onChange={(e) => {
                    setPartner(e.target.value);
                    setReceive([]);
                    setCounter(undefined);
                  }}
                >
                  {teams
                    .filter((t) => t.abbr !== session.userTeamAbbr)
                    .map((t) => (
                      <option key={t.abbr} value={t.abbr}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </span>
            </label>
            {original && (
              <details open>
                <summary>Original offer</summary>
                <p>You send: {names(original.send).join(', ')}</p>
                <p>You receive: {names(original.receive).join(', ')}</p>
              </details>
            )}
            <div className={styles.tradeBuilderSides}>
              {builder(session.userTeamAbbr, send, setSend, 'You send')}
              {builder(partner, receive, setReceive, 'You receive')}
            </div>
            <div className={styles.tradeValuation}>
              {valuation(value)}
              <div>
                <strong>{preview ? value.label : 'Select both sides'}</strong>
                {preview ? (
                  <>
                    <p>CPU Interest: {preview.interestLabel}</p>
                    <meter min={0} max={4} value={preview.interest} aria-label="CPU interest" />
                    <p>{preview.explanation}</p>
                    <small>
                      Interest reflects the team’s valuation, not an acceptance probability.
                    </small>
                  </>
                ) : (
                  <p>{validation}</p>
                )}
              </div>
            </div>
            <button
              className={styles.tradeSubmit}
              disabled={
                pending ||
                busy ||
                !preview ||
                !send.length ||
                !receive.length ||
                selectedSend.length !== send.length ||
                selectedReceive.length !== receive.length
              }
              onClick={() =>
                void request({
                  action: 'propose',
                  team: partner,
                  send,
                  receive,
                  counterId: counter,
                })
              }
            >
              {pending ? 'Evaluating…' : counter ? 'Send Counter' : 'Propose Trade'}
            </button>
          </div>
        )}
        {tab === 'history' && (
          <>
            <h3>Completed Trades</h3>
            {!session.tradeState?.history.length && (
              <p className={styles.tradeEmpty}>No completed trades yet.</p>
            )}
            {session.tradeState?.history.map((entry, index) => (
              <article className={styles.tradeOfferCard} key={entry.id}>
                <h4>
                  Trade {index + 1} · {session.userTeamAbbr} &amp; {entry.team}
                </h4>
                <small>Completed at Pick {entry.pick + 1}</small>
                <div className={styles.tradeOfferSides}>
                  <div>
                    <b>{entry.team} received</b>
                    {entry.send.map((p) => (
                      <p key={p.id}>{p.label}</p>
                    ))}
                  </div>
                  <div>
                    <b>{session.userTeamAbbr} received</b>
                    {entry.receive.map((p) => (
                      <p key={p.id}>{p.label}</p>
                    ))}
                  </div>
                  {valuation(
                    entry.valuation ??
                      evaluateMockPackage(entry.send, entry.receive, tradeYear(session)),
                  )}
                </div>
              </article>
            ))}
          </>
        )}
        {tab === 'picks' && (
          <>
            {Array.from(
              new Set(
                assets.filter((p) => p.owningTeamAbbr === session.userTeamAbbr).map((p) => p.year),
              ),
            )
              .sort()
              .map((year) => (
                <section className={styles.ownedPicks} key={year}>
                  <h3>{year}</h3>
                  {assets
                    .filter((p) => p.year === year && p.owningTeamAbbr === session.userTeamAbbr)
                    .map((p) => (
                      <p key={p.id}>
                        Round {p.round}
                        {year === tradeYear(session) ? ` · Pick ${p.overallSlot}` : ''}
                        {p.originalTeamAbbr !== session.userTeamAbbr
                          ? ` · via ${p.originalTeamAbbr}`
                          : ''}
                      </p>
                    ))}
                </section>
              ))}
            <small>Future picks use projected mid-round values, discounted by year.</small>
          </>
        )}
      </div>
      {chart && (
        <DraftDialog title="Draft Trade Value Chart" onClose={() => setChart(false)}>
          <label>
            Round{' '}
            <select value={chartRound} onChange={(e) => setChartRound(Number(e.target.value))}>
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <p>
            Existing DraftTek-style chart. Future picks use the shared year and round discounts,
            with projected mid-round positions.
          </p>
          <table className={styles.tradeChart}>
            <thead>
              <tr>
                <th>Pick</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 32 }, (_, i) => {
                const pick = (chartRound - 1) * 32 + i + 1;
                return (
                  <tr key={pick}>
                    <td>{pick}</td>
                    <td>{getPickTradeValue({ round: chartRound, overallSlot: pick })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DraftDialog>
      )}
    </aside>
  );
}
