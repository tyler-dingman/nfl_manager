'use client';

import { useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/app-shell';
import OfferContractModal from '@/components/offer-contract-modal';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import { useTeamStore } from '@/features/team/team-store';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

const DEFAULT_HEADER: SaveHeaderDTO = {
  id: '',
  teamAbbr: 'PHI',
  capSpace: 50.0,
  capLimit: 255.4,
  rosterCount: 51,
  rosterLimit: 53,
  createdAt: new Date().toISOString(),
};

export default function FreeAgentsPage() {
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const [saveHeader, setSaveHeader] = useState<SaveHeaderDTO>(DEFAULT_HEADER);
  const [saveId, setSaveId] = useState<string>('');
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);

  const headerSummary = useMemo(() => {
    if (!saveHeader.id) {
      return DEFAULT_HEADER;
    }

    return saveHeader;
  }, [saveHeader]);

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
      setSaveHeader(data);
      setSaveId(data.id);
    };

    loadSave();
  }, [selectedTeam?.abbr]);

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

    setSaveHeader(data.header);
    setPlayers((prev) =>
      prev.map((player) => (player.id === data.player.id ? data.player : player)),
    );
  };

  return (
    <AppShell>
      <TeamHeaderSummary
        capSpace={headerSummary.capSpace}
        capLimit={headerSummary.capLimit}
        rosterCount={headerSummary.rosterCount}
        rosterLimit={headerSummary.rosterLimit}
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
