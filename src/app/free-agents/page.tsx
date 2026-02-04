'use client';

import { useState } from 'react';

import AppShell from '@/components/app-shell';
import OfferContractModal from '@/components/offer-contract-modal';
import { PlayerTable } from '@/components/player-table';
import { useFreeAgentsQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import type { PlayerRowDTO } from '@/types/player';

export default function FreeAgentsPage() {
  const saveId = useSaveStore((state) => state.saveId);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const { data: players, refresh: refreshPlayers } = useFreeAgentsQuery(saveId);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);

  const handleOfferPlayer = (player: PlayerRowDTO) => {
    setActiveOfferPlayer(player);
  };

  const handleSubmitOffer = async ({ years, apy }: { years: number; apy: number }) => {
    if (!saveId || !activeOfferPlayer) {
      return;
    }

    const response = await fetch('/api/actions/offer-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        playerId: activeOfferPlayer.id,
        years,
        apy,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { ok?: boolean; error?: string };
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      player?: PlayerRowDTO;
    };

    if (!data.ok || !data.player) {
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);
  };

  return (
    <AppShell>
      <PlayerTable data={players} variant="freeAgent" onOfferPlayer={handleOfferPlayer} />
      {activeOfferPlayer ? (
        <OfferContractModal
          player={activeOfferPlayer}
          isOpen={Boolean(activeOfferPlayer)}
          onClose={() => setActiveOfferPlayer(null)}
          onSubmit={handleSubmitOffer}
        />
      ) : null}
    </AppShell>
  );
}
