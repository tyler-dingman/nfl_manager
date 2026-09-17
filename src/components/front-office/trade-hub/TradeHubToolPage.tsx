'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import styles from './trade-hub.module.css';

type HubPayload = {
  targets: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    teamAbbr: string;
    rating: number;
    estimatedCost: string;
    availabilityLabel: string;
  }>;
  tradeEvents: Array<{ id: string; headline: string; summary: string; type: string }>;
  recentTrades: Array<{ id: string; fromTeamAbbr?: string; toTeamAbbr?: string }>;
  deadline: { passed: boolean };
};
const titles: Record<string, [string, string]> = {
  partners: [
    'Find Trade Partners',
    'Select a marketable player and explore teams that fit his position, value, and contract.',
  ],
  finder: [
    'Trade Finder',
    'Search the live market in either direction and start a realistic offer.',
  ],
  offers: [
    'My Trade Offers',
    'Review the offers and trade conversations generated in this saved league.',
  ],
  block: ['Trade Block', 'Review available players and identify assets to actively shop.'],
  recent: ['Recently Viewed', 'Return to trade targets you recently inspected.'],
  activity: ['League Trade Activity', 'Track completed transactions from this saved season.'],
};
export function TradeHubToolPage({ tool }: { tool: string }) {
  const saveId = useSaveStore((store) => store.saveId);
  const [data, setData] = useState<HubPayload | null>(null);
  useEffect(() => {
    if (!saveId) return;
    void apiFetch(`/api/front-office/trade-hub?saveId=${encodeURIComponent(saveId)}`)
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData(null));
  }, [saveId]);
  const recentIds = useMemo(() => {
    if (typeof window === 'undefined' || !saveId) return new Set<string>();
    try {
      return new Set<string>(
        (
          JSON.parse(localStorage.getItem(`fo-trade-recent:${saveId}`) ?? '[]') as Array<{
            playerId: string;
          }>
        ).map((entry) => entry.playerId),
      );
    } catch {
      return new Set<string>();
    }
  }, [saveId]);
  const copy = titles[tool] ?? ['Trade Hub', 'Explore the current trade market.'];
  const rows = (data?.targets ?? [])
    .filter((target) => tool !== 'recent' || recentIds.has(target.id))
    .slice(0, 20);
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Trade Hub"
        title="Trade Hub"
        description="Explore the market, build offers, and reshape your roster through trades."
      />
      <FrontOfficeSectionNav section="roster" />
      <div className={styles.toolPage}>
        <Link className={styles.back} href="/front-office/trade-hub">
          <ArrowLeft /> Back to Trade Hub
        </Link>
        <header>
          <h2>{copy[0]}</h2>
          <p>{copy[1]}</p>
        </header>
        {!data ? (
          <div className={styles.status}>Loading trade intelligence…</div>
        ) : tool === 'activity' ? (
          <section className={styles.toolPanel}>
            {data.recentTrades.length ? (
              data.recentTrades.map((trade) => (
                <article key={trade.id}>
                  <strong>
                    {trade.fromTeamAbbr} → {trade.toTeamAbbr}
                  </strong>
                  <span>Completed trade</span>
                </article>
              ))
            ) : (
              <p>No completed trades in this save yet.</p>
            )}
          </section>
        ) : tool === 'offers' ? (
          <section className={styles.toolPanel}>
            {data.tradeEvents.length ? (
              data.tradeEvents.map((event) => (
                <article key={event.id}>
                  <div>
                    <b>{event.type.replaceAll('_', ' ')}</b>
                    <strong>{event.headline}</strong>
                    <p>{event.summary}</p>
                  </div>
                </article>
              ))
            ) : (
              <p>No active offers or trade conversations.</p>
            )}
          </section>
        ) : (
          <section className={styles.toolPanel}>
            {rows.length ? (
              rows.map((target) => (
                <article key={target.id}>
                  <div>
                    <strong>
                      {target.firstName} {target.lastName}
                    </strong>
                    <span>
                      {target.position} · {target.teamAbbr} · {target.rating} OVR
                    </span>
                  </div>
                  <span>
                    {target.availabilityLabel}
                    <small>{target.estimatedCost}</small>
                  </span>
                  <Link href={`/front-office/trade-hub/player/${target.id}`}>
                    View player <ArrowRight />
                  </Link>
                </article>
              ))
            ) : (
              <p>No matching players yet.</p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
