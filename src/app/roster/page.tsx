'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import { PlayerTable } from '@/components/player-table';
import ResignPlayerModal from '@/components/resign-player-modal';
import ResignOfferResultModal from '@/components/resign-offer-result-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { fetchExpiringContracts } from '@/features/contracts/queries';
import { useRosterQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import type { ResignResultDTO } from '@/types/resign';

const formatMillions = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const phase = useSaveStore((state) => state.phase);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const { data: players, refresh: refreshPlayers } = useRosterQuery(saveId);
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeResignPlayer, setActiveResignPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeExpiringContract, setActiveExpiringContract] = useState<ExpiringContractRow | null>(
    null,
  );
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [resignResult, setResignResult] = useState<ResignResultDTO | null>(null);
  const [isResignResultOpen, setIsResignResultOpen] = useState(false);
  const { push: pushToast } = useToast();

  const handleSubmitCut = async () => {
    if (!saveId || !activeCutPlayer) {
      return;
    }

    const response = await fetch('/api/actions/cut-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        playerId: activeCutPlayer.id,
        teamId: teamId || undefined,
        teamAbbr: teamAbbr || undefined,
      }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      header?: {
        id: string;
        teamAbbr: string;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        createdAt: string;
      };
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.header) {
      setSaveHeader(data.header);
    }

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);
  };

  useEffect(() => {
    if (phase !== 'resign_cut') {
      return;
    }

    let isActive = true;
    setExpiringError(null);

    fetchExpiringContracts(saveId)
      .then((rows) => {
        if (!isActive) return;
        setExpiringContracts(rows);
      })
      .catch((error) => {
        if (!isActive) return;
        setExpiringError(error instanceof Error ? error.message : 'Unable to load contracts.');
      });

    return () => {
      isActive = false;
    };
  }, [phase, saveId]);

  const expiringResignPlayer = useMemo<PlayerRowDTO | null>(() => {
    if (!activeExpiringContract) {
      return null;
    }

    const nameParts = activeExpiringContract.name.split(' ');
    const firstName = nameParts[0] ?? activeExpiringContract.name;
    const lastName = nameParts.slice(1).join(' ') || activeExpiringContract.name;

    return {
      id: activeExpiringContract.id,
      firstName,
      lastName,
      position: activeExpiringContract.pos,
      contractYearsRemaining: 0,
      capHit: '',
      status: 'expiring',
    };
  }, [activeExpiringContract]);

  const handleSubmitResign = async (offer: { years: number; apy: number; guaranteed: number }) => {
    if (!saveId || (!activeResignPlayer && !activeExpiringContract)) {
      return;
    }

    const playerId = activeResignPlayer?.id ?? activeExpiringContract?.id;
    if (!playerId) {
      return;
    }

    const response = await fetch('/api/actions/re-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        teamAbbr,
        playerId,
        years: offer.years,
        apy: offer.apy,
        guaranteed: offer.guaranteed,
      }),
    });

    const data = (await response.json()) as ResignResultDTO | { ok: false; error: string };
    if (!response.ok || !data.ok) {
      throw new Error(!data.ok ? data.error : 'Unable to re-sign player.');
    }

    setResignResult(data);
    setIsResignResultOpen(true);
    pushToast({
      title: data.accepted ? 'Offer accepted' : 'Offer declined',
      description: data.accepted ? data.newsItem.details : 'The player decided to test the market.',
      variant: data.accepted ? 'success' : 'error',
    });

    await Promise.all([
      refreshSaveHeader(),
      refreshPlayers(),
      fetchExpiringContracts(saveId).then(setExpiringContracts),
    ]);

    setActiveResignPlayer(null);
    setActiveExpiringContract(null);
  };

  return (
    <AppShell>
      {phase === 'resign_cut' ? (
        <div className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Expiring Contracts</h2>
              <p className="text-sm text-muted-foreground">
                Players with 0 years remaining are eligible to re-sign.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse md:min-w-[720px]">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 sm:px-6">Player</th>
                  <th className="px-4 py-2 sm:px-6">Pos</th>
                  <th className="px-4 py-2 sm:px-6">Expected APY</th>
                  <th className="px-4 py-2 sm:px-6">Expected Total</th>
                  <th className="px-4 py-2 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expiringContracts.map((player) => (
                  <tr key={player.id} className="border-t border-border hover:bg-slate-50/60">
                    <td className="px-4 py-1.5 text-sm font-semibold text-foreground sm:px-6">
                      {player.name}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                      {player.pos}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                      {formatMillions(player.estValue)}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                      {formatMillions(player.maxValue)}
                    </td>
                    <td className="px-4 py-1.5 text-right sm:px-6">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setActiveExpiringContract(player)}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Re-sign {player.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expiringError ? (
            <div className="px-4 py-4 text-sm text-destructive sm:px-6">{expiringError}</div>
          ) : null}
        </div>
      ) : null}
      <PlayerTable
        data={players}
        variant="roster"
        onCutPlayer={setActiveCutPlayer}
        onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
      />
      {activeCutPlayer ? (
        <CutPlayerModal
          player={activeCutPlayer}
          isOpen={Boolean(activeCutPlayer)}
          currentCapSpace={capSpace}
          onClose={() => setActiveCutPlayer(null)}
          onSubmit={handleSubmitCut}
        />
      ) : null}
      {activeResignPlayer ? (
        <ResignPlayerModal
          player={activeResignPlayer}
          expectedApyOverride={activeResignPlayer.contract?.apy}
          isOpen={Boolean(activeResignPlayer)}
          onClose={() => setActiveResignPlayer(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      {expiringResignPlayer && activeExpiringContract ? (
        <ResignPlayerModal
          player={expiringResignPlayer}
          contractRange={{
            estValue: activeExpiringContract.estValue,
            maxValue: activeExpiringContract.maxValue,
          }}
          expectedApyOverride={activeExpiringContract.estValue / 1_000_000}
          isOpen={Boolean(activeExpiringContract)}
          onClose={() => setActiveExpiringContract(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      <ResignOfferResultModal
        result={resignResult}
        isOpen={isResignResultOpen}
        onClose={() => setIsResignResultOpen(false)}
      />
    </AppShell>
  );
}
