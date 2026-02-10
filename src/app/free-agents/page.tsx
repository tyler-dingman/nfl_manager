'use client';

import { useEffect, useState } from 'react';

import AppShell from '@/components/app-shell';
import ContractOfferModal, { type OfferResponse } from '@/components/contract-offer-modal';
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
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const { data } = useFreeAgentsQuery(saveId, teamAbbr);
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);

  useEffect(() => {
    setPlayers(data);
  }, [data]);

  const handleOfferPlayer = (player: PlayerRowDTO) => {
    setActiveOfferPlayer(player);
  };

  const handleSubmitOffer = async ({
    years,
    apy,
    guaranteed,
  }: {
    years: number;
    apy: number;
    guaranteed: number;
  }): Promise<OfferResponse | void> => {
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
        guaranteed,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { ok?: boolean; error?: string };
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    const data = (await response.json()) as
      | {
          ok?: boolean;
          error?: string;
          player?: PlayerRowDTO;
          accepted?: boolean;
          reason?: string;
          interestScore?: number;
          tone?: OfferResponse['tone'];
          message?: string;
          notice?: string;
          header?: {
            id: string;
            teamAbbr: string;
            capSpace: number;
            capLimit: number;
            rosterCount: number;
            rosterLimit: number;
            phase: string;
            unlocked?: { freeAgency: boolean; draft: boolean };
            createdAt: string;
          };
        }
      | { ok?: false; error: string };

    if (!data.ok) {
      throw new Error(data.error || 'Unable to submit offer right now.');
    }

    const responsePayload: OfferResponse = {
      accepted: Boolean(data.accepted),
      tone: data.tone ?? (data.accepted ? 'positive' : 'neutral'),
      message:
        data.message ?? (data.accepted ? 'Woohoo! Fly Eagles Fly baby!' : 'Thanks for the offer.'),
      notice:
        data.notice ??
        `${activeOfferPlayer.firstName} ${activeOfferPlayer.lastName} ${
          data.accepted ? 'has accepted offer' : 'has declined offer'
        }`,
    };

    if (data.accepted && data.player) {
      setPlayers((prev) => prev.map((item) => (item.id === data.player?.id ? data.player : item)));
      if ('header' in data && data.header) {
        setSaveHeader({
          ...data.header,
          unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
        });
      }
      pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
      setTimeout(() => {
        setActiveOfferPlayer(null);
      }, 1400);
      return responsePayload;
    }

    return responsePayload;
  };

  return (
    <AppShell>
      <PlayerTable data={players} variant="freeAgent" onOfferPlayer={handleOfferPlayer} />
      {activeOfferPlayer ? (
        <ContractOfferModal
          player={activeOfferPlayer}
          isOpen={Boolean(activeOfferPlayer)}
          onClose={() => setActiveOfferPlayer(null)}
          onSubmit={handleSubmitOffer}
          title={`Sign ${activeOfferPlayer.firstName} ${activeOfferPlayer.lastName}`}
          subtitle="Set contract terms and gauge interest."
          submitLabel="Submit Offer"
          expectedApyOverride={
            activeOfferPlayer.marketValue !== null && activeOfferPlayer.marketValue !== undefined
              ? activeOfferPlayer.marketValue / 1_000_000
              : undefined
          }
          scoreVariant="freeAgency"
        />
      ) : null}
    </AppShell>
  );
}
