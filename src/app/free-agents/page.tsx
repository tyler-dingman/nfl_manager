'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import ContractOfferModal, { type OfferResponse } from '@/components/contract-offer-modal';
import { StepHeader } from '@/components/offseason/step-header';
import { PlayerTable } from '@/components/player-table';
import { useToast } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useFreeAgentsQuery } from '@/features/players/queries';
import { useTradeOfferOrchestrator } from '@/features/trades/use-trade-offer-orchestrator';
import { useExperienceStore } from '@/features/experience/experience-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import type { PlayerRowDTO } from '@/types/player';

export default function FreeAgentsPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const roster = useSaveStore((state) => state.roster);
  const setRoster = useSaveStore((state) => state.setRoster);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data, isLoading } = useFreeAgentsQuery(saveId, teamAbbr);
  const [players, setPlayers] = useState<PlayerRowDTO[]>(() => data);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const { push: pushToast } = useToast();
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
  const initialTradeOfferRequestedRef = useRef<string | null>(null);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  const ensureActionableSaveId = async (preferredSaveId?: string | null) => {
    return ensureRecoverableSaveId(
      {
        preferredSaveId: preferredSaveId ?? saveId,
        teamId,
        teamAbbr,
        capSpace,
        capLimit,
        roster,
        phase,
        unlocked,
      },
      setSaveHeader,
    );
  };
  const requestTradeOffer = useTradeOfferOrchestrator({
    enabled: phase === 'free_agency',
    phase: 'freeAgency',
    saveId,
    teamAbbr,
    ensureActionableSaveId,
  });

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

  useEffect(() => {
    if (phase !== 'free_agency' || !saveId || !teamAbbr) return;
    const requestKey = `${saveId}:${teamAbbr}`;
    if (initialTradeOfferRequestedRef.current === requestKey) return;
    initialTradeOfferRequestedRef.current = requestKey;
    void requestTradeOffer({ trigger: 'visit-free-agency' });
  }, [phase, requestTradeOffer, saveId, teamAbbr]);

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

    let activeSaveId = await ensureActionableSaveId(saveId);
    if (!activeSaveId) {
      return;
    }

    const submitOffer = (resolvedSaveId: string) =>
      apiFetch('/api/actions/offer-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: resolvedSaveId,
          teamAbbr,
          playerId: activeOfferPlayer.id,
          years,
          apy,
          guaranteed,
        }),
      });

    let response = await submitOffer(activeSaveId);

    if (response.status === 404) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      if (errorPayload.error === 'Save not found') {
        const recoveredSaveId = await ensureActionableSaveId(null);
        if (recoveredSaveId) {
          activeSaveId = recoveredSaveId;
          response = await submitOffer(activeSaveId);
        } else {
          throw new Error(errorPayload.error || 'Unable to submit offer right now.');
        }
      } else {
        throw new Error(errorPayload.error || 'Unable to submit offer right now.');
      }
    }

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
        const reactionToast = buildStarReactionToastPayload({
          incomingPlayer: updatedPlayer,
          roster: nextRoster,
          actionType: 'freeAgency',
          teamAbbr,
          teamName: selectedTeam?.name,
        });
        if (reactionToast) {
          pushToast({
            id: `star-reaction:freeAgency:${activeSaveId}:${updatedPlayer.id}`,
            kind: 'starReaction',
            durationMs: 5200,
            starReaction: reactionToast,
          });
        }
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
      void requestTradeOffer({ trigger: 'after-free-agency-signing', force: true });
      setTimeout(() => {
        setActiveOfferPlayer(null);
      }, 1400);
      return responsePayload;
    }

    void requestTradeOffer({ trigger: 'after-free-agency-offer' });
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
