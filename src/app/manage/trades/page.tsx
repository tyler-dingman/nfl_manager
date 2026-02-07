'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import TradeAssetPickerModal from '@/components/trade-asset-picker-modal';
import TradeAssetSlots, { type TradeSlotAsset } from '@/components/trade-asset-slots';
import { Button } from '@/components/ui/button';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';
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
  sendAssets: TradeAsset[];
  receiveAssets: TradeAsset[];
};

type TradeCreateResponse = {
  trade: TradeDTO;
  userRoster: PlayerRowDTO[];
  partnerRoster: PlayerRowDTO[];
};

type TradeProposeResponse = {
  trade: TradeDTO;
  acceptance: number;
  accepted: boolean;
  header: SaveHeaderDTO;
};

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

function TradeBuilderContent() {
  const searchParams = useSearchParams();
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const selectedPlayerId = searchParams?.get('playerId') ?? undefined;

  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [partnerTeamAbbr, setPartnerTeamAbbr] = useState<string>('');
  const [trade, setTrade] = useState<TradeDTO | null>(null);
  const [userRoster, setUserRoster] = useState<PlayerRowDTO[]>([]);
  const [partnerRoster, setPartnerRoster] = useState<PlayerRowDTO[]>([]);
  const [activeModalSide, setActiveModalSide] = useState<'send' | 'receive' | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotAction, setSlotAction] = useState<{
    side: 'send' | 'receive';
    slotIndex: number;
  } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{
    side: 'send' | 'receive';
    asset: TradeAsset;
  } | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string>('');
  const [sendSlotIds, setSendSlotIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const [receiveSlotIds, setReceiveSlotIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const lastTradeKeyRef = useRef<string | null>(null);

  const acceptance = useMemo(() => {
    if (!trade) {
      return 0;
    }

    return getAcceptance(trade.sendAssets, trade.receiveAssets);
  }, [trade]);

  const acceptanceLabel = acceptance >= 70 ? 'Acceptable' : 'Needs work';

  useEffect(() => {
    const loadTeams = async () => {
      const response = await apiFetch('/api/teams');
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
    const loadTrade = async () => {
      if (!partnerTeamAbbr) {
        return;
      }

      let activeSaveId = saveId;
      if (activeSaveId) {
        const headerResponse = await apiFetch(`/api/saves/header?saveId=${activeSaveId}`);
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

      const tradeKey = `${activeSaveId}:${partnerTeamAbbr}:${selectedPlayerId ?? ''}`;
      if (lastTradeKeyRef.current === tradeKey) {
        return;
      }

      const response = await apiFetch('/api/trades/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: activeSaveId,
          partnerTeamAbbr,
          playerId: selectedPlayerId,
        }),
      });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TradeCreateResponse;
      lastTradeKeyRef.current = tradeKey;
      setTrade(data.trade);
      setUserRoster(data.userRoster);
      setPartnerRoster(data.partnerRoster);
      setProposalStatus('');
    };

    loadTrade();
  }, [partnerTeamAbbr, saveId, selectedPlayerId, setSaveHeader, teamAbbr, teamId]);

  useEffect(() => {
    setSendSlotIds(Array.from({ length: 5 }, () => null));
    setReceiveSlotIds(Array.from({ length: 5 }, () => null));
  }, [trade?.id]);

  const handleAddAsset = async (payload: {
    side: 'send' | 'receive';
    type: 'player' | 'pick';
    playerId?: string;
    pickId?: string;
  }) => {
    if (!trade || !saveId) {
      return;
    }

    const response = await apiFetch(`/api/trades/${trade.id}/add-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        saveId,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeDTO;
    setTrade(data);
  };

  const handleRemoveAsset = async (payload: {
    side: 'send' | 'receive';
    assetId?: string;
    playerId?: string;
    pickId?: string;
  }) => {
    if (!trade || !saveId) {
      return;
    }

    const response = await apiFetch(`/api/trades/${trade.id}/remove-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
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

    const response = await apiFetch(`/api/trades/${trade.id}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeProposeResponse | { ok: false; error: string };
    if ('ok' in data && data.ok === false) {
      return;
    }

    if (!('trade' in data)) {
      return;
    }

    setTrade(data.trade);
    setProposalStatus(
      data.accepted
        ? 'Trade accepted! Player rights transferred and cap space updated.'
        : 'Trade rejected. Add value to the incoming side.',
    );
    if (data.accepted) {
      pushAlert(buildChantAlert(teamAbbr, 'BIG_TRADE'));
    }
    await refreshSaveHeader();
  };

  const partnerTeam = teams.find((team) => team.abbr === partnerTeamAbbr);
  const sendSlots = useMemo(() => {
    const assets = trade?.sendAssets ?? [];
    const used = new Set<string>();
    const slots = sendSlotIds.map((id) => {
      if (!id) return null;
      const asset = assets.find((item) => item.id === id) ?? null;
      if (asset) used.add(asset.id);
      return asset;
    });
    let fillIndex = 0;
    while (fillIndex < slots.length) {
      if (!slots[fillIndex]) {
        const next = assets.find((asset) => !used.has(asset.id)) ?? null;
        if (!next) break;
        slots[fillIndex] = next;
        used.add(next.id);
      }
      fillIndex += 1;
    }
    return slots;
  }, [sendSlotIds, trade?.sendAssets]);
  const receiveSlots = useMemo(() => {
    const assets = trade?.receiveAssets ?? [];
    const used = new Set<string>();
    const slots = receiveSlotIds.map((id) => {
      if (!id) return null;
      const asset = assets.find((item) => item.id === id) ?? null;
      if (asset) used.add(asset.id);
      return asset;
    });
    let fillIndex = 0;
    while (fillIndex < slots.length) {
      if (!slots[fillIndex]) {
        const next = assets.find((asset) => !used.has(asset.id)) ?? null;
        if (!next) break;
        slots[fillIndex] = next;
        used.add(next.id);
      }
      fillIndex += 1;
    }
    return slots;
  }, [receiveSlotIds, trade?.receiveAssets]);

  const buildSlotAsset = (
    asset: TradeAsset | null,
    roster: PlayerRowDTO[],
  ): TradeSlotAsset | null => {
    if (!asset) {
      return null;
    }
    if (asset.type === 'player') {
      const player = roster.find((item) => item.id === asset.playerId);
      return {
        id: asset.id,
        type: 'player',
        label: player ? `${player.firstName} ${player.lastName}` : asset.label,
        sublabel: player ? `${player.position} · ${player.capHit}` : asset.label,
        headshotUrl: player?.headshotUrl,
      };
    }
    return {
      id: asset.id,
      type: 'pick',
      label: asset.label,
      sublabel: asset.pickId ? `${asset.pickId.toUpperCase()}` : 'Draft Pick',
    };
  };

  const openPicker = (side: 'send' | 'receive', slotIndex: number, replaceAsset?: TradeAsset) => {
    if (!replaceAsset) {
      if (side === 'send' && (trade?.sendAssets.length ?? 0) >= 5) {
        return;
      }
      if (side === 'receive' && (trade?.receiveAssets.length ?? 0) >= 5) {
        return;
      }
    }
    setDuplicateMessage(null);
    setActiveModalSide(side);
    setActiveSlotIndex(slotIndex);
    setPendingReplace(replaceAsset ? { side, asset: replaceAsset } : null);
  };

  return (
    <AppShell>
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
            Propose Trade
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
          {proposalStatus ? (
            <p className="mt-4 text-sm font-medium text-foreground">{proposalStatus}</p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Offer
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {selectedTeam?.name ?? 'Your team'}
                </p>
              </div>
            </div>
            <TradeAssetSlots
              title="YOUR OFFER"
              subtitle="Send assets"
              slots={sendSlots.map((asset) => buildSlotAsset(asset, userRoster))}
              onAdd={(index) => openPicker('send', index)}
              onReplace={(index) => setSlotAction({ side: 'send', slotIndex: index })}
              onRemove={(index) => {
                const asset = trade?.sendAssets[index];
                if (!asset) return;
                setSendSlotIds((prev) => {
                  const next = [...prev];
                  next[index] = null;
                  return next;
                });
                handleRemoveAsset({
                  side: 'send',
                  assetId: asset.id,
                  playerId: asset.playerId,
                  pickId: asset.pickId,
                });
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Their Offer
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {partnerTeam?.name ?? 'Trade partner'}
                </p>
              </div>
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
            </div>
            <TradeAssetSlots
              title="THEIR OFFER"
              subtitle="Receive assets"
              slots={receiveSlots.map((asset) => buildSlotAsset(asset, partnerRoster))}
              onAdd={(index) => openPicker('receive', index)}
              onReplace={(index) => setSlotAction({ side: 'receive', slotIndex: index })}
              onRemove={(index) => {
                const asset = trade?.receiveAssets[index];
                if (!asset) return;
                setReceiveSlotIds((prev) => {
                  const next = [...prev];
                  next[index] = null;
                  return next;
                });
                handleRemoveAsset({
                  side: 'receive',
                  assetId: asset.id,
                  playerId: asset.playerId,
                  pickId: asset.pickId,
                });
              }}
            />
          </div>
        </div>
      </div>

      <TradeAssetPickerModal
        isOpen={activeModalSide !== null && activeSlotIndex !== null}
        title={activeModalSide === 'send' ? 'Add to Your Offer' : 'Add to Their Offer'}
        players={activeModalSide === 'send' ? userRoster : partnerRoster}
        picks={PICK_OPTIONS}
        duplicateMessage={duplicateMessage}
        onClose={() => {
          setActiveModalSide(null);
          setActiveSlotIndex(null);
          setDuplicateMessage(null);
          setPendingReplace(null);
        }}
        onSelectPlayer={(player) => {
          if (!trade || !activeModalSide) return;
          const assets = activeModalSide === 'send' ? trade.sendAssets : trade.receiveAssets;
          if (assets.some((asset) => asset.playerId === player.id)) {
            setDuplicateMessage('That player is already in the offer.');
            return;
          }
          const assetId = `asset-${activeModalSide}-player-${player.id}`;
          if (activeSlotIndex !== null) {
            if (activeModalSide === 'send') {
              setSendSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            } else {
              setReceiveSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            }
          }
          if (pendingReplace) {
            handleRemoveAsset({
              side: pendingReplace.side,
              assetId: pendingReplace.asset.id,
              playerId: pendingReplace.asset.playerId,
              pickId: pendingReplace.asset.pickId,
            });
          }
          handleAddAsset({ side: activeModalSide, type: 'player', playerId: player.id });
        }}
        onSelectPick={(pickId) => {
          if (!trade || !activeModalSide) return;
          const assets = activeModalSide === 'send' ? trade.sendAssets : trade.receiveAssets;
          if (assets.some((asset) => asset.pickId === pickId)) {
            setDuplicateMessage('That pick is already in the offer.');
            return;
          }
          const assetId = `asset-${activeModalSide}-pick-${pickId}`;
          if (activeSlotIndex !== null) {
            if (activeModalSide === 'send') {
              setSendSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            } else {
              setReceiveSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            }
          }
          if (pendingReplace) {
            handleRemoveAsset({
              side: pendingReplace.side,
              assetId: pendingReplace.asset.id,
              playerId: pendingReplace.asset.playerId,
              pickId: pendingReplace.asset.pickId,
            });
          }
          handleAddAsset({ side: activeModalSide, type: 'pick', pickId });
        }}
      />

      {slotAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">Modify slot</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Would you like to replace this asset or remove it from the offer?
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setSlotAction(null);
                  const assets =
                    slotAction.side === 'send' ? trade?.sendAssets : trade?.receiveAssets;
                  const asset = assets?.[slotAction.slotIndex];
                  if (asset) {
                    openPicker(slotAction.side, slotAction.slotIndex, asset);
                  }
                }}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const assets =
                    slotAction.side === 'send' ? trade?.sendAssets : trade?.receiveAssets;
                  const asset = assets?.[slotAction.slotIndex];
                  if (asset) {
                    if (slotAction.side === 'send') {
                      setSendSlotIds((prev) => {
                        const next = [...prev];
                        next[slotAction.slotIndex] = null;
                        return next;
                      });
                    } else {
                      setReceiveSlotIds((prev) => {
                        const next = [...prev];
                        next[slotAction.slotIndex] = null;
                        return next;
                      });
                    }
                    handleRemoveAsset({
                      side: slotAction.side,
                      assetId: asset.id,
                      playerId: asset.playerId,
                      pickId: asset.pickId,
                    });
                  }
                  setSlotAction(null);
                }}
              >
                Remove
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSlotAction(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function TradeBuilderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TradeBuilderContent />
    </Suspense>
  );
}
