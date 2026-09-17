'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import PlayerDetailsModal from '@/components/player-details-modal';
import { useTeamStore } from '@/features/team/team-store';
import type { PlayerRowDTO } from '@/types/player';
import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import styles from './trade-hub.module.css';

type Target = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  rating?: number;
  teamAbbr?: string | null;
  contractSummary: string;
  capHit: string;
  estimatedCost: string;
  tradeAvailabilityScore: number;
  availabilityLabel: string;
  whyAvailable: string[];
  depthPosition: number | null;
};

export function TradeTargetDetail({ playerId }: { playerId: string }) {
  const saveId = useSaveStore((store) => store.saveId);
  const [target, setTarget] = useState<Target | null>(null);
  const [loaded, setLoaded] = useState(false);
  const save = useSaveStore();
  const teams = useTeamStore((state) => state.teams);
  const [detailPlayer, setDetailPlayer] = useState<PlayerRowDTO | null>(null);
  const [detailRoster, setDetailRoster] = useState<PlayerRowDTO[]>([]);
  const [detailStatus, setDetailStatus] = useState('');
  const openDetails = async () => {
    if (!target?.teamAbbr || !saveId) return;
    setDetailStatus('Loading player details…');
    try {
      const response = await apiFetch('/api/trade-offers/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId, partnerTeamAbbr: target.teamAbbr }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const roster: PlayerRowDTO[] = data.partner?.players ?? [];
      const player = roster.find((entry) => entry.id === target.id);
      if (!player) throw new Error();
      setDetailRoster(roster);
      setDetailPlayer(player);
      setDetailStatus('');
    } catch {
      setDetailStatus('Player details are unavailable in this save. Please try again.');
    }
  };
  useEffect(() => {
    if (!saveId) return;
    void apiFetch(`/api/front-office/trade-hub?saveId=${encodeURIComponent(saveId)}`)
      .then(async (response) => {
        const payload = await response.json();
        setTarget((payload.targets ?? []).find((entry: Target) => entry.id === playerId) ?? null);
        setLoaded(true);
        if (typeof window !== 'undefined') {
          const key = `fo-trade-recent:${saveId}`;
          const previous = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
            playerId: string;
            timestamp: string;
          }>;
          localStorage.setItem(
            key,
            JSON.stringify(
              [
                { playerId, timestamp: new Date().toISOString() },
                ...previous.filter((entry) => entry.playerId !== playerId),
              ].slice(0, 20),
            ),
          );
        }
      })
      .catch(() => setLoaded(true));
  }, [playerId, saveId]);
  return (
    <AppShell>
      <PlayerDetailsModal
        isOpen={Boolean(detailPlayer)}
        source={detailPlayer ? { kind: 'tradeAsset', player: detailPlayer } : null}
        sources={detailRoster.map((player) => ({ kind: 'tradeAsset', player }))}
        roster={detailRoster}
        teams={teams}
        userTeamAbbr={save.teamAbbr}
        capSpace={save.capSpace}
        capLimit={save.capLimit}
        onClose={() => setDetailPlayer(null)}
        onSelectSource={(entry) => {
          if (entry.kind !== 'expiring') setDetailPlayer(entry.player);
        }}
      />
      <FrontOfficeStrategicHero
        section="Trade Hub"
        title="Trade Hub"
        description="Explore the market, build offers, and reshape your roster through trades."
      />
      <FrontOfficeSectionNav section="roster" />
      <div className={styles.detailPage}>
        <Link href="/front-office/trade-hub" className={styles.back}>
          <ArrowLeft /> Back to Trade Hub
        </Link>
        {!loaded ? (
          <div className={styles.status}>Loading target details…</div>
        ) : target ? (
          <>
            <header>
              <div className={styles.detailAvatar}>
                {target.firstName[0]}
                {target.lastName[0]}
              </div>
              <div>
                <span>
                  {target.position} · {target.teamAbbr}
                </span>
                <h2>
                  {target.firstName} {target.lastName}
                </h2>
                <p>
                  {target.age ?? '–'} years old · {target.rating ?? '–'} OVR
                </p>
              </div>
              <Link
                href={`/front-office/trade-hub/new?playerId=${encodeURIComponent(target.id)}&partnerTeamAbbr=${target.teamAbbr ?? ''}`}
              >
                Start trade <ArrowRight />
              </Link>
            </header>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => void openDetails()}
            >
              Player Details
            </button>
            {detailStatus && <p role="status">{detailStatus}</p>}
            <div className={styles.detailGrid}>
              <section>
                <h2>Market snapshot</h2>
                <dl>
                  <div>
                    <dt>Contract</dt>
                    <dd>{target.contractSummary}</dd>
                  </div>
                  <div>
                    <dt>Cap hit</dt>
                    <dd>{target.capHit}</dd>
                  </div>
                  <div>
                    <dt>Depth position</dt>
                    <dd>{target.depthPosition ? `No. ${target.depthPosition}` : 'Rotation'}</dd>
                  </div>
                  <div>
                    <dt>Estimated asking price</dt>
                    <dd>{target.estimatedCost}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>Trade availability</h2>
                <strong className={styles.availability}>
                  {target.tradeAvailabilityScore}
                  <small>/100</small>
                </strong>
                <p>{target.availabilityLabel}</p>
              </section>
              <section>
                <h2>Why he may be available</h2>
                <ul>
                  {target.whyAvailable.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : (
          <div className={styles.status}>
            This player is no longer available on the current trade market.
          </div>
        )}
      </div>
    </AppShell>
  );
}
