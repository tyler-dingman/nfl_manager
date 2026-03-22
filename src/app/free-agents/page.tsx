'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import ContractOfferModal, { type OfferResponse } from '@/components/contract-offer-modal';
import { StepHeader } from '@/components/offseason/step-header';
import PlayerDetailsModal from '@/components/player-details-modal';
import { PlayerTable } from '@/components/player-table';
import { useToast, type ToastPayload } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useFreeAgentsQuery } from '@/features/players/queries';
import { useTradeOfferOrchestrator } from '@/features/trades/use-trade-offer-orchestrator';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep, isStepUnlocked } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import { generateFreeAgencyWaveTransitionToast, generateLeagueBuzzToast } from '@/lib/league-buzz';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import type { PlayerDetailsSource } from '@/lib/player-details';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';
import type { FreeAgencyMarketDTO, FreeAgencyView } from '@/types/free-agency';

export default function FreeAgentsPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const phase = useSaveStore((state) => state.phase);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const freeAgencyWave = useSaveStore((state) => state.freeAgencyWave);
  const unlocked = useSaveStore((state) => state.unlocked);
  const roster = useSaveStore((state) => state.roster);
  const setRoster = useSaveStore((state) => state.setRoster);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data, isLoading, refresh } = useFreeAgentsQuery(saveId, teamAbbr);
  const [market, setMarket] = useState<FreeAgencyMarketDTO>(() => data);
  const [activeOfferPlayer, setActiveOfferPlayer] = useState<PlayerRowDTO | null>(null);
  const [activePlayerDetails, setActivePlayerDetails] = useState<PlayerDetailsSource | null>(null);
  const [visiblePlayers, setVisiblePlayers] = useState<PlayerRowDTO[]>([]);
  const [pendingOfferToast, setPendingOfferToast] = useState<ToastPayload | null>(null);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const { push: pushToast } = useToast();
  const mode = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const enterSandboxStep = useExperienceStore((state) => state.enterSandboxStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const [activeTab, setActiveTab] = useState<FreeAgencyView>('available');
  const firstVisibleRowLoggedRef = useRef(false);
  const tableStartedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0,
  );
  const initialTradeOfferRequestedRef = useRef<string | null>(null);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const trackProgress = (
    eventKey: string,
    points: number,
    message: string,
    detail = 'Free Agency',
  ) => {
    if (!saveId) return;
    const result = recordProgressEvent({
      saveId,
      step: 'free-agency',
      eventKey,
      points,
    });
    if (!result.changed) return;
    pushToast({
      id: `progress:${saveId}:${eventKey}`,
      kind: 'progress',
      durationMs: 3400,
      progress: {
        message,
        detail,
      },
    });
  };

  const ensureActionableSaveId = async (preferredSaveId?: string | null) => {
    return ensureRecoverableSaveId(
      {
        preferredSaveId: preferredSaveId ?? saveId,
        teamId,
        teamAbbr,
        year: franchiseYear,
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
    setMarket(data);
  }, [data]);

  const players = market.players;

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
    if (mode === 'full' && !isStepUnlocked('free-agency', currentStep)) {
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

  const handleCloseOfferModal = () => {
    setActiveOfferPlayer(null);
    if (pendingOfferToast) {
      pushToast(pendingOfferToast);
      setPendingOfferToast(null);
    }
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
    setPendingOfferToast(null);
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
          header?: SaveHeaderDTO;
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
      const leagueBuzz = generateLeagueBuzzToast({
        eventType: 'freeAgency',
        teamName: selectedTeam?.name ?? teamAbbr ?? 'Your team',
        playerName: `${updatedPlayer.firstName} ${updatedPlayer.lastName}`,
        teamAbbr,
      });
      const showLeagueBuzz = Boolean(leagueBuzz) && (!reactionToast || Math.random() < 0.5);

      if (showLeagueBuzz && leagueBuzz) {
        setPendingOfferToast({
          id: `league-buzz:freeAgency:${activeSaveId}:${updatedPlayer.id}`,
          kind: 'leagueBuzz',
          durationMs: 5600,
          leagueBuzz,
        });
      } else if (reactionToast) {
        setPendingOfferToast({
          id: `star-reaction:freeAgency:${activeSaveId}:${updatedPlayer.id}`,
          kind: 'starReaction',
          durationMs: 5200,
          starReaction: reactionToast,
        });
      }
      if ('header' in data && data.header) {
        setSaveHeader({
          ...data.header,
          unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
        });
      }
      await refresh();
      pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
      trackProgress(
        `free-agency-sign:${updatedPlayer.id}`,
        OFFSEASON_PROGRESS_POINTS['free-agency'].sign,
        `Signed ${updatedPlayer.firstName} ${updatedPlayer.lastName} in free agency.`,
      );
      if (selectedTeam?.teamNeeds?.includes(updatedPlayer.position)) {
        trackProgress(
          `free-agency-need:${updatedPlayer.id}`,
          OFFSEASON_PROGRESS_POINTS['free-agency'].fill_need,
          `Filled a team need at ${updatedPlayer.position}.`,
        );
      }
      void requestTradeOffer({ trigger: 'after-free-agency-signing' });
      return responsePayload;
    }

    return responsePayload;
  };

  const canContinueInFull = mode !== 'full' || market.wave === 3;

  const proceedToDraft = () => {
    if (mode === 'full' && currentStep === 'free-agency') {
      if (saveId) {
        recordProgressEvent({
          saveId,
          step: 'free-agency',
          eventKey: 'continue:free-agency',
          complete: true,
        });
      }
      const nextStep = completeCurrentStep();
      if (nextStep) router.push(getRouteForStep(nextStep));
      return;
    }

    enterSandboxStep('draft');
    router.push(getRouteForStep('draft'));
  };

  const handleContinue = () => {
    proceedToDraft();
  };

  const handleAdvanceWave = async () => {
    if (!saveId) return;
    if (market.wave === 3) {
      proceedToDraft();
      return;
    }

    let activeSaveId = await ensureActionableSaveId(saveId);
    if (!activeSaveId) return;

    const currentWave = market.wave;
    const userWaveSignings = market.players
      .filter((player) => player.isSignedByUser && player.signedWave === currentWave)
      .sort((left, right) => {
        const leftScore = left.rating ?? left.marketValue ?? 0;
        const rightScore = right.rating ?? right.marketValue ?? 0;
        return rightScore - leftScore;
      });

    const submitAdvance = (resolvedSaveId: string) =>
      apiFetch('/api/free-agents/advance-wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId: resolvedSaveId }),
      });

    let response = await submitAdvance(activeSaveId);
    if (response.status === 404) {
      const recoveredSaveId = await ensureActionableSaveId(null);
      if (recoveredSaveId) {
        activeSaveId = recoveredSaveId;
        response = await submitAdvance(activeSaveId);
      }
    }

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || 'Unable to advance free agency right now.');
    }

    const payload = (await response.json()) as {
      ok: true;
      header: SaveHeaderDTO;
      market: FreeAgencyMarketDTO;
    };

    setSaveHeader({
      ...payload.header,
      unlocked: payload.header.unlocked ?? { freeAgency: false, draft: false },
    });
    setMarket(payload.market);

    const transitionToast = generateFreeAgencyWaveTransitionToast({
      teamAbbr,
      teamName: selectedTeam?.name ?? teamAbbr ?? 'Your team',
      fromWave: currentWave as 1 | 2,
      nextWave: payload.market.wave === 2 ? 2 : 3,
      signedPlayers: userWaveSignings.slice(0, 2).map((player) => ({
        firstName: player.firstName,
        lastName: player.lastName,
        rating: player.rating ?? null,
        marketValue: player.marketValue ?? null,
      })),
    });

    if (transitionToast) {
      pushToast({
        id: `league-buzz:free-agency-wave:${activeSaveId}:${currentWave}`,
        kind: 'leagueBuzz',
        durationMs: 5600,
        leagueBuzz: transitionToast,
      });
    }
  };

  const handleSkip = () => {
    if (mode !== 'full' || currentStep !== 'free-agency') return;
    if (saveId) {
      recordProgressEvent({
        saveId,
        step: 'free-agency',
        eventKey: 'skip:free-agency',
        complete: true,
        skipped: true,
      });
      pushToast({
        id: `progress:${saveId}:skip:free-agency`,
        kind: 'progress',
        durationMs: 3200,
        progress: {
          message: 'Completed the Free Agency step.',
          detail: 'Free Agency',
        },
      });
    }
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
          instruction="Move through all three market waves, then head into the draft."
          canContinue={canContinueInFull}
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      <PlayerTable
        data={players}
        variant="freeAgent"
        loading={isLoading && players.length === 0}
        freeAgentView={activeTab}
        topSlot={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 transition ${
                    activeTab === 'userSigned'
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => setActiveTab('userSigned')}
                >
                  {selectedTeam?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedTeam.logo_url}
                      alt={`${selectedTeam.abbr} logo`}
                      className="h-4 w-4"
                    />
                  ) : null}
                  Signed
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {market.waveLabel}
              </span>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                onClick={() => void handleAdvanceWave()}
              >
                {market.wave === 1
                  ? 'Advance to Wave 2'
                  : market.wave === 2
                    ? 'Advance to Wave 3'
                    : 'Advance to Draft'}
              </button>
            </div>
          </div>
        }
        onOfferPlayer={handleOfferPlayer}
        onVisiblePlayersChange={setVisiblePlayers}
        onPlayerSelect={(player) => setActivePlayerDetails({ kind: 'freeAgent', player })}
      />
      <PlayerDetailsModal
        isOpen={Boolean(activePlayerDetails)}
        source={activePlayerDetails}
        sources={visiblePlayers.map((player) => ({ kind: 'freeAgent', player }))}
        roster={roster}
        teams={teams}
        userTeamAbbr={teamAbbr}
        capSpace={capSpace}
        capLimit={capLimit}
        onClose={() => setActivePlayerDetails(null)}
        onSelectSource={(nextSource) => setActivePlayerDetails(nextSource)}
      />
      {activeOfferPlayer ? (
        <ContractOfferModal
          player={activeOfferPlayer}
          isOpen={Boolean(activeOfferPlayer)}
          onClose={handleCloseOfferModal}
          onSubmit={handleSubmitOffer}
          title={`Sign ${activeOfferPlayer.firstName} ${activeOfferPlayer.lastName}`}
          subtitle="Set contract terms and gauge interest."
          submitLabel="Submit Offer"
          expectedApyOverride={
            activeOfferPlayer.currentAskAnnualValue !== null &&
            activeOfferPlayer.currentAskAnnualValue !== undefined
              ? activeOfferPlayer.currentAskAnnualValue
              : activeOfferPlayer.marketValue !== null &&
                  activeOfferPlayer.marketValue !== undefined
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
