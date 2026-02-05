'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import TradePlayerModal from '@/components/trade-player-modal';
import { Button } from '@/components/ui/button';
import TeamHeaderSummary from '@/components/team-header-summary';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type TradeAsset = {
  id: string;
  type: 'player' | 'pick';
  side: 'send' | 'receive';
  label: string;
  value: number;
  playerId?: string;
  pickId?: string;
};

type TradeDTO = {
  id: string;
  partnerTeamAbbr: string;
  status: 'building' | 'proposed' | 'accepted' | 'rejected';
  sendAssets: TradeAsset[];
  receiveAssets: TradeAsset[];
};

type TradeCreateResponse = {
  trade: TradeDTO;
  userRoster: PlayerRowDTO[];
  partnerRoster: PlayerRowDTO[];
};

type ProposeTradeResponse = { ok: true; trade: TradeDTO } | { ok: false; error: string };

const PICK_OPTIONS = [
  { id: '2025-r1', label: '2025 Round 1 Pick' },
  { id: '2025-r2', label: '2025 Round 2 Pick' },
  { id: '2025-r3', label: '2025 Round 3 Pick' },
  { id: '2025-r4', label: '2025 Round 4 Pick' },
  { id: '2025-r5', label: '2025 Round 5 Pick' },
  { id: '2025-r6', label: '2025 Round 6 Pick' },
  { id: '2025-r7', label: '2025 Round 7 Pick' },
];

const sumAssets = (assets: TradeAsset[]) => assets.reduce((total, asset) => total + asset.value, 0);

const getAcceptance = (sendAssets: TradeAsset[], receiveAssets: TradeAsset[]) => {
  const sendValue = sumAssets(sendAssets);
  const receiveValue = sumAssets(receiveAssets);
  if (sendValue === 0) {
    return 0;
  }

  return Math.min(100, Math.round((receiveValue / sendValue) * 100));
};

type ProposalModalState = {
  isOpen: boolean;
  title: string;
  message: string;
};

const INITIAL_MODAL_STATE: ProposalModalState = {
  isOpen: false,
  title: '',
  message: '',
};

export default function TradeBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const selectedPlayerId = searchParams.get('playerId') ?? undefined;

  const saveId = useSaveStore((state) => state.saveId);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [partnerTeamAbbr, setPartnerTeamAbbr] = useState<string>('');
  const [trade, setTrade] = useState<TradeDTO | null>(null);
  const [userRoster, setUserRoster] = useState<PlayerRowDTO[]>([]);
  const [partnerRoster, setPartnerRoster] = useState<PlayerRowDTO[]>([]);
  const [activeModalSide, setActiveModalSide] = useState<'send' | 'receive' | null>(null);
  const [sendPick, setSendPick] = useState(PICK_OPTIONS[0]?.id ?? '');
  const [receivePick, setReceivePick] = useState(PICK_OPTIONS[0]?.id ?? '');
  const [proposalModal, setProposalModal] = useState<ProposalModalState>(INITIAL_MODAL_STATE);

  const acceptance = useMemo(() => {
    if (!trade) {
      return 0;
    }

    return getAcceptance(trade.sendAssets, trade.receiveAssets);
  }, [trade]);

  const acceptanceLabel = acceptance >= 70 ? 'Acceptable' : 'Needs work';

  const loadTrade = useCallback(
    async (targetPartnerTeamAbbr: string) => {
      if (!saveId || !targetPartnerTeamAbbr) {
        return;
      }

      const response = await fetch('/api/trades/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          partnerTeamAbbr: targetPartnerTeamAbbr,
          playerId: selectedPlayerId,
        }),
      });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TradeCreateResponse;
      setTrade(data.trade);
      setUserRoster(data.userRoster);
      setPartnerRoster(data.partnerRoster);
    },
    [saveId, selectedPlayerId],
  );

  useEffect(() => {
    const loadTeams = async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TeamDTO[];
      setTeams(data);
    };

    loadTeams();
  }, []);

  useEffect(() => {
    if (!teams.length || partnerTeamAbbr) {
      return;
    }

    const firstPartner = teams.find((team) => team.abbr !== selectedTeam?.abbr);
    if (firstPartner) {
      setPartnerTeamAbbr(firstPartner.abbr);
    }
  }, [partnerTeamAbbr, selectedTeam?.abbr, teams]);

  useEffect(() => {
    loadTrade(partnerTeamAbbr);
  }, [loadTrade, partnerTeamAbbr]);

  const handleAddPlayer = async (player: PlayerRowDTO) => {
    if (!trade || !activeModalSide || !saveId) {
      return;
    }

    const response = await fetch(`/api/trades/${trade.id}/add-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        side: activeModalSide,
        type: 'player',
        playerId: player.id,
        saveId,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeDTO;
    setTrade(data);
  };

  const handleAddPick = async (side: 'send' | 'receive', pickId: string) => {
    if (!trade || !saveId) {
      return;
    }

    const response = await fetch(`/api/trades/${trade.id}/add-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        side,
        type: 'pick',
        pickId,
        saveId,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeDTO;
    setTrade(data);
  };

  const handlePropose = async () => {
    if (!trade || !saveId) {
      return;
    }

    const response = await fetch(`/api/trades/${trade.id}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId }),
    });

    const data = (await response.json()) as ProposeTradeResponse;
    if (!response.ok || !data.ok) {
      setProposalModal({
        isOpen: true,
        title: 'Trade Failed',
        message: data.ok ? 'Unable to propose trade right now.' : data.error,
      });
      return;
    }

    setTrade(data.trade);

    const sendPlayerIds = new Set(
      data.trade.sendAssets
        .filter((asset) => asset.type === 'player' && asset.playerId)
        .map((asset) => asset.playerId),
    );
    const receivePlayerIds = new Set(
      data.trade.receiveAssets
        .filter((asset) => asset.type === 'player' && asset.playerId)
        .map((asset) => asset.playerId),
    );

    const movedToPartner = userRoster.filter((player) => sendPlayerIds.has(player.id));
    const movedToUser = partnerRoster.filter((player) => receivePlayerIds.has(player.id));

    setUserRoster((currentRoster) => [
      ...currentRoster.filter((player) => !sendPlayerIds.has(player.id)),
      ...movedToUser,
    ]);
    setPartnerRoster((currentRoster) => [
      ...currentRoster.filter((player) => !receivePlayerIds.has(player.id)),
      ...movedToPartner,
    ]);

    await refreshSaveHeader();
    router.refresh();

    setProposalModal({
      isOpen: true,
      title: 'Trade Proposed',
      message: 'Assets exchanged and rosters updated.',
    });
  };

  const partnerTeam = teams.find((team) => team.abbr === partnerTeamAbbr);

  return (
    <AppShell>
      <TeamHeaderSummary
        capSpace={capSpace}
        capLimit={capLimit}
        rosterCount={rosterCount}
        rosterLimit={rosterLimit}
      />
      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trade Builder
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Build a roster trade</h1>
            <p className="text-sm text-muted-foreground">
              Add players and picks to balance the deal. Acceptance requires 70+.
            </p>
          </div>
          <Button type="button" onClick={handlePropose} disabled={!trade}>
            Propose trade
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Acceptance Meter</p>
              <p className="text-sm text-muted-foreground">
                {acceptance}% · {acceptanceLabel}
              </p>
            </div>
            <div className="w-full max-w-md">
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${acceptance}%` }}
                />
              </div>
            </div>
          </div>
          {trade ? (
            <p className="mt-4 text-sm font-medium text-foreground">Status: {trade.status}</p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Offer
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Send assets</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveModalSide('send')}>
                  Add Player
                </Button>
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={sendPick}
                    onChange={(event) => setSendPick(event.target.value)}
                  >
                    {PICK_OPTIONS.map((pick) => (
                      <option key={pick.id} value={pick.id}>
                        {pick.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddPick('send', sendPick)}
                  >
                    Add Pick
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {trade?.sendAssets.length ? (
                trade.sendAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{asset.label}</p>
                      <p className="text-xs text-muted-foreground">Value: {asset.value}</p>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Send</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No outgoing assets yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Their Offer
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Receive assets</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={partnerTeamAbbr}
                  onChange={(event) => setPartnerTeamAbbr(event.target.value)}
                >
                  {teams
                    .filter((team) => team.abbr !== selectedTeam?.abbr)
                    .map((team) => (
                      <option key={team.abbr} value={team.abbr}>
                        {team.name}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModalSide('receive')}
                >
                  Add Player
                </Button>
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={receivePick}
                    onChange={(event) => setReceivePick(event.target.value)}
                  >
                    {PICK_OPTIONS.map((pick) => (
                      <option key={pick.id} value={pick.id}>
                        {pick.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddPick('receive', receivePick)}
                  >
                    Add Pick
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {trade?.receiveAssets.length ? (
                trade.receiveAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{asset.label}</p>
                      <p className="text-xs text-muted-foreground">Value: {asset.value}</p>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Receive</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No incoming assets yet.</p>
              )}
            </div>
            {partnerTeam ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partnerTeam.logoUrl} alt={partnerTeam.name} className="h-5 w-5" />
                <span>{partnerTeam.name} roster assets</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <TradePlayerModal
        isOpen={activeModalSide !== null}
        sideLabel={activeModalSide === 'send' ? 'Your Offer' : 'Their Offer'}
        players={activeModalSide === 'send' ? userRoster : partnerRoster}
        onClose={() => setActiveModalSide(null)}
        onSelectPlayer={handleAddPlayer}
      />

      {proposalModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">{proposalModal.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{proposalModal.message}</p>
            <div className="mt-6 flex items-center justify-end">
              <Button type="button" onClick={() => setProposalModal(INITIAL_MODAL_STATE)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
