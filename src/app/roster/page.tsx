'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, MoreHorizontal } from 'lucide-react';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import { PlayerTable, PositionFilterBar } from '@/components/player-table';
import ResignPlayerModal from '@/components/resign-player-modal';
import { StepHeader } from '@/components/offseason/step-header';
import ResignOfferResultModal from '@/components/resign-offer-result-modal';
import RenegotiateModal from '@/components/renegotiate-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { fetchExpiringContracts } from '@/features/contracts/queries';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useRosterQuery } from '@/features/players/queries';
import { useExperienceStore } from '@/features/experience/experience-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { getTeamCatchphrase } from '@/lib/team-chants';
import { apiFetch } from '@/lib/api';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import type { ResignResultDTO } from '@/types/resign';
import type { RenegotiateResultDTO } from '@/types/renegotiate';

const getInterestTier = (interest: number) => {
  if (interest >= 85) return { label: 'Very High', barClass: 'bg-emerald-500' };
  if (interest >= 65) return { label: 'High', barClass: 'bg-emerald-400' };
  if (interest >= 40) return { label: 'Medium', barClass: 'bg-amber-400' };
  return { label: 'Low', barClass: 'bg-rose-400' };
};

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const phase = useSaveStore((state) => state.phase);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data: rosterData } = useRosterQuery(saveId, teamAbbr);
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeResignPlayer, setActiveResignPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeRenegotiatePlayer, setActiveRenegotiatePlayer] = useState<PlayerRowDTO | null>(null);
  const [activeExpiringContract, setActiveExpiringContract] = useState<ExpiringContractRow | null>(
    null,
  );
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [expiringPositionFilter, setExpiringPositionFilter] = useState('All');
  const [expiringSearchQuery, setExpiringSearchQuery] = useState('');
  const [resignResult, setResignResult] = useState<ResignResultDTO | null>(null);
  const [isResignResultOpen, setIsResignResultOpen] = useState(false);
  const [renegotiateResult, setRenegotiateResult] = useState<RenegotiateResultDTO | null>(null);
  const [isRenegotiateResultOpen, setIsRenegotiateResultOpen] = useState(false);
  const [renegotiateResultPlayer, setRenegotiateResultPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'expiring' | 'roster'>('expiring');
  const { push: pushToast } = useToast();
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const mode = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const manageSubstepsCompleted = useExperienceStore((state) => state.manageSubstepsCompleted);
  const markManageSubstepComplete = useExperienceStore((state) => state.markManageSubstepComplete);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [selectedTeamId, teams],
  );

  useEffect(() => {
    if (mode === 'full' && currentStep !== 'manage') {
      router.replace(getRouteForStep(currentStep));
    }
  }, [mode, currentStep, router]);

  useEffect(() => {
    setPlayers(rosterData);
    if (rosterData.length > 0) {
      setRoster(rosterData);
    }
  }, [rosterData, setRoster]);

  const handleSubmitCut = async () => {
    if (!activeCutPlayer) {
      return;
    }

    if (!saveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const response = await apiFetch('/api/actions/cut-player', {
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
        unlocked?: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
      player?: PlayerRowDTO;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.player) {
      setPlayers((prev) => {
        const next = prev.map((item) => (item.id === data.player?.id ? data.player : item));
        setRoster(next);
        return next;
      });
    }
    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
    }
    setActiveCutPlayer(null);
    if (mode === 'full') {
      markManageSubstepComplete('Re-sign / Cut Players');
    }
  };

  useEffect(() => {
    if (phase !== 'resign_cut') {
      return;
    }

    let isActive = true;
    setExpiringError(null);

    fetchExpiringContracts(saveId, teamAbbr)
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
  }, [phase, saveId, teamAbbr]);

  const filteredExpiringContracts = useMemo(() => {
    const search = expiringSearchQuery.trim().toLowerCase();
    return expiringContracts
      .filter((player) => {
        const matchesPosition =
          expiringPositionFilter === 'All' || player.pos === expiringPositionFilter;
        const matchesSearch = search.length === 0 || player.name.toLowerCase().includes(search);
        return matchesPosition && matchesSearch;
      })
      .sort((a, b) => {
        const ratingDelta = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDelta !== 0) {
          return ratingDelta;
        }
        return b.estValue - a.estValue;
      });
  }, [expiringContracts, expiringPositionFilter, expiringSearchQuery]);

  const resetExpiringFilters = () => {
    setExpiringPositionFilter('All');
    setExpiringSearchQuery('');
  };

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
      age: activeExpiringContract.age,
      rating: activeExpiringContract.rating,
      headshotUrl: activeExpiringContract.headshotUrl ?? null,
      contractYearsRemaining: 0,
      capHit: '',
      status: 'expiring',
    };
  }, [activeExpiringContract]);

  const handleSubmitResign = async (offer: { years: number; apy: number; guaranteed: number }) => {
    if (!activeResignPlayer && !activeExpiringContract) {
      return;
    }

    const playerId = activeResignPlayer?.id ?? activeExpiringContract?.id;
    if (!playerId) {
      return;
    }

    if (!saveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const requestBody = {
      saveId,
      teamAbbr,
      playerId,
      years: offer.years,
      apy: offer.apy,
      guaranteed: offer.guaranteed,
    };

    const response = await apiFetch('/api/actions/resign-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      const message = errorPayload.error || 'Please try again in a moment.';
      pushToast({
        title: 'Unable to submit offer',
        description: message,
        variant: 'error',
      });
      throw new Error(message);
    }

    const data = (await response.json()) as ResignResultDTO | { ok: false; error: string };
    if (!data.ok) {
      const message = data.error || 'Please try again in a moment.';
      pushToast({
        title: 'Unable to submit offer',
        description: message,
        variant: 'error',
      });
      throw new Error(message);
    }

    setResignResult(data);
    setIsResignResultOpen(true);
    pushToast({
      title: data.accepted ? 'Offer accepted' : 'Offer declined',
      description: data.accepted ? data.newsItem.details : 'The player decided to test the market.',
      variant: data.accepted ? 'success' : 'error',
    });
    if (data.accepted) {
      pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
    }

    if (data.accepted) {
      if (data.header) {
        setSaveHeader({
          ...data.header,
          unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
        });
      }
      if (data.player) {
        const updatedPlayer = data.player;
        setPlayers((prev) => {
          const exists = prev.some((item) => item.id === updatedPlayer.id);
          const next = exists
            ? prev.map((item) => (item.id === updatedPlayer.id ? updatedPlayer : item))
            : [updatedPlayer, ...prev];
          setRoster(next);
          return next;
        });
      }
      if (activeExpiringContract) {
        setExpiringContracts((prev) =>
          prev.filter((contract) => contract.id !== activeExpiringContract.id),
        );
      }
    }

    setActiveResignPlayer(null);
    setActiveExpiringContract(null);
    return;
  };

  const handleSubmitRenegotiate = async (offer: {
    years: number;
    apy: number;
    guaranteed: number;
  }) => {
    if (!saveId || !activeRenegotiatePlayer) {
      return;
    }

    const response = await apiFetch('/api/roster/renegotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        playerId: activeRenegotiatePlayer.id,
        years: offer.years,
        apy: offer.apy,
        guaranteed: offer.guaranteed,
      }),
    });

    const data = (await response.json()) as RenegotiateResultDTO | { ok: false; error: string };
    if (!response.ok || !data.ok) {
      throw new Error(!data.ok ? data.error : 'Unable to renegotiate right now.');
    }

    setRenegotiateResult(data);
    setRenegotiateResultPlayer(activeRenegotiatePlayer);
    setIsRenegotiateResultOpen(true);
    pushToast({
      title: data.accepted ? 'Renegotiation accepted' : 'Renegotiation declined',
      description: data.accepted ? 'Contract updated.' : data.quote,
      variant: data.accepted ? 'success' : 'error',
    });

    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
    }

    if (data.player) {
      setPlayers((prev) => {
        const next = prev.map((item) => (item.id === data.player?.id ? data.player : item));
        setRoster(next);
        return next;
      });
    }

    setActiveRenegotiatePlayer(null);
    if (mode === 'full') {
      markManageSubstepComplete('Re-sign / Cut Players');
    }
  };

  const manageSubsteps = OFFSEASON_STEPS[0]?.substeps ?? [];
  const canContinueInFull =
    mode !== 'full' || manageSubsteps.every((substep) => manageSubstepsCompleted.includes(substep));

  const handleContinue = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    const nextStep = completeCurrentStep();
    if (nextStep) {
      router.push(getRouteForStep(nextStep));
    }
  };

  const handleSkip = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    const nextStep = skipCurrentStep();
    if (nextStep) {
      router.push(getRouteForStep(nextStep));
    }
  };

  const sortedPlayers = useMemo(() => {
    const cut = players
      .filter((player) => player.status.toLowerCase() === 'cut')
      .sort((a, b) => {
        const aCut = a.cutAt ? Date.parse(a.cutAt) : 0;
        const bCut = b.cutAt ? Date.parse(b.cutAt) : 0;
        return bCut - aCut;
      });
    const active = players
      .filter((player) => player.status.toLowerCase() !== 'cut')
      .sort((a, b) => (b.capHitValue ?? 0) - (a.capHitValue ?? 0));
    return [...cut, ...active];
  }, [players]);

  return (
    <AppShell>
      {mode === 'full' ? (
        <StepHeader
          title="Manage Team"
          stepNumber={1}
          totalSteps={OFFSEASON_STEPS.length}
          instruction="Re-sign, cut, and explore trades before entering free agency."
          canContinue={canContinueInFull}
          backgroundColor={selectedTeam?.color_primary}
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      {phase === 'resign_cut' ? (
        <div className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-start gap-3">
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === 'expiring'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('expiring')}
              >
                Expiring Contracts
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === 'roster'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('roster')}
              >
                Roster
              </button>
            </div>
          </div>

          {activeTab === 'expiring' ? (
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="rounded-2xl border border-border bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <PositionFilterBar
                      active={expiringPositionFilter}
                      onSelect={setExpiringPositionFilter}
                    />
                    <div className="flex w-full max-w-sm items-center gap-2 sm:w-auto">
                      <input
                        type="search"
                        placeholder="Search players..."
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={expiringSearchQuery}
                        onChange={(event) => setExpiringSearchQuery(event.target.value)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={resetExpiringFilters}>
                            Reset filters
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setExpiringSearchQuery('')}>
                            Clear search
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <div className="space-y-6 overflow-x-auto px-4 py-4 sm:px-6">
                  <table className="w-full border-collapse md:min-w-[720px]">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 sm:px-6">Player</th>
                        <th className="px-4 py-2 sm:px-6">Pos</th>
                        <th className="px-4 py-2 sm:px-6">Status</th>
                        <th className="px-4 py-2 sm:px-6">Interest</th>
                        <th className="px-4 py-2 text-right sm:px-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpiringContracts.map((player) => (
                        <tr key={player.id} className="border-t border-border hover:bg-slate-50/60">
                          <td className="px-4 py-1.5 text-sm font-semibold text-foreground sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                {player.headshotUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={player.headshotUrl}
                                    alt={player.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  `${(player.name.split(' ')[0] ?? player.name).charAt(0)}${(
                                    player.name.split(' ').slice(1).join(' ') || player.name
                                  ).charAt(0)}`.toUpperCase()
                                )}
                              </div>
                              <span>{player.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                            {player.pos}
                          </td>
                          <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                            <Badge variant="success">Pending</Badge>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                            {(() => {
                              const score = Math.max(0, Math.min(100, player.interestPct ?? 0));
                              const tier = getInterestTier(score);
                              return (
                                <div className="w-32">
                                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                                    {tier.label}
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-slate-200">
                                    <div
                                      className={`h-2 rounded-full ${tier.barClass}`}
                                      style={{ width: `${score}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-1.5 text-right sm:px-6">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!saveId}
                              onClick={() => setActiveExpiringContract(player)}
                            >
                              <Handshake className="h-4 w-4" />
                              <span className="sr-only">Re-sign {player.name}</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {expiringError ? (
                <div className="px-4 py-4 text-sm text-destructive sm:px-6">{expiringError}</div>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              <PlayerTable
                data={sortedPlayers}
                variant="roster"
                onCutPlayer={setActiveCutPlayer}
                onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
                onRenegotiatePlayer={setActiveRenegotiatePlayer}
              />
            </div>
          )}
        </div>
      ) : (
        <PlayerTable
          data={sortedPlayers}
          variant="roster"
          onCutPlayer={setActiveCutPlayer}
          onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
          onRenegotiatePlayer={setActiveRenegotiatePlayer}
        />
      )}
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
          teamAbbr={teamAbbr ?? undefined}
          teamRoster={players}
          previousTeamAbbr={teamAbbr ?? undefined}
          isOpen={Boolean(activeResignPlayer)}
          onClose={() => setActiveResignPlayer(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      {expiringResignPlayer && activeExpiringContract ? (
        <ResignPlayerModal
          player={expiringResignPlayer}
          expectedApyOverride={activeExpiringContract.estValue / 1_000_000}
          teamAbbr={teamAbbr ?? undefined}
          teamRoster={players}
          previousTeamAbbr={activeExpiringContract.lastTeamAbbr ?? null}
          isOpen={Boolean(activeExpiringContract)}
          onClose={() => setActiveExpiringContract(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      {activeRenegotiatePlayer ? (
        <RenegotiateModal
          player={activeRenegotiatePlayer}
          isOpen={Boolean(activeRenegotiatePlayer)}
          saveId={saveId || undefined}
          teamLogoUrl={selectedTeam?.logo_url ?? null}
          onClose={() => setActiveRenegotiatePlayer(null)}
          onSubmit={handleSubmitRenegotiate}
        />
      ) : null}
      <ResignOfferResultModal
        result={resignResult}
        isOpen={isResignResultOpen}
        onClose={() => setIsResignResultOpen(false)}
      />
      {isRenegotiateResultOpen && renegotiateResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Renegotiation
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  {renegotiateResult.accepted
                    ? `${renegotiateResultPlayer?.firstName ?? ''} ${
                        renegotiateResultPlayer?.lastName ?? ''
                      } accepted`
                    : 'Renegotiation declined'}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsRenegotiateResultOpen(false)}
              >
                ✕
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedTeam?.name ?? teamAbbr ?? 'Team'} renegotiated with{' '}
              {renegotiateResultPlayer
                ? `${renegotiateResultPlayer.firstName} ${renegotiateResultPlayer.lastName}`
                : 'the player'}
              .
            </p>
            <div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-foreground">
              “
              {renegotiateResult.accepted
                ? `${renegotiateResult.quote} ${getTeamCatchphrase(teamAbbr)}`
                : renegotiateResult.quote}
              ”
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setIsRenegotiateResultOpen(false)}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
