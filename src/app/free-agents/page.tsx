'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import ContractOfferModal, { type OfferResponse } from '@/components/contract-offer-modal';
import { StepHeader } from '@/components/offseason/step-header';
import { PlayerTable } from '@/components/player-table';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useFreeAgentsQuery } from '@/features/players/queries';
import { useExperienceStore } from '@/features/experience/experience-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import type { PlayerRowDTO } from '@/types/player';

export default function FreeAgentsPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const roster = useSaveStore((state) => state.roster);
  const setRoster = useSaveStore((state) => state.setRoster);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const { data, isLoading } = useFreeAgentsQuery(saveId, teamAbbr);
  const [players, setPlayers] = useState<PlayerRowDTO[]>(() => data);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const mode = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);
  const [signedCount, setSignedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'available' | 'signed'>('available');
  const firstVisibleRowLoggedRef = useRef(false);
  const tableStartedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0,
  );

  useEffect(() => {
    setPlayers(data);
  }, [data]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (firstVisibleRowLoggedRef.current || players.length === 0) return;
    firstVisibleRowLoggedRef.current = true;
    console.info('[player-list] free-agents:first-row-visible', {
      count: players.length,
      ms: Number((performance.now() - tableStartedAtRef.current).toFixed(1)),
    });
  }, [players]);

  useEffect(() => {
    if (mode === 'full' && currentStep !== 'free-agency') {
      router.replace(getRouteForStep(currentStep));
    }
  }, [mode, currentStep, router]);

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
      if (roster.length > 0) {
        const updatedPlayer = data.player;
        const exists = roster.some((item) => item.id === updatedPlayer.id);
        const nextRoster = exists
          ? roster.map((item) => (item.id === updatedPlayer.id ? updatedPlayer : item))
          : [...roster, updatedPlayer];
        setRoster(nextRoster);
      }
      if ('header' in data && data.header) {
        setSaveHeader({
          ...data.header,
          unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
        });
      }
      pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
      if (mode === 'full') {
        setSignedCount((value) => value + 1);
      }
      setTimeout(() => {
        setActiveOfferPlayer(null);
      }, 1400);
      return responsePayload;
    }

    return responsePayload;
  };

  const canContinueInFull = mode !== 'full' || signedCount > 0;

  const handleContinue = () => {
    if (mode !== 'full' || currentStep !== 'free-agency') return;
    const nextStep = completeCurrentStep();
    if (nextStep) router.push(getRouteForStep(nextStep));
  };

  const handleSkip = () => {
    if (mode !== 'full' || currentStep !== 'free-agency') return;
    const nextStep = skipCurrentStep();
    if (nextStep) router.push(getRouteForStep(nextStep));
  };

  return (
    <AppShell>
      {mode === 'full' ? (
        <StepHeader
          title="Free Agency"
          stepNumber={2}
          totalSteps={OFFSEASON_STEPS.length}
          instruction="Sign at least one player or skip to continue to the draft."
          canContinue={canContinueInFull}
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-start gap-3">
        <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            className={`rounded-full px-3 py-1 transition ${
              activeTab === 'available'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('available')}
          >
            Available
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 transition ${
              activeTab === 'signed'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('signed')}
          >
            Signed
          </button>
        </div>
      </div>
      <PlayerTable
        data={players}
        variant="freeAgent"
        loading={isLoading && players.length === 0}
        freeAgentView={activeTab}
        onOfferPlayer={handleOfferPlayer}
      />
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
          teamAbbr={teamAbbr ?? undefined}
          teamRoster={roster}
          previousTeamAbbr={activeOfferPlayer.signedTeamAbbr ?? null}
        />
      ) : null}
    </AppShell>
  );
}
