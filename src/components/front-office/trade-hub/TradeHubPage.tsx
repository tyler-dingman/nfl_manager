'use client';

import Image from 'next/image';
import PlayerDetailsModal from '@/components/player-details-modal';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Handshake,
  ChevronDown,
  CirclePlus,
  RefreshCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DdTradeHubIcon as ArrowLeftRight,
  DdPlayerComparisonIcon as BarChart3,
} from '@/components/ui/football-icons';
import { DdSearchIcon as Search } from '@/components/ui/football-icons';

import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { dispatchSaveDataUpdated } from '@/lib/save-sync-events';
import { invalidatePlayerQueryCache } from '@/features/players/queries';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
import type { TeamTradeAssetSourceDTO, TradePickAssetDTO } from '@/types/trade-offers';
import styles from './trade-hub.module.css';

type Side = 'send' | 'receive';
type Tab = 'players' | 'picks' | 'other';
type TradeAsset = {
  id: string;
  type: 'player' | 'pick';
  side: Side;
  label: string;
  value: number;
  playerId?: string;
  pickId?: string;
};
type Trade = {
  id: string;
  partnerTeamAbbr: string;
  sendAssets: TradeAsset[];
  receiveAssets: TradeAsset[];
};
type Analysis = {
  acceptance: number;
  likelyAccepted: boolean;
  packageValues: { outgoing: number; incoming: number; difference: number };
  simulation: { teams: { sending: CapImpact; receiving: CapImpact }; warnings: string[] };
  proposal: { isValid: boolean; validationErrors: Array<{ message: string }> };
};
type CapImpact = { capDelta: number; resultingCapSpace: number; deadCap: number; savings: number };

const money = (value: number) => `$${value.toFixed(1)}M`;
const playerName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

function TeamMark({ abbr, name, size = 36 }: { abbr: string; name: string; size?: number }) {
  const team = TEAM_LIST.find((item) => item.abbr === abbr);
  return team?.logoUrl ? (
    <Image src={team.logoUrl} alt={`${name} logo`} width={size} height={size} />
  ) : (
    <span className={styles.fallbackLogo}>{abbr}</span>
  );
}

function AssetBrowser({
  source,
  selected,
  tab,
  onTab,
  onToggle,
  side,
  disabled,
}: {
  side: Side;
  disabled: boolean;
  source: TeamTradeAssetSourceDTO | null;
  selected: TradeAsset[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onToggle: (type: 'player' | 'pick', id: string, selected: boolean) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailTeams = useTeamStore((state) => state.teams);
  const detailSave = useSaveStore();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [contract, setContract] = useState('ALL');
  const selectedPlayers = new Set(selected.map((asset) => asset.playerId).filter(Boolean));
  const selectedPicks = new Set(selected.map((asset) => asset.pickId).filter(Boolean));
  const positions = useMemo(
    () => [...new Set((source?.players ?? []).map((player) => player.position))].sort(),
    [source],
  );
  const players = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (source?.players ?? []).filter((player) => {
      const years = player.contractYearsRemaining ?? 0;
      return (
        (!needle || `${playerName(player)} ${player.position}`.toLowerCase().includes(needle)) &&
        (position === 'ALL' || player.position === position) &&
        (contract === 'ALL' ||
          (contract === 'EXPIRING' && years <= 1) ||
          (contract === 'MULTI' && years > 1))
      );
    });
  }, [contract, position, query, source]);

  return (
    <div className={styles.browser}>
      <PlayerDetailsModal
        isOpen={Boolean(detailId)}
        source={
          source?.players.find((player) => player.id === detailId)
            ? {
                kind: 'tradeAsset',
                player: source.players.find((player) => player.id === detailId)!,
              }
            : null
        }
        sources={players.map((player) => ({ kind: 'tradeAsset', player }))}
        roster={source?.players ?? []}
        teams={detailTeams}
        userTeamAbbr={detailSave.teamAbbr}
        capSpace={detailSave.capSpace}
        capLimit={detailSave.capLimit}
        onClose={() => setDetailId(null)}
        onSelectSource={(entry) => setDetailId(entry.player.id)}
      />
      <div className={styles.tabs}>
        <button
          className={tab === 'players' ? styles.activeTab : ''}
          onClick={() => onTab('players')}
        >
          Players
        </button>
        <button className={tab === 'picks' ? styles.activeTab : ''} onClick={() => onTab('picks')}>
          Draft Picks
        </button>
        <button className={tab === 'other' ? styles.activeTab : ''} onClick={() => onTab('other')}>
          Other Assets
        </button>
      </div>
      {tab === 'players' ? (
        <>
          <div className={styles.filters}>
            <label>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players..."
                aria-label="Search trade players"
              />
            </label>
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              aria-label="Position filter"
            >
              <option value="ALL">All positions</option>
              {positions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={contract}
              onChange={(event) => setContract(event.target.value)}
              aria-label="Contract filter"
            >
              <option value="ALL">All contracts</option>
              <option value="EXPIRING">Expiring</option>
              <option value="MULTI">Multi-year</option>
            </select>
          </div>
          <div className={styles.tableHead}>
            <span>Player</span>
            <span>Pos</span>
            <span>OVR</span>
            <span>Cap hit</span>
          </div>
          <div className={styles.assetList}>
            {players.map((player) => {
              const checked = selectedPlayers.has(player.id);
              return (
                <div className={styles.assetRow} key={player.id}>
                  <button
                    disabled={disabled}
                    draggable={!disabled && !checked}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/x-trade-asset',
                        JSON.stringify({ side, type: 'player', id: player.id }),
                      );
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={checked ? styles.selectedAsset : ''}
                    onClick={() => onToggle('player', player.id, checked)}
                  >
                    <span className={styles.check}>{checked ? '✓' : ''}</span>
                    <span className={styles.playerIdentity}>
                      {player.headshotUrl ? (
                        <Image
                          src={player.headshotUrl}
                          alt=""
                          width={28}
                          height={28}
                          draggable={false}
                        />
                      ) : null}
                      <b>{playerName(player)}</b>
                    </span>
                    <span>{player.position}</span>
                    <span>{resolvePlayerRating(player) ?? '—'}</span>
                    <span>{player.capHit || '—'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.viewPlayer}
                    aria-label={`View ${playerName(player)} details`}
                    onClick={() => setDetailId(player.id)}
                  >
                    Details
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : tab === 'picks' ? (
        <div className={styles.pickList}>
          {(source?.draftPicks ?? []).map((pick) => {
            const checked = selectedPicks.has(pick.id);
            return (
              <button
                key={pick.id}
                disabled={disabled}
                draggable={!disabled && !checked}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    'application/x-trade-asset',
                    JSON.stringify({ side, type: 'pick', id: pick.id }),
                  );
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                className={checked ? styles.selectedAsset : ''}
                onClick={() => onToggle('pick', pick.id, checked)}
              >
                <span className={styles.check}>{checked ? '✓' : ''}</span>
                <span>
                  <b>
                    {pick.year} Round {pick.round}
                  </b>
                  <small>
                    {pick.overallSlot
                      ? `Pick ${pick.overallSlot}`
                      : `Originally ${pick.originalTeamAbbr}`}
                  </small>
                </span>
                <strong>{Math.round(pick.projectedValuePoints)}</strong>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyAssets}>
          <ShieldCheck />
          <b>No other tradable assets</b>
          <span>This save currently supports players and owned draft picks.</span>
        </div>
      )}
    </div>
  );
}

export function TradeHubPage() {
  const userBrowserRef = useRef<HTMLElement>(null);
  const partnerBrowserRef = useRef<HTMLElement>(null);
  const focusAssetBrowser = (side: Side) => {
    const browser = (side === 'send' ? userBrowserRef : partnerBrowserRef).current;
    browser?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (
      browser?.querySelector<HTMLElement>('input') ??
      browser?.querySelector<HTMLElement>('button:not(:disabled)')
    )?.focus({ preventScroll: true });
  };
  const save = useSaveStore();
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [partner, setPartner] = useState('');
  const [trade, setTrade] = useState<Trade | null>(null);
  const [userSource, setUserSource] = useState<TeamTradeAssetSourceDTO | null>(null);
  const [partnerSource, setPartnerSource] = useState<TeamTradeAssetSourceDTO | null>(null);
  const [caps, setCaps] = useState({ user: save.capSpace, partner: 0 });
  const [liveNeeds, setLiveNeeds] = useState<{ user: string[]; partner: string[] }>({
    user: [],
    partner: [],
  });
  const [leftTab, setLeftTab] = useState<Tab>('players');
  const [rightTab, setRightTab] = useState<Tab>('players');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [tradeResult, setTradeResult] = useState<{
    accepted: boolean;
    partnerName: string;
    reason?: string;
    estimate: number;
    moves: Array<{ label: string; destination: string }>;
  } | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const packagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tradeResult || loading) return;
    const card = resultRef.current;
    if (!card) return;
    card.focus({ preventScroll: true });
    const bounds = card.getBoundingClientRect();
    const headerBottom =
      document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom ?? 0;
    if (bounds.top < headerBottom || bounds.bottom > window.innerHeight) {
      card.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'center',
      });
    }
  }, [tradeResult, loading]);
  useEffect(() => {
    setTradeResult(null);
  }, [partner]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [dropSide, setDropSide] = useState<Side | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const userAbbr = save.teamAbbr || selectedTeam?.abbr || '';
  const userTeam = teams.find((team) => team.abbr === userAbbr);
  const partnerTeam = teams.find((team) => team.abbr === partner);

  const resolveSave = useCallback(async () => {
    const current = useSaveStore.getState();
    return ensureRecoverableSaveId(
      {
        preferredSaveId: current.saveId,
        teamId: current.teamId,
        teamAbbr: current.teamAbbr || userAbbr,
        year: current.franchiseYear,
        capSpace: current.capSpace,
        capLimit: current.capLimit,
        roster: current.roster,
        phase: current.phase,
        unlocked: current.unlocked,
      },
      setSaveHeader,
    );
  }, [setSaveHeader, userAbbr]);
  useEffect(() => {
    void apiFetch('/api/teams')
      .then((response) => response.json())
      .then((body: TeamDTO[]) => setTeams(body));
  }, []);
  useEffect(() => {
    if (!teams.length || partner) return;
    setPartner(teams.find((team) => team.abbr !== userAbbr)?.abbr ?? '');
  }, [partner, teams, userAbbr]);

  const load = useCallback(async () => {
    if (!partner || !userAbbr) return;
    setLoading(true);
    setAnalysis(null);
    setTrade(null);
    try {
      const saveId = await resolveSave();
      if (!saveId) throw new Error('Unable to resolve the active Front Office save.');
      const create = await apiFetch(
        '/api/trades/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveId, teamAbbr: userAbbr, partnerTeamAbbr: partner }),
        },
        { skipSaveGuard: true },
      );
      const created = await create.json();
      if (!create.ok) throw new Error(created.error ?? 'Unable to create trade workspace.');
      setTrade(created.trade);
      const assets = await apiFetch('/api/trade-offers/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId, partnerTeamAbbr: partner }),
      });
      const payload = await assets.json();
      if (!assets.ok || !payload.ok)
        throw new Error(payload.error ?? 'Unable to load team assets.');
      setUserSource(payload.user);
      setPartnerSource(payload.partner);
      setCaps(payload.caps ?? { user: useSaveStore.getState().capSpace, partner: 0 });
      setLiveNeeds(payload.needs ?? { user: [], partner: [] });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load Trade Machine.');
    } finally {
      setLoading(false);
    }
  }, [partner, resolveSave, userAbbr]);
  useEffect(() => {
    void load();
  }, [load]);

  const analyze = useCallback(
    async (nextTrade: Trade) => {
      const saveId = await resolveSave();
      if (!saveId) return;
      if (!nextTrade.sendAssets.length && !nextTrade.receiveAssets.length) {
        setAnalysis(null);
        return;
      }
      const response = await apiFetch(`/api/trades/${nextTrade.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId }),
      });
      if (response.ok) setAnalysis(await response.json());
    },
    [resolveSave],
  );

  const toggleAsset = async (
    side: Side,
    type: 'player' | 'pick',
    id: string,
    selected: boolean,
  ) => {
    if (!trade || busyRef.current || loading) return;
    busyRef.current = true;
    setBusy(true);
    setStatus('');
    setTradeResult(null);
    try {
      const saveId = await resolveSave();
      if (!saveId) throw new Error('Unable to load your save. Please reload and try again.');
      const existing = (side === 'send' ? trade.sendAssets : trade.receiveAssets).find((asset) =>
        type === 'player' ? asset.playerId === id : asset.pickId === id,
      );
      if (!selected && existing) return;
      const endpoint = selected && existing ? 'remove-asset' : 'add-asset';
      const response = await apiFetch(`/api/trades/${trade.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          side,
          type,
          ...(type === 'player' ? { playerId: id } : { pickId: id }),
          ...(existing ? { assetId: existing.id } : {}),
        }),
      });
      if (response.ok) {
        const next = (await response.json()) as Trade;
        setTrade(next);
        await analyze(next);
      } else {
        const body = await response.json();
        throw new Error(body.error ?? 'Unable to update trade assets.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update trade.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const dropAsset = (event: React.DragEvent) => {
    event.preventDefault();
    setDropSide(null);
    if (busyRef.current || loading) return;
    try {
      const asset = JSON.parse(event.dataTransfer.getData('application/x-trade-asset'));
      if (
        !['send', 'receive'].includes(asset.side) ||
        !['player', 'pick'].includes(asset.type) ||
        typeof asset.id !== 'string'
      )
        return;
      // Ownership determines the package, even when dropped on the opposite box.
      const side: Side = asset.side;
      const source = side === 'send' ? userSource : partnerSource;
      if (
        asset.type === 'player'
          ? !source?.players.some((p) => p.id === asset.id)
          : !source?.draftPicks.some((p) => p.id === asset.id)
      )
        return;
      void toggleAsset(side, asset.type, asset.id, false);
    } catch {
      /* Ignore unrelated drag payloads. */
    }
  };
  const executeTrade = async () => {
    if (!trade || busyRef.current || !analysis?.proposal.isValid) return;
    busyRef.current = true;
    setBusy(true);
    setReviewing(true);
    setTradeResult(null);
    setStatus('');
    try {
      const saveId = await resolveSave();
      if (!saveId) throw new Error('Unable to load your save.');
      const response = await apiFetch(`/api/trades/${trade.id}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId }),
      });
      const result = await response.json();
      if (!response.ok || result.ok === false)
        throw new Error(result.error ?? 'Unable to submit trade.');
      const outcome = {
        accepted: Boolean(result.accepted),
        partnerName: partnerTeam?.name ?? partner,
        reason:
          result.proposal?.validationErrors?.[0]?.message ??
          'Offer more value to the other team to make this deal work.',
        estimate: result.acceptance ?? analysis.acceptance,
        moves: [
          ...trade.sendAssets.map((asset) => ({
            label: asset.playerId
              ? (() => {
                  const player = userSource?.players.find((p) => p.id === asset.playerId);
                  return player ? playerName(player) : asset.label;
                })()
              : asset.label,
            destination: partnerTeam?.name ?? partner,
          })),
          ...trade.receiveAssets.map((asset) => ({
            label: asset.playerId
              ? (() => {
                  const player = partnerSource?.players.find((p) => p.id === asset.playerId);
                  return player ? playerName(player) : asset.label;
                })()
              : asset.label,
            destination: userTeam?.name ?? userAbbr,
          })),
        ],
      };
      setTradeResult(outcome);
      if (!result.accepted) return;
      setTrade(null);
      setAnalysis(null);
      setSaveHeader(result.header);
      invalidatePlayerQueryCache(undefined, saveId);
      const rosterResponse = await apiFetch(
        `/api/roster?${new URLSearchParams({ saveId, teamAbbr: userAbbr })}`,
      );
      if (rosterResponse.ok) useSaveStore.getState().setRoster(await rosterResponse.json());
      dispatchSaveDataUpdated({ saveId, teamAbbr: userAbbr, reason: 'trade-accepted' });
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to submit trade.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      setReviewing(false);
    }
  };

  const renderPackage = (
    assets: TradeAsset[],
    source: TeamTradeAssetSourceDTO | null,
    emptyText: string,
  ) =>
    assets.length ? (
      assets.map((asset) => {
        const player = asset.playerId
          ? source?.players.find((item) => item.id === asset.playerId)
          : null;
        const pick = asset.pickId
          ? source?.draftPicks.find((item) => item.id === asset.pickId)
          : null;
        return (
          <div className={styles.packageAsset} key={asset.id}>
            {player?.headshotUrl ? (
              <Image src={player.headshotUrl} alt="" width={34} height={34} />
            ) : (
              <span className={styles.assetIcon}>{asset.type === 'pick' ? 'P' : 'NFL'}</span>
            )}
            <span>
              <b>
                {player
                  ? playerName(player)
                  : pick
                    ? `${pick.year} Round ${pick.round}`
                    : asset.label}
              </b>
              <small>
                {player
                  ? `${player.position} · ${player.capHit}`
                  : pick?.overallSlot
                    ? `Pick ${pick.overallSlot}`
                    : 'Draft pick'}
              </small>
            </span>
            <button
              onClick={() =>
                void toggleAsset(asset.side, asset.type, (asset.playerId ?? asset.pickId)!, true)
              }
              disabled={busy || loading}
              aria-label="Remove asset"
            >
              <X />
            </button>
          </div>
        );
      })
    ) : (
      <div className={styles.packageEmpty}>
        <CirclePlus />
        <span>{emptyText}</span>
      </div>
    );

  const totalValue = analysis
    ? analysis.packageValues.incoming + analysis.packageValues.outgoing
    : 0;
  const valueShare = totalValue > 0 ? analysis!.packageValues.incoming / totalValue : 0.5;
  const completePackage = Boolean(trade?.sendAssets.length && trade.receiveAssets.length);
  const grade = !completePackage
    ? '—'
    : !analysis?.proposal.isValid
      ? 'D'
      : valueShare >= 0.6
        ? 'A'
        : valueShare >= 0.53
          ? 'B+'
          : valueShare >= 0.47
            ? 'B'
            : valueShare >= 0.4
              ? 'C'
              : 'D';
  const verdict = !completePackage
    ? 'Incomplete proposal'
    : !analysis?.proposal.isValid
      ? 'Needs attention'
      : valueShare >= 0.53
        ? 'Favorable'
        : valueShare >= 0.47
          ? 'Balanced'
          : 'Costly';
  const acceptance =
    analysis?.proposal.isValid && completePackage
      ? Math.max(0, Math.min(100, Math.round(analysis.acceptance)))
      : 0;
  const incomingPicks = trade?.receiveAssets.filter((asset) => asset.type === 'pick').length ?? 0;
  const outgoingPicks = trade?.sendAssets.filter((asset) => asset.type === 'pick').length ?? 0;
  const capChange = analysis ? analysis.simulation.teams.sending.resultingCapSpace - caps.user : 0;
  const gradeSummary = !completePackage
    ? 'Add assets from both teams to evaluate the complete proposal.'
    : (analysis?.proposal.validationErrors[0]?.message ??
      `${valueShare >= 0.53 ? 'Receives more value than it sends' : valueShare >= 0.47 ? 'Exchanges comparable package value' : 'Sends more value than it receives'}, with ${money(Math.abs(capChange))} ${capChange >= 0 ? 'added to' : 'used from'} your available cap space.`);
  if (loading && !trade) return <div className={styles.status}>Loading the Trade Machine…</div>;
  if (status && !trade && !tradeResult)
    return (
      <div className={styles.status}>
        <b>Trade Machine unavailable</b>
        <span>{status}</span>
        <button
          disabled={busy || loading}
          onClick={() => {
            setStatus('');
            void load();
          }}
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.workspace}>
        <section className={styles.teamPanel} ref={userBrowserRef}>
          <header>
            <TeamMark abbr={userAbbr} name={userTeam?.name ?? 'Your team'} />
            <span>
              <b>{userTeam?.name ?? selectedTeam?.name ?? 'Your team'}</b>
              <small>
                OVR {userTeam?.teamOverview ?? '—'} · {money(caps.user)} cap space
              </small>
            </span>
          </header>
          <AssetBrowser
            side="send"
            disabled={busy || loading}
            source={userSource}
            selected={trade?.sendAssets ?? []}
            tab={leftTab}
            onTab={setLeftTab}
            onToggle={(type, id, checked) => void toggleAsset('send', type, id, checked)}
          />
        </section>
        <main className={styles.proposal}>
          <header>
            <h2>
              <ArrowLeftRight /> Trade Proposal
            </h2>
            <button
              disabled={busy || loading}
              onClick={() => {
                setTradeResult(null);
                setStatus('');
                void load();
              }}
            >
              <RefreshCcw /> Reset trade
            </button>
          </header>
          <div className={styles.packages} ref={packagesRef} tabIndex={-1}>
            <section
              aria-label="Your team sends"
              data-drop-active={dropSide === 'send'}
              onDragOver={(e) => {
                e.preventDefault();
                setDropSide('send');
              }}
              onDragLeave={() => setDropSide(null)}
              onDrop={dropAsset}
            >
              <h3>{userTeam?.name ?? userAbbr}</h3>
              {renderPackage(
                trade?.sendAssets ?? [],
                userSource,
                'Drag players or picks here from your team, or click to add',
              )}
              {Boolean(trade?.sendAssets.length) && (
                <button
                  type="button"
                  className={styles.addPackageAsset}
                  disabled={busy || loading}
                  aria-label="Add players or picks from your team"
                  onClick={() => focusAssetBrowser('send')}
                  title="Add or drop another player or pick"
                >
                  <CirclePlus size={22} />
                </button>
              )}
            </section>
            <section
              aria-label="Your team receives"
              data-drop-active={dropSide === 'receive'}
              onDragOver={(e) => {
                e.preventDefault();
                setDropSide('receive');
              }}
              onDragLeave={() => setDropSide(null)}
              onDrop={dropAsset}
            >
              <h3>{partnerTeam?.name ?? partner}</h3>
              {renderPackage(
                trade?.receiveAssets ?? [],
                partnerSource,
                'Drag players or picks here from the other team, or click to add',
              )}
              {Boolean(trade?.receiveAssets.length) && (
                <button
                  type="button"
                  className={styles.addPackageAsset}
                  disabled={busy || loading}
                  aria-label="Add players or picks from the other team"
                  onClick={() => focusAssetBrowser('receive')}
                  title="Add or drop another player or pick"
                >
                  <CirclePlus size={22} />
                </button>
              )}
            </section>
          </div>
          {tradeResult && (
            <section
              ref={resultRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={styles.tradeResult}
              data-accepted={tradeResult.accepted}
              aria-label={tradeResult.accepted ? 'Trade accepted' : 'Trade declined'}
            >
              <button
                type="button"
                className={styles.resultClose}
                aria-label="Dismiss trade result"
                onClick={() => {
                  setTradeResult(null);
                  packagesRef.current?.focus({ preventScroll: true });
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
              <h3>
                {tradeResult.accepted ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                {tradeResult.accepted ? 'TRADE ACCEPTED' : 'TRADE DECLINED'}
              </h3>
              <p>
                {tradeResult.partnerName} has {tradeResult.accepted ? 'accepted' : 'declined'} your
                trade proposal.
              </p>
              {tradeResult.accepted ? (
                <>
                  <ul>
                    {tradeResult.moves.map((move, index) => (
                      <li key={index}>
                        {move.label} <ArrowRight size={14} aria-hidden="true" /> {move.destination}
                      </li>
                    ))}
                  </ul>
                  <strong className={styles.completed}>
                    <Check size={18} aria-hidden="true" /> Trade Completed
                  </strong>
                  <p>
                    Players and picks have been transferred. Both teams’ rosters and cap space have
                    been updated.
                  </p>
                </>
              ) : (
                <>
                  <p>{tradeResult.reason}</p>
                  <small>Current acceptance estimate: {Math.round(tradeResult.estimate)}%</small>
                  <button
                    type="button"
                    onClick={() => {
                      setTradeResult(null);
                      packagesRef.current?.focus({ preventScroll: true });
                      packagesRef.current?.scrollIntoView({
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                          ? 'instant'
                          : 'smooth',
                        block: 'center',
                      });
                    }}
                  >
                    Adjust Trade
                  </button>
                </>
              )}
            </section>
          )}
          {status ? (
            <p role="status" className={styles.proposalStatus}>
              {status}
            </p>
          ) : null}
          <section className={styles.analysis}>
            <h3>
              <BarChart3 /> Trade Analysis
            </h3>
            {analysis ? (
              <>
                <div className={styles.gradeBody}>
                  <div
                    className={styles.gradeRing}
                    style={
                      {
                        '--ring-fill': `${completePackage ? valueShare * 100 : 0}%`,
                      } as CSSProperties
                    }
                  >
                    <strong>{grade}</strong>
                  </div>
                  <div className={styles.gradeCopy}>
                    <h4
                      data-favorable={
                        completePackage && analysis.proposal.isValid && valueShare >= 0.47
                      }
                    >
                      {verdict}
                    </h4>
                    <p>{gradeSummary}</p>
                    <div className={styles.gradeChips}>
                      <span
                        data-tone={
                          analysis.packageValues.difference > 0
                            ? 'positive'
                            : analysis.packageValues.difference < 0
                              ? 'negative'
                              : 'neutral'
                        }
                      >
                        {analysis.packageValues.difference > 0
                          ? '↑'
                          : analysis.packageValues.difference < 0
                            ? '↓'
                            : '−'}{' '}
                        {Math.abs(analysis.packageValues.difference).toFixed(0)} net value
                      </span>
                      <span
                        data-tone={
                          incomingPicks > outgoingPicks
                            ? 'positive'
                            : incomingPicks < outgoingPicks
                              ? 'negative'
                              : 'neutral'
                        }
                      >
                        {incomingPicks > outgoingPicks
                          ? '↑ Adds'
                          : incomingPicks < outgoingPicks
                            ? '↓ Sends'
                            : '− Neutral'}{' '}
                        draft capital
                      </span>
                      <span
                        data-tone={
                          Math.abs(capChange) < 1
                            ? 'neutral'
                            : capChange > 0
                              ? 'positive'
                              : 'negative'
                        }
                      >
                        {Math.abs(capChange) < 1
                          ? '− Minimal cap impact'
                          : `${capChange >= 0 ? '↑' : '↓'} ${money(Math.abs(capChange))} cap space`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.acceptanceSection}>
                  <div>
                    <h4>
                      <Handshake /> Likelihood to be Accepted
                    </h4>
                    <div
                      className={styles.acceptanceBar}
                      role="meter"
                      aria-label="Acceptance estimate"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={acceptance}
                    >
                      <span style={{ width: `${acceptance}%` }} />
                    </div>
                    <p>
                      {!completePackage
                        ? 'Add assets from both teams to estimate acceptance.'
                        : !analysis.proposal.isValid
                          ? 'Resolve the trade requirements before proposing.'
                          : `${partnerTeam?.name ?? partner}: ${analysis.likelyAccepted ? 'likely to accept' : 'more value may be needed'} based on the current offer.`}
                    </p>
                  </div>
                  <div className={styles.acceptanceScore}>
                    <div
                      className={styles.gradeRing}
                      style={{ '--ring-fill': `${acceptance}%` } as CSSProperties}
                    >
                      <strong>{acceptance}%</strong>
                    </div>
                    <span>
                      Acceptance
                      <br />
                      Estimate
                    </span>
                  </div>
                </div>
                <details id="trade-analysis-details" className={styles.analysisDetails}>
                  <summary>Detailed analysis</summary>
                  <p>
                    Value received: {analysis.packageValues.incoming.toFixed(0)} · Value sent:{' '}
                    {analysis.packageValues.outgoing.toFixed(0)}. The grade compares package value
                    from your team’s perspective.
                  </p>
                  <p>
                    Acceptance is the simulation’s offer-value score, not a statistical probability.
                    Valid offers scoring at least 70 are accepted.
                  </p>
                  {analysis.proposal.validationErrors.map((error, i) => (
                    <p key={i}>{error.message}</p>
                  ))}
                  {analysis.simulation.warnings.map((warning, i) => (
                    <p key={i}>{warning}</p>
                  ))}
                </details>
              </>
            ) : (
              <div className={styles.analysisEmpty}>
                <CirclePlus />
                <span>
                  <b>Add assets to get analysis</b>Select players or picks from either team to
                  compare value and cap impact.
                </span>
              </div>
            )}
          </section>
          <button
            className={styles.propose}
            disabled={
              busy ||
              loading ||
              !analysis?.proposal.isValid ||
              !trade?.sendAssets.length ||
              !trade.receiveAssets.length
            }
            onClick={() => void executeTrade()}
          >
            {reviewing ? (
              'Reviewing Offer…'
            ) : busy ? (
              'Updating trade…'
            ) : (
              <>
                <Check size={20} /> Propose Trade
              </>
            )}
          </button>
          <small className={styles.disclaimer}>
            Accepted trades transfer players and picks and update both teams’ cap space.
          </small>
        </main>
        <section className={styles.teamPanel} ref={partnerBrowserRef}>
          <header>
            <TeamMark abbr={partner || 'NFL'} name={partnerTeam?.name ?? 'Select a team'} />
            <span>
              <b>{partnerTeam?.name ?? 'Select a team'}</b>
              <small>
                {partnerTeam
                  ? `OVR ${partnerTeam.teamOverview} · ${money(caps.partner)} cap space`
                  : 'Choose a trade partner'}
              </small>
            </span>
            <label className={styles.teamSelect}>
              <select
                disabled={busy || loading}
                aria-label="Trade partner"
                value={partner}
                onChange={(event) => setPartner(event.target.value)}
              >
                {teams
                  .filter((team) => team.abbr !== userAbbr)
                  .map((team) => (
                    <option key={team.id} value={team.abbr}>
                      {team.name}
                    </option>
                  ))}
              </select>
              <ChevronDown />
            </label>
          </header>
          <AssetBrowser
            side="receive"
            disabled={busy || loading}
            source={partnerSource}
            selected={trade?.receiveAssets ?? []}
            tab={rightTab}
            onTab={setRightTab}
            onToggle={(type, id, checked) => void toggleAsset('receive', type, id, checked)}
          />
        </section>
      </div>
      <div className={styles.supporting}>
        <section>
          <h3>Team Needs Comparison</h3>
          <div className={styles.needs}>
            <TeamMark abbr={userAbbr} name={userTeam?.name ?? userAbbr} size={30} />
            <span>
              <b>{userTeam?.name ?? userAbbr} needs</b>
              <small>{liveNeeds.user.join(' · ') || 'No priority needs listed'}</small>
            </span>
            <i>vs</i>
            <TeamMark abbr={partner} name={partnerTeam?.name ?? partner} size={30} />
            <span>
              <b>{partnerTeam?.name ?? 'Select a team'}</b>
              <small>{liveNeeds.partner.join(' · ') || 'Choose a team to compare needs'}</small>
            </span>
          </div>
        </section>
        <section>
          <h3>Cap Impact</h3>
          {analysis ? (
            <div className={styles.capGrid}>
              <span>
                <small>{userAbbr} current</small>
                <b className="front-office-stat-value">{money(caps.user)}</b>
              </span>
              <span>
                <small>Projected</small>
                <b className="front-office-stat-value">
                  {money(analysis.simulation.teams.sending.resultingCapSpace)}
                </b>
              </span>
              <span>
                <small>{partner} current</small>
                <b className="front-office-stat-value">{money(caps.partner)}</b>
              </span>
              <span>
                <small>Projected</small>
                <b className="front-office-stat-value">
                  {money(analysis.simulation.teams.receiving.resultingCapSpace)}
                </b>
              </span>
            </div>
          ) : (
            <p>Select assets to view the projected cap impact for both teams.</p>
          )}
        </section>
        <section>
          <h3>Draft Pick Value Chart</h3>
          <p>See the transparent value model used to compare picks in your package.</p>
          <button onClick={() => setChartOpen(true)}>View chart →</button>
        </section>
      </div>
      {chartOpen ? (
        <div className={styles.modalBackdrop} onClick={() => setChartOpen(false)}>
          <section className={styles.chartModal} onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setChartOpen(false)} aria-label="Close">
              <X />
            </button>
            <h2>Draft Pick Value Chart</h2>
            <p>
              Pick values use the existing DraftTek Classic model. Future selections are discounted
              consistently by season.
            </p>
            <div>
              {[1, 2, 3, 4, 5, 6, 7].map((round) => (
                <span key={round}>
                  <b>Round {round}</b>
                  <small>
                    {[...(userSource?.draftPicks ?? []), ...(partnerSource?.draftPicks ?? [])]
                      .find((pick: TradePickAssetDTO) => pick.round === round)
                      ?.projectedValuePoints.toFixed(0) ?? 'Varies by slot'}{' '}
                    points
                  </small>
                </span>
              ))}
            </div>
            <Link href="/front-office/draft/room?mode=mock">Open Mock Draft</Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}
