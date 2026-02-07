'use client';

import { useState } from 'react';

import AppShell from '@/components/app-shell';
import OfferContractModal from '@/components/offer-contract-modal';
import { PlayerTable } from '@/components/player-table';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useFreeAgentsQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import type { PlayerRowDTO } from '@/types/player';

export default function FreeAgentsPage() {
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const { data: players, refresh: refreshPlayers } = useFreeAgentsQuery(saveId, teamAbbr);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);

  const handleOfferPlayer = (player: PlayerRowDTO) => {
    setActiveOfferPlayer(player);
  };

  const handleSubmitOffer = async ({ years, apy }: { years: number; apy: number }) => {
    if (!activeOfferPlayer) {
      return;
    }

    let activeSaveId = saveId;

    if (activeSaveId) {
      const headerParams = new URLSearchParams({ saveId: activeSaveId });
      if (teamAbbr) {
        headerParams.set('teamAbbr', teamAbbr);
      }
      const headerResponse = await apiFetch(`/api/saves/header?${headerParams.toString()}`);
      if (headerResponse.status === 404) {
        activeSaveId = '';
      }
    }

    if (!activeSaveId) {
      const createResponse = await apiFetch('/api/saves/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: teamId || undefined, teamAbbr: teamAbbr || undefined }),
      });
      if (createResponse.ok) {
        const data = (await createResponse.json()) as
          | {
              ok: true;
              saveId: string;
              teamAbbr: string;
              capSpace: number;
              capLimit: number;
              rosterCount: number;
              rosterLimit: number;
              phase: string;
              unlocked?: { freeAgency: boolean; draft: boolean };
              createdAt: string;
            }
          | { ok: false; error: string };
        if ('ok' in data && data.ok) {
          activeSaveId = data.saveId;
          setSaveHeader(
            {
              ...data,
              unlocked: data.unlocked ?? { freeAgency: false, draft: false },
            },
            teamId || undefined,
          );
        }
      }
    }
    if (!activeSaveId) {
      return;
    }

    const response = await apiFetch('/api/actions/offer-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: activeSaveId,
        playerId: activeOfferPlayer.id,
        years,
        apy,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { ok?: boolean; error?: string };
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    const data = (await response.json()) as
      | { ok?: boolean; error?: string; player?: PlayerRowDTO; accepted?: boolean; reason?: string }
      | { ok?: false; error: string };

    if (!data.ok) {
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    if ('accepted' in data && data.accepted === false) {
      throw new Error(data.reason || 'Player declined the offer.');
    }

    if (!data.player) {
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);
    pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
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
