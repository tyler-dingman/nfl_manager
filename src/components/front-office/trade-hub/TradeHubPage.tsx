'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  CirclePlus,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
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
}: {
  source: TeamTradeAssetSourceDTO | null;
  selected: TradeAsset[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onToggle: (type: 'player' | 'pick', id: string, selected: boolean) => void;
}) {
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
                <button
                  key={player.id}
                  className={checked ? styles.selectedAsset : ''}
                  onClick={() => onToggle('player', player.id, checked)}
                >
                  <span className={styles.check}>{checked ? '✓' : ''}</span>
                  <span className={styles.playerIdentity}>
                    {player.headshotUrl ? (
                      <Image src={player.headshotUrl} alt="" width={28} height={28} />
                    ) : null}
                    <b>{playerName(player)}</b>
                  </span>
                  <span>{player.position}</span>
                  <span>{resolvePlayerRating(player) ?? '—'}</span>
                  <span>{player.capHit || '—'}</span>
                </button>
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
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartOpen, setChartOpen] = useState(false);
  const userAbbr = save.teamAbbr || selectedTeam?.abbr || '';
  const userTeam = teams.find((team) => team.abbr === userAbbr);
  const partnerTeam = teams.find((team) => team.abbr === partner);

  const resolveSave = useCallback(
    async () =>
      ensureRecoverableSaveId(
        {
          preferredSaveId: save.saveId,
          teamId: save.teamId,
          teamAbbr: userAbbr,
          year: save.franchiseYear,
          capSpace: save.capSpace,
          capLimit: save.capLimit,
          roster: save.roster,
          phase: save.phase,
          unlocked: save.unlocked,
        },
        setSaveHeader,
      ),
    [save, setSaveHeader, userAbbr],
  );
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
    setStatus('');
    setAnalysis(null);
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
      setCaps(payload.caps ?? { user: save.capSpace, partner: 0 });
      setLiveNeeds(payload.needs ?? { user: [], partner: [] });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load Trade Machine.');
    } finally {
      setLoading(false);
    }
  }, [partner, resolveSave, save.capSpace, userAbbr]);
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
    if (!trade) return;
    const saveId = await resolveSave();
    if (!saveId) return;
    const existing = (side === 'send' ? trade.sendAssets : trade.receiveAssets).find((asset) =>
      type === 'player' ? asset.playerId === id : asset.pickId === id,
    );
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
      void analyze(next);
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

  const balance = analysis
    ? Math.max(5, Math.min(95, 50 + analysis.packageValues.difference / 4))
    : 50;
  if (loading && !trade) return <div className={styles.status}>Loading the Trade Machine…</div>;
  if (status && !trade)
    return (
      <div className={styles.status}>
        <b>Trade Machine unavailable</b>
        <span>{status}</span>
        <button onClick={() => void load()}>Try again</button>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.workspace}>
        <section className={styles.teamPanel}>
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
            <button onClick={() => void load()}>
              <RefreshCcw /> Reset trade
            </button>
          </header>
          <div className={styles.packages}>
            <section>
              <h3>{userTeam?.name ?? userAbbr} receive</h3>
              {renderPackage(
                trade?.receiveAssets ?? [],
                partnerSource,
                'Add players, picks, or assets from the right panel',
              )}
            </section>
            <section>
              <h3>{partnerTeam?.name ?? 'Other team'} receive</h3>
              {renderPackage(
                trade?.sendAssets ?? [],
                userSource,
                'Add players, picks, or assets from the left panel',
              )}
            </section>
          </div>
          <section className={styles.analysis}>
            <h3>
              <BarChart3 /> Trade Analysis
            </h3>
            {analysis ? (
              <>
                <div className={styles.valueLabels}>
                  <span>
                    <b>{userTeam?.abbr}</b>
                    <small>{analysis.packageValues.incoming.toFixed(0)} value</small>
                  </span>
                  <strong>
                    {analysis.packageValues.difference === 0
                      ? 'Fair trade'
                      : analysis.packageValues.difference > 0
                        ? `Value for ${userAbbr}`
                        : `Value for ${partner}`}
                  </strong>
                  <span>
                    <b>{partner}</b>
                    <small>{analysis.packageValues.outgoing.toFixed(0)} value</small>
                  </span>
                </div>
                <div className={styles.valueBar}>
                  <i style={{ left: `${balance}%` }} />
                </div>
                <div className={styles.analysisMessage}>
                  <b>
                    {analysis.proposal.isValid
                      ? analysis.likelyAccepted
                        ? 'Likely to be accepted'
                        : 'More value may be needed'
                      : 'Trade needs attention'}
                  </b>
                  <span>
                    {analysis.proposal.validationErrors[0]?.message ??
                      analysis.simulation.warnings[0] ??
                      'Package values, contracts, and cap impact are based on the current save.'}
                  </span>
                </div>
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
            disabled={!analysis || !trade?.sendAssets.length || !trade.receiveAssets.length}
            onClick={() =>
              setStatus(
                analysis?.likelyAccepted
                  ? 'CPU evaluation: likely to be accepted. No league state has been changed.'
                  : 'CPU evaluation: this package is unlikely to be accepted. No league state has been changed.',
              )
            }
          >
            Propose Trade
          </button>
          <small className={styles.disclaimer}>
            This is a hypothetical evaluation. No changes will be made to your league.
          </small>
          {status ? <p className={styles.proposalStatus}>{status}</p> : null}
        </main>
        <section className={styles.teamPanel}>
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
              <select value={partner} onChange={(event) => setPartner(event.target.value)}>
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
                <b>{money(caps.user)}</b>
              </span>
              <span>
                <small>Projected</small>
                <b>{money(analysis.simulation.teams.sending.resultingCapSpace)}</b>
              </span>
              <span>
                <small>{partner} current</small>
                <b>{money(caps.partner)}</b>
              </span>
              <span>
                <small>Projected</small>
                <b>{money(analysis.simulation.teams.receiving.resultingCapSpace)}</b>
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
