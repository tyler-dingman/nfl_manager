'use client';

import { useEffect, useState } from 'react';
import styles from './parlay-lab-test.module.css';

type Price = { sportsbook: string; odds: number | null; available: boolean; deeplink: string | null; normalizedKey: string };
type Ticket = { event: { providerEventId: string; kickoffAt: string }; legs: Array<{ id: string; label: string; prices: Price[] }>; note: string };
const books = ['FANDUEL', 'DRAFTKINGS'];

export default function ParlayLabTestPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/parlay-lab/test-ticket').then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; }).then(setTicket).catch((reason) => setError(reason.message)); }, []);
  return <main className={styles.page}>
    <p className={styles.eyebrow}>The Parlay Bus</p><h1>The Parlay Bus — Dev Test</h1><h2>DEN @ KC</h2>
    {error ? <div className={styles.notice}>{error}<small>Run the migration and import the 2026 test week first.</small></div> : null}
    {!ticket && !error ? <div className={styles.notice}>Loading local odds…</div> : null}
    {ticket ? <>
      <p className={styles.meta}>Provider event: {ticket.event.providerEventId} · {new Date(ticket.event.kickoffAt).toLocaleString()}</p>
      <section className={styles.legs}>{ticket.legs.map((leg, index) => <article key={leg.id}><small>Leg {index + 1}</small><h3>{leg.label}</h3><div>{books.map((book) => { const price = leg.prices.find((item) => item.sportsbook === book); return <section key={book}><b>{book === 'FANDUEL' ? 'FanDuel' : 'DraftKings'}</b><strong>{price?.available && price.odds !== null ? (price.odds > 0 ? '+' : '') + price.odds : 'Not available'}</strong>{price?.deeplink && price.available ? <a href={price.deeplink} target="_blank" rel="noreferrer">Open in {book === 'FANDUEL' ? 'FanDuel' : 'DraftKings'}</a> : <button disabled>Deeplink unavailable</button>}</section>; })}</div></article>)}</section>
      <section className={styles.compare}><h2>Sportsbook comparison</h2><table><thead><tr><th>Leg</th>{books.map((book) => <th key={book}>{book}</th>)}</tr></thead><tbody>{ticket.legs.map((leg) => <tr key={leg.id}><td>{leg.label}</td>{books.map((book) => { const price = leg.prices.find((item) => item.sportsbook === book); return <td key={book}>{price?.available && price.odds !== null ? (price.odds > 0 ? '+' : '') + price.odds : 'NOT AVAILABLE'}</td>; })}</tr>)}</tbody></table><p>{ticket.note}</p></section>
    </> : null}
  </main>;
}
