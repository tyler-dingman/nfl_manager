'use client';

import { useEffect, useState } from 'react';

import AppShell from '@/components/app-shell';
import OfferContractModal from '@/components/offer-contract-modal';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

export default function FreeAgentsPage() {
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const saveId = useSaveStore((state) => state.saveId);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);

  useEffect(() => {
    const loadSave = async () => {
      if (!selectedTeam?.abbr) {
        return;
      }

      const response = await fetch('/api/saves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAbbr: selectedTeam.abbr }),
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as SaveHeaderDTO;
      setSaveHeader(data, selectedTeam.id);
    };

    loadSave();
  }, [selectedTeam?.abbr, selectedTeam?.id, setSaveHeader]);

  useEffect(() => {
    const loadFreeAgents = async () => {
      if (!saveId) {
        return;
      }

      const response = await fetch(`/api/free-agents?saveId=${saveId}`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as PlayerRowDTO[];
      setPlayers(data);
    };

    loadFreeAgents();
  }, [saveId]);

  const handleOfferPlayer = (player: PlayerRowDTO) => {
    setActiveOfferPlayer(player);
  };

  const handleSubmitOffer = async ({
    years,
    apy,
  }: {
    years: number;
    apy: number;
  }) => {
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
      throw new Error('Offer failed');
    }

    const data = (await response.json()) as {
      header: SaveHeaderDTO;
      player: PlayerRowDTO;
    };

    setPlayers((prev) =>
      prev.map((player) => (player.id === data.player.id ? data.player : player)),
    );
    await refreshSaveHeader();
  };

  return (
    <AppShell>
      <TeamHeaderSummary
        capSpace={capSpace}
        capLimit={capLimit}
        rosterCount={rosterCount}
        rosterLimit={rosterLimit}
      />
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
