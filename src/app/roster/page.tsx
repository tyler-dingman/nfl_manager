'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake } from 'lucide-react';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import { PlayerTable } from '@/components/player-table';
import ResignPlayerModal from '@/components/resign-player-modal';
import ResignOfferResultModal from '@/components/resign-offer-result-modal';
import RenegotiateModal from '@/components/renegotiate-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { fetchExpiringContracts } from '@/features/contracts/queries';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useRosterQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import type { ResignResultDTO } from '@/types/resign';
import type { RenegotiateResultDTO } from '@/types/renegotiate';

const formatMillions = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;
const formatCurrency = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const phase = useSaveStore((state) => state.phase);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const ensureSaveId = useSaveStore((state) => state.ensureSaveId);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data: players, refresh: refreshPlayers } = useRosterQuery(saveId);
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeResignPlayer, setActiveResignPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeRenegotiatePlayer, setActiveRenegotiatePlayer] = useState<PlayerRowDTO | null>(null);
  const [activeExpiringContract, setActiveExpiringContract] = useState<ExpiringContractRow | null>(
    null,
  );
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [resignResult, setResignResult] = useState<ResignResultDTO | null>(null);
  const [isResignResultOpen, setIsResignResultOpen] = useState(false);
  const [renegotiateResult, setRenegotiateResult] = useState<RenegotiateResultDTO | null>(null);
  const [isRenegotiateResultOpen, setIsRenegotiateResultOpen] = useState(false);
  const { push: pushToast } = useToast();
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [selectedTeamId, teams],
  );

  const handleSubmitCut = async () => {
    if (!activeCutPlayer) {
      return;
    }

    const activeSaveId = await ensureSaveId();
    if (!activeSaveId) {
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
        saveId: activeSaveId,
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
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
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
    if (!activeResignPlayer && !activeExpiringContract) {
      return;
    }

    const playerId = activeResignPlayer?.id ?? activeExpiringContract?.id;
    if (!playerId) {
      return;
    }

    let activeSaveId = await ensureSaveId();
    if (!activeSaveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const sendOffer = async (targetSaveId: string) =>
      apiFetch('/api/actions/re-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: targetSaveId,
          teamAbbr,
          playerId,
          years: offer.years,
          apy: offer.apy,
          guaranteed: offer.guaranteed,
        }),
      });

    let response = await sendOffer(activeSaveId);
    if (response.status === 404) {
      const refreshedSaveId = await ensureSaveId();
      if (refreshedSaveId && refreshedSaveId !== activeSaveId) {
        activeSaveId = refreshedSaveId;
        response = await sendOffer(activeSaveId);
      }
    }

    if (!response.ok) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      pushToast({
        title: 'Unable to submit offer',
        description: errorPayload.error || 'Please try again in a moment.',
        variant: 'error',
      });
      return;
    }

    const data = (await response.json()) as ResignResultDTO | { ok: false; error: string };
    if (!data.ok) {
      pushToast({
        title: 'Unable to submit offer',
        description: data.error || 'Please try again in a moment.',
        variant: 'error',
      });
      return;
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

    await Promise.all([
      refreshSaveHeader(),
      refreshPlayers(),
      fetchExpiringContracts(activeSaveId).then(setExpiringContracts),
    ]);

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

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);

    setActiveRenegotiatePlayer(null);
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
                  <th className="px-4 py-2 sm:px-6">Age</th>
                  <th className="px-4 py-2 sm:px-6">Interest</th>
                  <th className="px-4 py-2 sm:px-6">Est. Value</th>
                  <th className="px-4 py-2 sm:px-6">Current Salary</th>
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
                    <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                      {player.age ?? '--'}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                      {player.interestPct !== undefined
                        ? `${player.interestPct.toFixed(1)}%`
                        : '--'}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                      {formatCurrency(player.estValue)}
                    </td>
                    <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                      {formatCurrency(player.currentSalary ?? 0)}
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
        onRenegotiatePlayer={setActiveRenegotiatePlayer}
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
          expectedApyOverride={activeExpiringContract.estValue / 1_000_000}
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
              <h3 className="text-lg font-semibold text-foreground">
                {renegotiateResult.accepted ? 'Renegotiation Accepted' : 'Renegotiation Declined'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsRenegotiateResultOpen(false)}
              >
                ✕
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {renegotiateResult.accepted
                ? 'Contract updated successfully.'
                : 'The player rejected the proposal.'}
            </p>
            <div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-foreground">
              “{renegotiateResult.quote}”
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-foreground">
              <span>Score</span>
              <span className="font-semibold">{renegotiateResult.score}%</span>
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
