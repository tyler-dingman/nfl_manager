import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO, SaveUnlocksDTO } from '@/types/save';
import type { DraftSessionState } from '@/types/draft';
import type { NewsItemDTO } from '@/types/news';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { TradePickAssetDTO } from '@/types/trade-offers';
import {
  formatMoneyMillions,
  getCapHitSchedule,
  getRookieContract,
  getYearOneCapHit,
} from '@/server/logic/cap';
import { buildPickAsset } from '@/lib/trade-chart';
import { logoUrlFor } from './team';
import { buildFreeAgencyPool, buildFreeAgentProfile } from '@/server/logic/free-agency-pool';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { KANSAS_CITY_CHIEFS_ROSTER } from '@/data/rosters/kc';
import { getExpiringContractsForTeam } from '@/server/logic/expiring-contracts';
import {
  fetchOtcFreeAgency,
  type OtcFreeAgencyRow,
} from '@/server/data-sources/overthecap-free-agency';
import {
  buildInitialFreeAgencyPool,
  buildTeamExpiringContracts,
} from '@/server/logic/offseason-free-agency';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';

export type PlayerFilters = {
  position?: string;
  status?: string;
  query?: string;
};

type StoredPlayer = PlayerRowDTO & {
  year1CapHit: number;
  capHitSchedule?: number[];
};

export type SaveState = {
  header: SaveHeaderDTO;
  roster: StoredPlayer[];
  freeAgents: StoredPlayer[];
  teamRosters: Record<string, StoredPlayer[]>;
  teamCaps: Record<string, number>;
  draftPickAssets: TradePickAssetDTO[];
  transactions: Array<{
    id: string;
    type: 'signing' | 'trade';
    playerId: string;
    fromTeamAbbr?: string;
    toTeamAbbr?: string;
    capHit: number;
    createdAt: string;
  }>;
  draftSessions: Record<string, DraftSessionState>;
  expiringContracts: ExpiringContractRow[];
  newsFeed: NewsItemDTO[];
  rosterMoves: {
    cuts: Array<{ playerId: string; name: string; capSavings: number; timestamp: string }>;
    resigns: Array<{ playerId: string; name: string; timestamp: string }>;
    trades: Array<{ playerId: string; name: string; timestamp: string }>;
  };
  offseason: {
    hydrated: boolean;
    otcRows: OtcFreeAgencyRow[];
    resolvedPlayerIds: string[];
    walkawayPlayerIds: string[];
  };
};

const PICKS_PER_ROUND = 32;

type SaveRestorePayload = {
  teamAbbr: string;
  year?: number;
  capSpace: number;
  capLimit: number;
  roster: PlayerRowDTO[];
  phase?: string;
  unlocked?: SaveUnlocksDTO;
  createdAt?: string;
};

const getTradePickYearsForLeagueYear = (year: number) => [year, year + 1] as const;

const saveStore = new Map<string, SaveState>();
let otcRowsCache: OtcFreeAgencyRow[] | null = null;
let otcRowsPromise: Promise<OtcFreeAgencyRow[]> | null = null;

const getCachedOtcRows = async (): Promise<OtcFreeAgencyRow[]> => {
  if (otcRowsCache) {
    return otcRowsCache;
  }
  if (!otcRowsPromise) {
    otcRowsPromise = fetchOtcFreeAgency()
      .then((rows) => {
        otcRowsCache = rows;
        return rows;
      })
      .catch((error: unknown) => {
        console.warn('[otc:fa] fallback-empty due to fetch error', error);
        otcRowsCache = [];
        return otcRowsCache;
      })
      .finally(() => {
        otcRowsPromise = null;
      });
  }
  return otcRowsPromise;
};

const getExpectedFreeAgentYearOneCapHit = (player: PlayerRowDTO): number => {
  const apy =
    player.freeAgentProfile?.expectedAnnualValue ?? (player.marketValue ?? 1_000_000) / 1_000_000;
  return getYearOneCapHit(apy, 1);
};

const getLeagueYearForSave = (state: SaveState) => state.header.year ?? CURRENT_MODELED_LEAGUE_YEAR;

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: name, lastName: '' };
  }
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

const getLatestContractByPlayerId = () => {
  const contracts = new Map<string, (typeof NFL_LEAGUE_DATA.contracts)[number]>();
  NFL_LEAGUE_DATA.contracts.forEach((contract) => {
    if (!contracts.has(contract.playerId)) {
      contracts.set(contract.playerId, contract);
    }
  });
  return contracts;
};

const leagueContractsByPlayerId = getLatestContractByPlayerId();

const normalizePlayerKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

const rosterFallbackByTeam = new Map<
  string,
  Map<
    string,
    {
      capHit: number;
      deadCap: number;
      baseSalary?: number;
      yearsRemaining?: number;
    }
  >
>();

rosterFallbackByTeam.set(
  'KC',
  new Map(
    KANSAS_CITY_CHIEFS_ROSTER.map((entry) => [
      normalizePlayerKey(entry.fullName),
      {
        capHit: entry.capHitTop51,
        deadCap: entry.deadCap,
        baseSalary: entry.baseSalary,
        yearsRemaining: entry.yearsRemaining,
      },
    ]),
  ),
);

const toMillions = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return Number((value / 1_000_000).toFixed(1));
};

const getContractYearsRemaining = (
  contract: (typeof NFL_LEAGUE_DATA.contracts)[number] | undefined,
): number | null => {
  if (!contract) {
    return null;
  }

  if (typeof contract.years === 'number' && contract.years > 0) {
    return contract.years;
  }

  if (typeof contract.contractEndYear === 'number' && Number.isFinite(contract.contractEndYear)) {
    const currentYear = CURRENT_MODELED_LEAGUE_YEAR;
    const derivedYears = contract.contractEndYear - currentYear + 1;
    if (derivedYears > 0) {
      return derivedYears;
    }
  }

  return null;
};

const resolvePlayerContractValues = (
  player: (typeof NFL_LEAGUE_DATA.players)[number],
  teamAbbr: string,
) => {
  const unifiedContract = leagueContractsByPlayerId.get(player.id);
  const fallback = rosterFallbackByTeam
    .get(teamAbbr.toUpperCase())
    ?.get(normalizePlayerKey(player.name));

  const capHitFromUnified = toMillions(unifiedContract?.capHit ?? null);
  const capHitFromFallback = toMillions(fallback?.capHit ?? null);
  const capHitValue = capHitFromUnified ?? capHitFromFallback ?? 0;

  const guaranteedFromUnified = toMillions(unifiedContract?.guaranteed ?? null);
  const guaranteed = guaranteedFromUnified ?? Math.max(0, Number((capHitValue * 0.4).toFixed(1)));

  const yearsRemaining =
    getContractYearsRemaining(unifiedContract) ?? fallback?.yearsRemaining ?? 0;
  const deadCapFromUnified = toMillions(unifiedContract?.deadCap ?? null);
  const releaseSavingsFromUnified = toMillions(unifiedContract?.releaseSavings ?? null);
  const releaseSavingsFromFallback = toMillions(fallback?.baseSalary ?? null);
  const deadCapFromSavings =
    capHitValue > 0 && (releaseSavingsFromUnified ?? releaseSavingsFromFallback) !== null
      ? Math.max(
          0,
          Number(
            (
              capHitValue - (releaseSavingsFromUnified ?? releaseSavingsFromFallback ?? 0)
            ).toFixed(1),
          ),
        )
      : null;
  const deadCapEstimate =
    deadCapFromUnified ??
    deadCapFromSavings ??
    toMillions(fallback?.deadCap ?? null) ??
    Math.max(0, Number((capHitValue * 0.35).toFixed(1)));
  const releaseSavings =
    releaseSavingsFromUnified ??
    releaseSavingsFromFallback ??
    Math.max(0, Number((capHitValue - deadCapEstimate).toFixed(1)));
  const postJune1Savings = toMillions(unifiedContract?.postJune1Savings ?? null);

  return {
    capHitValue,
    guaranteed,
    yearsRemaining,
    deadCapEstimate,
    releaseSavings,
    postJune1Savings,
  };
};

const buildLeagueRoster = (teamAbbr: string): StoredPlayer[] => {
  const players = NFL_LEAGUE_DATA.players.filter(
    (player) => player.teamAbbr === teamAbbr.toUpperCase(),
  );
  const roster = players.map((player) => {
    const { firstName, lastName } = splitName(player.name);
    const resolved = resolvePlayerContractValues(player, teamAbbr);
    const year1CapHit = resolved.capHitValue;
    const guaranteed = resolved.guaranteed;
    const yearsRemaining = resolved.yearsRemaining;
    const apy = year1CapHit;
    const deadCap = resolved.deadCapEstimate;
    const releaseSavings = resolved.releaseSavings;
    const postJune1Savings = resolved.postJune1Savings;
    return {
      id: `${teamAbbr.toLowerCase()}-${player.id}`,
      firstName,
      lastName,
      teamAbbr: player.teamAbbr,
      normalizedName: normalizePlayerKey(player.name),
      position: player.position,
      age: player.age ?? undefined,
      rating: player.rating,
      baselineRating: player.baselineRating,
      maddenRating: player.maddenRating,
      contractYearsRemaining: yearsRemaining,
      capHit: formatMoneyMillions(year1CapHit),
      capHitValue: year1CapHit,
      height: player.height,
      weight: player.weight,
      salary: apy,
      guaranteed,
      stats: { ...player.stats },
      deadCap,
      releaseSavings,
      postJune1Savings: postJune1Savings ?? undefined,
      status: 'Active',
      headshotUrl: player.headshotUrl,
      year1CapHit,
      contract: {
        yearsRemaining,
        apy,
        guaranteed,
        capHit: year1CapHit,
        expiresAfterSeason: yearsRemaining === 1,
      },
    };
  });

  return roster;
};

const buildRosterForTeam = (teamAbbr: string): StoredPlayer[] => buildLeagueRoster(teamAbbr);

const clonePlayers = (players: StoredPlayer[]) => players.map((player) => ({ ...player }));

const toStoredPlayer = (player: PlayerRowDTO): StoredPlayer => {
  const existingYear1CapHit = (player as PlayerRowDTO & { year1CapHit?: number }).year1CapHit;
  const capHitValue =
    player.capHitValue ??
    player.contract?.capHit ??
    (Number(player.capHit.replace(/[^0-9.]/g, '')) || 0);

  return {
    ...player,
    teamAbbr: player.teamAbbr ?? null,
    year1CapHit: existingYear1CapHit ?? capHitValue,
    capHitValue,
    capHit: player.capHit ?? formatMoneyMillions(capHitValue),
  } as StoredPlayer;
};

const capSpaceMillionsForTeam = (teamAbbr: string): number => {
  const capSeed = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === teamAbbr.toUpperCase());
  return Number(((capSeed?.availableCap ?? 0) / 1_000_000).toFixed(1));
};

const capLimitMillionsForTeam = (teamAbbr: string, roster: StoredPlayer[]): number => {
  const capSeed = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === teamAbbr.toUpperCase());
  if (capSeed?.totalCap !== null && capSeed?.totalCap !== undefined) {
    return Number((capSeed.totalCap / 1_000_000).toFixed(1));
  }

  const availableCap = capSpaceMillionsForTeam(teamAbbr);
  const commitments = roster
    .filter((player) => player.status.toLowerCase() !== 'cut')
    .reduce((sum, player) => sum + (player.capHitValue ?? player.year1CapHit ?? 0), 0);

  return Number((availableCap + commitments).toFixed(1));
};

const projectedDraftOrder = NFL_LEAGUE_DATA.teams
  .slice()
  .sort((left, right) => {
    const overviewDelta = (left.teamOverview ?? 75) - (right.teamOverview ?? 75);
    if (overviewDelta !== 0) {
      return overviewDelta;
    }
    return left.abbr.localeCompare(right.abbr);
  })
  .map((team) => team.abbr.toUpperCase());

const buildInitialDraftPickAssets = (
  leagueYear: number = CURRENT_MODELED_LEAGUE_YEAR,
): TradePickAssetDTO[] =>
  getTradePickYearsForLeagueYear(leagueYear).flatMap((year) =>
    Array.from({ length: 7 }, (_, roundIndex) => {
      const round = roundIndex + 1;
      return projectedDraftOrder.map((teamAbbr, teamIndex) =>
        buildPickAsset({
          year,
          round,
          overallSlot: roundIndex * PICKS_PER_ROUND + teamIndex + 1,
          owningTeamAbbr: teamAbbr,
          originalTeamAbbr: teamAbbr,
        }),
      );
    }).flat(),
  );

const sortDraftPickAssets = (assets: TradePickAssetDTO[]) =>
  assets
    .slice()
    .sort((left, right) => {
      if (left.year !== right.year) return left.year - right.year;
      if (left.round !== right.round) return left.round - right.round;
      if ((left.overallSlot ?? 999) !== (right.overallSlot ?? 999)) {
        return (left.overallSlot ?? 999) - (right.overallSlot ?? 999);
      }
      return left.originalTeamAbbr.localeCompare(right.originalTeamAbbr);
    });

const ensureDraftPickAssets = (state: SaveState): TradePickAssetDTO[] => {
  if (!state.draftPickAssets || state.draftPickAssets.length === 0) {
    state.draftPickAssets = buildInitialDraftPickAssets(getLeagueYearForSave(state));
  }
  return state.draftPickAssets;
};

const rebuildDraftPickAssetWithOwner = (
  pick: TradePickAssetDTO,
  owningTeamAbbr: string,
): TradePickAssetDTO =>
  buildPickAsset({
    year: pick.year,
    round: pick.round,
    overallSlot: pick.overallSlot,
    owningTeamAbbr,
    originalTeamAbbr: pick.originalTeamAbbr,
    projectedRound: pick.projectedRound,
  });

export const getProjectedRosterForTeam = (state: SaveState, teamAbbr: string): StoredPlayer[] =>
  clonePlayers(state.teamRosters[teamAbbr.toUpperCase()] ?? []);

export const getOrBuildProjectedRosterForTeam = (
  state: SaveState,
  teamAbbr: string,
): StoredPlayer[] => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  if (!state.teamRosters[normalizedTeamAbbr]) {
    state.teamRosters[normalizedTeamAbbr] = buildRosterForTeam(normalizedTeamAbbr);
  }

  return clonePlayers(state.teamRosters[normalizedTeamAbbr] ?? []);
};

export const getProjectedCapSpaceForTeam = (state: SaveState, teamAbbr: string): number =>
  Number((state.teamCaps[teamAbbr.toUpperCase()] ?? capSpaceMillionsForTeam(teamAbbr)).toFixed(1));

export const getTradablePlayersForTeam = (state: SaveState, teamAbbr: string): StoredPlayer[] =>
  getOrBuildProjectedRosterForTeam(state, teamAbbr).filter(
    (player) => player.status?.toLowerCase() !== 'cut',
  );

export const getTradableDraftPicksForTeam = (
  state: SaveState,
  teamAbbr: string,
  years: number[] = [...getTradePickYearsForLeagueYear(getLeagueYearForSave(state))],
): TradePickAssetDTO[] =>
  sortDraftPickAssets(
    ensureDraftPickAssets(state).filter(
      (pick) => pick.owningTeamAbbr === teamAbbr.toUpperCase() && years.includes(pick.year),
    ),
  );

export const getTeamTradeAssets = (
  state: SaveState,
  teamAbbr: string,
  years: number[] = [...getTradePickYearsForLeagueYear(getLeagueYearForSave(state))],
) => ({
  players: getTradablePlayersForTeam(state, teamAbbr),
  draftPicks: getTradableDraftPicksForTeam(state, teamAbbr, years),
});

export const getDraftPickAssetById = (
  state: SaveState,
  pickAssetId: string,
): TradePickAssetDTO | null =>
  ensureDraftPickAssets(state).find((pick) => pick.id === pickAssetId) ?? null;

export const transferDraftPicksToTeam = (
  state: SaveState,
  pickAssetIds: string[],
  owningTeamAbbr: string,
): void => {
  if (pickAssetIds.length === 0) {
    return;
  }
  const targetIds = new Set(pickAssetIds);
  state.draftPickAssets = ensureDraftPickAssets(state).map((pick) =>
    targetIds.has(pick.id) ? rebuildDraftPickAssetWithOwner(pick, owningTeamAbbr.toUpperCase()) : pick,
  );
};

const removePlayerFromAllRosters = (state: SaveState, playerId: string): void => {
  Object.keys(state.teamRosters).forEach((abbr) => {
    state.teamRosters[abbr] = state.teamRosters[abbr].filter((player) => player.id !== playerId);
  });
};

export const transferStoredPlayerToTeam = (
  player: StoredPlayer,
  nextTeamAbbr: string,
): StoredPlayer => {
  const normalizedTeamAbbr = nextTeamAbbr.toUpperCase();

  return {
    ...player,
    teamAbbr: normalizedTeamAbbr,
    currentTeamAbbr: normalizedTeamAbbr,
    signedTeamAbbr: normalizedTeamAbbr,
    lastTeamAbbr: player.teamAbbr ?? player.currentTeamAbbr ?? player.lastTeamAbbr ?? null,
    signedTeamLogoUrl: logoUrlFor(normalizedTeamAbbr),
    status: 'Active',
  };
};

export const listSaveStates = (): Array<{ saveId: string; state: SaveState }> =>
  Array.from(saveStore.entries()).map(([saveId, state]) => ({ saveId, state }));

export const getSaveHeaderSnapshot = (state: SaveState): SaveHeaderDTO => ({
  ...state.header,
  rosterCount: state.roster.length,
});

const resolveUnlocksForPhase = (phase: string, current?: SaveUnlocksDTO): SaveUnlocksDTO => {
  const next: SaveUnlocksDTO = {
    freeAgency: current?.freeAgency ?? false,
    draft: current?.draft ?? false,
  };

  if (phase === 'free_agency' || phase === 'draft' || phase === 'season') {
    next.freeAgency = true;
  }
  if (phase === 'draft' || phase === 'season') {
    next.draft = true;
  }

  return next;
};

export const createSaveState = (
  saveId: string,
  teamAbbr: string,
  year: number = CURRENT_MODELED_LEAGUE_YEAR,
): SaveState => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const roster = buildRosterForTeam(normalizedTeamAbbr);
  const freeAgents = buildFreeAgencyPool({
    saveId,
    league: NFL_LEAGUE_DATA,
    teamAbbr: teamAbbr.toUpperCase(),
  }).map((player) => ({
    ...player,
    year1CapHit: getExpectedFreeAgentYearOneCapHit(player),
  })) as StoredPlayer[];
  const capSpace = capSpaceMillionsForTeam(normalizedTeamAbbr);
  const capLimit = capLimitMillionsForTeam(normalizedTeamAbbr, roster);
  const header: SaveHeaderDTO = {
    id: saveId,
    teamAbbr: normalizedTeamAbbr,
    year,
    capSpace,
    capLimit,
    rosterCount: roster.length,
    rosterLimit: 53,
    phase: 'resign_cut',
    unlocked: { freeAgency: false, draft: false },
    createdAt: new Date().toISOString(),
  };

  const state: SaveState = {
    header,
    roster,
    freeAgents,
    teamRosters: { [normalizedTeamAbbr]: roster },
    teamCaps: { [normalizedTeamAbbr]: capSpace },
    draftPickAssets: buildInitialDraftPickAssets(year),
    transactions: [],
    draftSessions: {},
    expiringContracts: getExpiringContractsForTeam(teamAbbr, NFL_LEAGUE_DATA),
    newsFeed: [],
    rosterMoves: { cuts: [], resigns: [], trades: [] },
    offseason: {
      hydrated: false,
      otcRows: [],
      resolvedPlayerIds: [],
      walkawayPlayerIds: [],
    },
  };

  saveStore.set(saveId, state);
  return state;
};

export const setSavePhase = (saveId: string, phase: string): SaveResult<SaveHeaderDTO> => {
  const state = getSaveState(saveId);
  if (!state) {
    return { ok: false, error: 'Save not found' };
  }

  state.header.phase = phase;
  state.header.unlocked = resolveUnlocksForPhase(phase, state.header.unlocked);
  return { ok: true, data: getSaveHeaderSnapshot(state) };
};

export const getSaveState = (saveId: string): SaveState | undefined => saveStore.get(saveId);

export const ensureSaveState = (saveId: string, teamAbbr: string): SaveState => {
  const existing = getSaveState(saveId);
  if (existing) {
    return existing;
  }
  return createSaveState(saveId, teamAbbr);
};

export const restoreSaveState = (saveId: string, payload: SaveRestorePayload): SaveState => {
  const normalizedTeamAbbr = payload.teamAbbr.toUpperCase();
  const state = ensureSaveState(saveId, normalizedTeamAbbr);
  const restoredRoster = payload.roster.map(toStoredPlayer);

  state.roster = restoredRoster;
  state.teamRosters[normalizedTeamAbbr] = restoredRoster;
  state.header = {
    ...state.header,
    id: saveId,
    teamAbbr: normalizedTeamAbbr,
    year: payload.year ?? state.header.year ?? CURRENT_MODELED_LEAGUE_YEAR,
    capSpace: Number(payload.capSpace.toFixed(1)),
    capLimit: Number(payload.capLimit.toFixed(1)),
    rosterCount: restoredRoster.length,
    rosterLimit: state.header.rosterLimit,
    phase: payload.phase ?? state.header.phase,
    unlocked: payload.unlocked ?? resolveUnlocksForPhase(payload.phase ?? state.header.phase),
    createdAt: payload.createdAt ?? state.header.createdAt,
  };
  state.teamCaps[normalizedTeamAbbr] = state.header.capSpace;
  state.draftPickAssets = buildInitialDraftPickAssets(state.header.year);
  if (state.header.year > CURRENT_MODELED_LEAGUE_YEAR) {
    state.offseason.hydrated = true;
    state.offseason.otcRows = [];
    state.freeAgents = [];
    state.expiringContracts = buildExpiringContractsFromRoster(restoredRoster, normalizedTeamAbbr);
  } else {
    state.offseason.hydrated = false;
    state.offseason.otcRows = [];
    state.freeAgents = [];
    state.expiringContracts = [];
  }

  saveStore.set(saveId, state);
  return state;
};

export type SaveResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const getSaveStateResult = (saveId: string): SaveResult<SaveState> => {
  const state = getSaveState(saveId);
  if (!state) {
    return { ok: false, error: 'Save not found' };
  }

  // Ensure draftSessions is initialized
  if (!state.draftSessions) {
    state.draftSessions = {};
  }
  if (!state.expiringContracts) {
    state.expiringContracts = [];
  }
  if (!state.header.unlocked) {
    state.header.unlocked = resolveUnlocksForPhase(state.header.phase);
  }
  if (state.expiringContracts.length === 0) {
    state.expiringContracts = getExpiringContractsForTeam(state.header.teamAbbr, NFL_LEAGUE_DATA);
  }
  if (!state.newsFeed) {
    state.newsFeed = [];
  }
  if (!state.rosterMoves) {
    state.rosterMoves = { cuts: [], resigns: [], trades: [] };
  }
  if (!state.teamRosters) {
    state.teamRosters = { [state.header.teamAbbr]: state.roster };
  }
  if (!state.teamCaps) {
    state.teamCaps = { [state.header.teamAbbr]: state.header.capSpace };
  }
  if (!state.draftPickAssets) {
    state.draftPickAssets = buildInitialDraftPickAssets(getLeagueYearForSave(state));
  }
  if (!state.transactions) {
    state.transactions = [];
  }
  if (!state.offseason) {
    state.offseason = {
      hydrated: false,
      otcRows: [],
      resolvedPlayerIds: [],
      walkawayPlayerIds: [],
    };
  }

  return { ok: true, data: state };
};

const toStoredPlayers = (players: PlayerRowDTO[]): StoredPlayer[] =>
  players.map((player) => ({
    ...player,
    year1CapHit: getExpectedFreeAgentYearOneCapHit(player),
  }));

const resolveWalkawaysFromState = (state: SaveState): PlayerRowDTO[] => {
  const ids = new Set(state.offseason.walkawayPlayerIds);
  return state.freeAgents.filter((player) => ids.has(player.id));
};

export const hydrateOffseasonFreeAgencyState = async (state: SaveState): Promise<void> => {
  if (state.offseason.hydrated) {
    return;
  }

  const otcRows = await getCachedOtcRows();
  state.offseason.otcRows = otcRows;
  state.expiringContracts = buildTeamExpiringContracts({
    teamAbbr: state.header.teamAbbr,
    otcRows,
    league: NFL_LEAGUE_DATA,
    resolvedIds: new Set(state.offseason.resolvedPlayerIds),
  });

  const pool = buildInitialFreeAgencyPool({
    saveId: state.header.id,
    teamAbbr: state.header.teamAbbr,
    otcRows,
    league: NFL_LEAGUE_DATA,
    walkaways: resolveWalkawaysFromState(state),
  });
  const rosteredPlayerIds = new Set(
    Object.values(state.teamRosters)
      .flat()
      .filter((player) => player.status?.toLowerCase() !== 'cut')
      .map((player) => player.id),
  );
  state.freeAgents = toStoredPlayers(pool).filter((player) => !rosteredPlayerIds.has(player.id));
  state.offseason.hydrated = true;
};

const getPlayerMarketValueDollars = (player: StoredPlayer) => {
  const salaryMillions =
    player.contract?.apy ??
    player.salary ??
    player.capHitValue ??
    player.year1CapHit ??
    Math.max(1, (player.rating ?? player.maddenRating ?? player.baselineRating ?? 70) / 20);
  return Math.max(1_000_000, Math.round(salaryMillions * 1_000_000));
};

const buildFreeAgentFromExpiredPlayer = (
  state: SaveState,
  player: StoredPlayer,
  generatedAt: string,
): StoredPlayer => {
  const marketValue = getPlayerMarketValueDollars(player);
  return {
    ...player,
    teamAbbr: null,
    currentTeamAbbr: null,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
    status: 'Free Agent',
    lastTeamAbbr: player.teamAbbr ?? player.currentTeamAbbr ?? player.lastTeamAbbr ?? null,
    signedTeamAbbr: player.teamAbbr ?? player.currentTeamAbbr ?? player.signedTeamAbbr ?? null,
    isUnsigned: true,
    marketValue,
    year1CapHit: Math.max(1, Math.round(marketValue / 1_000_000)),
    freeAgentProfile: buildFreeAgentProfile({
      playerId: player.id,
      saveId: state.header.id,
      position: player.position,
      age: player.age,
      lastContractApy: marketValue,
      lastGuaranteed: Math.round((player.guaranteed ?? player.contract?.guaranteed ?? 0) * 1_000_000),
      teamAbbr: state.header.teamAbbr,
      generatedAt,
      source: player.cutAt ? 'released' : 'real',
    }),
    contract: {
      yearsRemaining: 0,
      apy: 0,
      guaranteed: 0,
      capHit: 0,
      expiresAfterSeason: false,
    },
  };
};

const buildExpiringContractsFromRoster = (
  roster: StoredPlayer[],
  teamAbbr: string,
): ExpiringContractRow[] =>
  roster
    .filter(
      (player) =>
        player.status?.toLowerCase() !== 'cut' &&
        (player.teamAbbr ?? teamAbbr) === teamAbbr &&
        (player.contractYearsRemaining ?? player.contract?.yearsRemaining ?? 0) === 1,
    )
    .map((player) => ({
      id: player.id,
      name: `${player.firstName} ${player.lastName}`.trim(),
      pos: player.position,
      teamAbbr,
      lastTeamAbbr: teamAbbr,
      previousTeamAbbr: teamAbbr,
      contractType: player.contractStatus ?? 'UFA',
      interestPct: 0,
      age: player.age ?? 27,
      rating: player.rating ?? player.maddenRating ?? player.baselineRating ?? undefined,
      estValue: getPlayerMarketValueDollars(player),
      currentSalary: Math.round(
        ((player.contract?.apy ?? player.salary ?? player.capHitValue ?? player.year1CapHit ?? 0) *
          1_000_000),
      ),
      maxValue: Math.round(getPlayerMarketValueDollars(player) * 1.15),
      headshotUrl: player.headshotUrl ?? null,
    }))
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));

const recalculateTeamCapSpaceFromRoster = (teamAbbr: string, roster: StoredPlayer[]) => {
  const capLimit = capLimitMillionsForTeam(teamAbbr, roster);
  const commitments = roster
    .filter((player) => player.status?.toLowerCase() !== 'cut')
    .reduce((sum, player) => sum + (player.capHitValue ?? player.year1CapHit ?? 0), 0);
  return Number((capLimit - commitments).toFixed(1));
};

export const advanceSaveStateToNextOffseason = (
  saveId: string,
): SaveResult<{
  header: SaveHeaderDTO;
  roster: PlayerRowDTO[];
}> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  const state = stateResult.data;
  const generatedAt = new Date().toISOString();
  const nextYear = getLeagueYearForSave(state) + 1;
  const allTeamAbbrs = NFL_LEAGUE_DATA.teams.map((team) => team.abbr.toUpperCase());

  allTeamAbbrs.forEach((teamAbbr) => {
    if (!state.teamRosters[teamAbbr]) {
      state.teamRosters[teamAbbr] = buildRosterForTeam(teamAbbr);
    }
  });

  const rolloverFreeAgents = new Map<string, StoredPlayer>();

  Object.entries(state.teamRosters).forEach(([teamAbbr, roster]) => {
    const nextRoster: StoredPlayer[] = [];
    roster.forEach((player) => {
      if (player.status?.toLowerCase() === 'cut') {
        return;
      }

      const nextYearsRemaining = Math.max(
        0,
        (player.contractYearsRemaining ?? player.contract?.yearsRemaining ?? 0) - 1,
      );
      const nextCapHitSchedule = player.capHitSchedule?.slice(1);
      const nextCapHit =
        nextCapHitSchedule?.[0] ??
        player.contract?.capHit ??
        player.capHitValue ??
        player.year1CapHit ??
        0;

      if (nextYearsRemaining <= 0) {
        const freeAgent = buildFreeAgentFromExpiredPlayer(
          state,
          {
            ...player,
            teamAbbr,
            currentTeamAbbr: teamAbbr,
            lastTeamAbbr: teamAbbr,
          },
          generatedAt,
        );
        rolloverFreeAgents.set(freeAgent.id, freeAgent);
        return;
      }

      nextRoster.push({
        ...player,
        teamAbbr,
        currentTeamAbbr: teamAbbr,
        contractYearsRemaining: nextYearsRemaining,
        year1CapHit: nextCapHit,
        capHitValue: nextCapHit,
        capHit: formatMoneyMillions(nextCapHit),
        capHitSchedule: nextCapHitSchedule,
        contract: {
          yearsRemaining: nextYearsRemaining,
          apy: player.contract?.apy ?? player.salary ?? nextCapHit,
          guaranteed: player.contract?.guaranteed ?? player.guaranteed ?? 0,
          capHit: nextCapHit,
          expiresAfterSeason: nextYearsRemaining <= 1,
        },
      });
    });
    state.teamRosters[teamAbbr] = nextRoster;
    state.teamCaps[teamAbbr] = recalculateTeamCapSpaceFromRoster(teamAbbr, nextRoster);
  });

  state.header.year = nextYear;
  state.header.phase = 'resign_cut';
  state.header.unlocked = { freeAgency: false, draft: false };
  state.header.createdAt = generatedAt;
  state.header.teamAbbr = state.header.teamAbbr.toUpperCase();
  state.roster = state.teamRosters[state.header.teamAbbr] ?? [];
  state.header.rosterCount = state.roster.length;
  state.header.capLimit = capLimitMillionsForTeam(state.header.teamAbbr, state.roster);
  state.header.capSpace = state.teamCaps[state.header.teamAbbr] ?? recalculateTeamCapSpaceFromRoster(
    state.header.teamAbbr,
    state.roster,
  );

  state.expiringContracts = buildExpiringContractsFromRoster(state.roster, state.header.teamAbbr);
  state.freeAgents = Array.from(
    new Map(
      [...state.freeAgents, ...Array.from(rolloverFreeAgents.values())].map((player) => [
        player.id,
        player,
      ]),
    ).values(),
  )
    .filter((player) => !state.roster.some((rosterPlayer) => rosterPlayer.id === player.id))
    .map((player) => ({
      ...player,
      freeAgentProfile: player.freeAgentProfile
        ? {
            ...player.freeAgentProfile,
            saveId: state.header.id,
            source: player.cutAt ? 'released' : player.freeAgentProfile.source,
            available: true,
            availabilityStatus: 'available',
            marketStatus: 'available',
            generatedAt,
            refreshedAt: generatedAt,
            lastUpdated: generatedAt,
          }
        : player.freeAgentProfile,
    }));

  state.offseason.hydrated = true;
  state.offseason.otcRows = [];
  state.offseason.resolvedPlayerIds = [];
  state.offseason.walkawayPlayerIds = [];
  state.draftSessions = {};
  state.draftPickAssets = buildInitialDraftPickAssets(nextYear);

  return {
    ok: true,
    data: {
      header: getSaveHeaderSnapshot(state),
      roster: clonePlayers(state.roster),
    },
  };
};

const matchesFilter = (player: StoredPlayer, filters?: PlayerFilters): boolean => {
  if (!filters) {
    return true;
  }

  if (filters.position && player.position !== filters.position) {
    return false;
  }

  if (filters.status && player.status !== filters.status) {
    return false;
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    if (!fullName.includes(query)) {
      return false;
    }
  }

  return true;
};

export const filterPlayers = (players: StoredPlayer[], filters?: PlayerFilters): StoredPlayer[] =>
  players.filter((player) => matchesFilter(player, filters));

export const signFreeAgentInState = (
  state: SaveState,
  playerId: string,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.freeAgents.findIndex((agent) => agent.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Free agent not found');
  }

  const [player] = state.freeAgents.splice(playerIndex, 1);
  const year1CapHit = getExpectedFreeAgentYearOneCapHit(player);
  if (state.header.capSpace < year1CapHit) {
    throw new Error('Signing would exceed available cap space');
  }
  const signedPlayer: StoredPlayer = {
    ...player,
    teamAbbr: state.header.teamAbbr,
    contractYearsRemaining: 1,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary:
      player.freeAgentProfile?.expectedAnnualValue ??
      (player.marketValue ?? year1CapHit * 1_000_000) / 1_000_000,
    guaranteed: 0,
    status: 'Active',
    currentTeamAbbr: state.header.teamAbbr,
    isUnsigned: false,
    signedAt: new Date().toISOString(),
    freeAgentProfile: player.freeAgentProfile
      ? {
          ...player.freeAgentProfile,
          marketStatus: 'signed',
          availabilityStatus: 'signed',
          available: false,
          refreshedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
      : player.freeAgentProfile,
    contract: {
      yearsRemaining: 1,
      apy:
        player.freeAgentProfile?.expectedAnnualValue ??
        (player.marketValue ?? year1CapHit * 1_000_000) / 1_000_000,
      guaranteed: 0,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  removePlayerFromAllRosters(state, signedPlayer.id);
  const userTeam = state.header.teamAbbr.toUpperCase();
  const currentRoster = state.teamRosters[userTeam] ?? [];
  state.teamRosters[userTeam] = [...currentRoster, signedPlayer];
  state.roster = state.teamRosters[userTeam];
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  state.teamCaps[userTeam] = state.header.capSpace;
  state.transactions.push({
    id: `tx_sign_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'signing',
    playerId: signedPlayer.id,
    toTeamAbbr: userTeam,
    capHit: year1CapHit,
    createdAt: new Date().toISOString(),
  });
  pushNewsItem(state, {
    type: 'freeAgentSigned',
    teamAbbr: state.header.teamAbbr,
    playerName: `${signedPlayer.firstName} ${signedPlayer.lastName}`,
    details: `${state.header.teamAbbr} sign ${signedPlayer.firstName} ${signedPlayer.lastName}.`,
    severity: 'success',
  });

  return {
    header: getSaveHeaderSnapshot(state),
    player: signedPlayer,
  };
};

export const offerContractInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.freeAgents.findIndex((agent) => agent.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Free agent not found');
  }

  const capHitSchedule = getCapHitSchedule(apy, years);
  const year1CapHit = getYearOneCapHit(apy, years);
  if (state.header.capSpace < year1CapHit) {
    throw new Error('Signing would exceed available cap space');
  }

  const [player] = state.freeAgents.splice(playerIndex, 1);
  const signedPlayer: StoredPlayer = {
    ...player,
    teamAbbr: state.header.teamAbbr,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Signed',
    currentTeamAbbr: state.header.teamAbbr,
    isUnsigned: false,
    signedTeamAbbr: state.header.teamAbbr,
    signedTeamLogoUrl: logoUrlFor(state.header.teamAbbr),
    signedAt: new Date().toISOString(),
    capHitSchedule,
    freeAgentProfile: player.freeAgentProfile
      ? {
          ...player.freeAgentProfile,
          marketStatus: 'signed',
          availabilityStatus: 'signed',
          available: false,
          refreshedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
      : player.freeAgentProfile,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  removePlayerFromAllRosters(state, signedPlayer.id);
  const userTeam = state.header.teamAbbr.toUpperCase();
  const currentRoster = state.teamRosters[userTeam] ?? [];
  state.teamRosters[userTeam] = [...currentRoster, signedPlayer];
  state.roster = state.teamRosters[userTeam];
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  state.teamCaps[userTeam] = state.header.capSpace;
  state.transactions.push({
    id: `tx_sign_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'signing',
    playerId: signedPlayer.id,
    toTeamAbbr: userTeam,
    capHit: year1CapHit,
    createdAt: new Date().toISOString(),
  });
  pushNewsItem(state, {
    type: 'freeAgentSigned',
    teamAbbr: state.header.teamAbbr,
    playerName: `${signedPlayer.firstName} ${signedPlayer.lastName}`,
    details: `${state.header.teamAbbr} sign ${signedPlayer.firstName} ${signedPlayer.lastName}.`,
    severity: 'success',
  });

  return {
    header: getSaveHeaderSnapshot(state),
    player: signedPlayer,
  };
};

export const cutPlayerInState = (
  state: SaveState,
  playerId: string,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const player = state.roster[playerIndex];
  const existingCut = state.rosterMoves.cuts.find((cut) => cut.playerId === playerId);
  if (existingCut || player.status.toLowerCase() === 'cut') {
    throw new Error('Player already cut');
  }

  const capHitValue = player.capHitValue ?? player.year1CapHit ?? 0;
  const deadCap = player.deadCap ?? 0;
  const capSavings = player.releaseSavings ?? Math.max(0, capHitValue - deadCap);
  const cutPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
    status: 'Cut',
    cutAt: new Date().toISOString(),
    contract: {
      yearsRemaining: 0,
      apy: 0,
      guaranteed: 0,
      capHit: 0,
      expiresAfterSeason: false,
    },
  };

  state.roster[playerIndex] = cutPlayer;
  const generatedAt = new Date().toISOString();
  const cutFreeAgent: StoredPlayer = {
    ...cutPlayer,
    status: 'Free Agent',
    year1CapHit: capHitValue > 0 ? capHitValue : 1,
    marketValue: Math.round((capHitValue > 0 ? capHitValue : 1) * 1_000_000),
    freeAgentProfile: buildFreeAgentProfile({
      playerId: cutPlayer.id,
      saveId: state.header.id,
      position: cutPlayer.position,
      age: cutPlayer.age,
      lastContractApy: (player.contract?.apy ?? player.salary ?? capHitValue) * 1_000_000,
      lastGuaranteed: (player.contract?.guaranteed ?? player.guaranteed ?? 0) * 1_000_000,
      teamAbbr: state.header.teamAbbr,
      generatedAt,
      source: 'released',
    }),
  };
  if (!state.freeAgents.some((agent) => agent.id === cutFreeAgent.id)) {
    state.freeAgents.push({
      ...cutFreeAgent,
      freeAgentProfile: cutFreeAgent.freeAgentProfile
        ? {
            ...cutFreeAgent.freeAgentProfile,
            source: 'released',
            availabilityStatus: 'available',
            marketStatus: 'available',
          }
        : cutFreeAgent.freeAgentProfile,
    });
  }
  state.rosterMoves.cuts.push({
    playerId,
    name: `${cutPlayer.firstName} ${cutPlayer.lastName}`,
    capSavings,
    timestamp: new Date().toISOString(),
  });
  state.header.rosterCount = state.roster.filter(
    (rosterPlayer) => rosterPlayer.status !== 'Cut',
  ).length;
  state.header.capSpace = Number((state.header.capSpace + capSavings).toFixed(1));
  state.teamCaps[state.header.teamAbbr.toUpperCase()] = state.header.capSpace;
  pushNewsItem(state, {
    type: 'cut',
    teamAbbr: state.header.teamAbbr,
    playerName: `${cutPlayer.firstName} ${cutPlayer.lastName}`,
    details: `${state.header.teamAbbr} cut ${cutPlayer.firstName} ${cutPlayer.lastName}.`,
    severity: 'warning',
  });

  return {
    header: getSaveHeaderSnapshot(state),
    player: cutPlayer,
  };
};

export const addWalkawayToFreeAgencyInState = (
  state: SaveState,
  input: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    age?: number;
    rating?: number;
    headshotUrl?: string | null;
    priorTeamAbbr?: string | null;
  },
): PlayerRowDTO => {
  const generatedAt = new Date().toISOString();
  const cap = Math.max(1, Math.round((input.rating ? 0.8 + input.rating / 20 : 1.8) * 1_000_000));
  const walkaway: PlayerRowDTO = {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    normalizedName: normalizePlayerKey(`${input.firstName} ${input.lastName}`),
    position: input.position,
    age: input.age,
    rating: input.rating,
    stats: {},
    marketValue: cap,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    capHitValue: 0,
    salary: 0,
    guaranteed: 0,
    status: 'Free Agent',
    headshotUrl: input.headshotUrl ?? null,
    signedTeamAbbr: input.priorTeamAbbr ?? state.header.teamAbbr,
    freeAgentProfile: buildFreeAgentProfile({
      playerId: input.id,
      saveId: state.header.id,
      position: input.position,
      age: input.age,
      lastContractApy: cap,
      lastGuaranteed: Math.round(cap * 0.45),
      teamAbbr: state.header.teamAbbr,
      generatedAt,
      source: 'real',
    }),
  };

  if (!state.freeAgents.some((player) => player.id === walkaway.id)) {
    state.freeAgents.push({ ...walkaway, year1CapHit: cap / 1_000_000 });
  }

  state.offseason.walkawayPlayerIds = Array.from(
    new Set([...state.offseason.walkawayPlayerIds, walkaway.id]),
  );
  state.offseason.resolvedPlayerIds = Array.from(
    new Set([...state.offseason.resolvedPlayerIds, walkaway.id]),
  );
  removeExpiringContract(state, walkaway.id);

  return walkaway;
};

export const resignPlayerInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const player = state.roster[playerIndex];
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const updatedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Active',
    capHitSchedule,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.roster[playerIndex] = updatedPlayer;
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  state.teamCaps[state.header.teamAbbr.toUpperCase()] = state.header.capSpace;
  state.offseason.resolvedPlayerIds = Array.from(
    new Set([...state.offseason.resolvedPlayerIds, updatedPlayer.id]),
  );
  removeExpiringContract(state, updatedPlayer.id);
  state.freeAgents = state.freeAgents.filter((playerRow) => playerRow.id !== updatedPlayer.id);

  return {
    header: getSaveHeaderSnapshot(state),
    player: updatedPlayer,
  };
};

export const resignExpiringContractInState = (
  state: SaveState,
  contract: ExpiringContractRow,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const nameParts = contract.name.split(' ');
  const firstName = nameParts[0] ?? contract.name;
  const lastName = nameParts.slice(1).join(' ') || contract.name;
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const newPlayer: StoredPlayer = {
    id: contract.id,
    firstName,
    lastName,
    position: contract.pos,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    status: 'Active',
    headshotUrl: contract.headshotUrl ?? null,
    age: contract.age,
    rating: contract.rating,
    year1CapHit,
    capHitSchedule,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: false,
    },
  };

  state.roster.push(newPlayer);
  removeExpiringContract(state, contract.id);
  state.offseason.resolvedPlayerIds = Array.from(
    new Set([...state.offseason.resolvedPlayerIds, contract.id]),
  );
  state.freeAgents = state.freeAgents.filter((player) => player.id !== contract.id);
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  state.teamCaps[state.header.teamAbbr.toUpperCase()] = state.header.capSpace;

  return {
    header: getSaveHeaderSnapshot(state),
    player: newPlayer,
  };
};

export const renegotiatePlayerInState = (
  state: SaveState,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const player = state.roster[playerIndex];
  const currentCapHit = player.capHitValue ?? player.contract?.capHit ?? player.year1CapHit ?? 0;
  const year1CapHit = getYearOneCapHit(apy, years);
  const capHitSchedule = getCapHitSchedule(apy, years);

  const updatedPlayer: StoredPlayer = {
    ...player,
    contractYearsRemaining: years,
    capHit: formatMoneyMillions(year1CapHit),
    capHitValue: year1CapHit,
    salary: apy,
    guaranteed,
    capHitSchedule,
    disgruntled: false,
    contract: {
      yearsRemaining: years,
      apy,
      guaranteed,
      capHit: year1CapHit,
      expiresAfterSeason: years <= 1,
    },
  };

  state.roster[playerIndex] = updatedPlayer;
  const delta = year1CapHit - currentCapHit;
  state.header.capSpace = Number((state.header.capSpace - delta).toFixed(1));
  state.teamCaps[state.header.teamAbbr.toUpperCase()] = state.header.capSpace;

  return {
    header: getSaveHeaderSnapshot(state),
    player: updatedPlayer,
  };
};

export const markPlayerDisgruntled = (state: SaveState, playerId: string): PlayerRowDTO => {
  const playerIndex = state.roster.findIndex((rosterPlayer) => rosterPlayer.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found on roster');
  }

  const updatedPlayer: StoredPlayer = {
    ...state.roster[playerIndex],
    disgruntled: true,
  };
  state.roster[playerIndex] = updatedPlayer;
  return updatedPlayer;
};

export const upsertExpiringContract = (state: SaveState, contract: ExpiringContractRow): void => {
  const index = state.expiringContracts.findIndex((entry) => entry.id === contract.id);
  if (index === -1) {
    state.expiringContracts.push(contract);
  } else {
    state.expiringContracts[index] = contract;
  }
};

export const removeExpiringContract = (state: SaveState, contractId: string): void => {
  const index = state.expiringContracts.findIndex((entry) => entry.id === contractId);
  if (index !== -1) {
    state.expiringContracts.splice(index, 1);
  }
};

export const pushNewsItem = (
  state: SaveState,
  item: Omit<NewsItemDTO, 'id' | 'createdAt'>,
): NewsItemDTO => {
  const created = {
    id: `news_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...item,
  };
  state.newsFeed.unshift(created);
  state.newsFeed = state.newsFeed.slice(0, 30);
  return created;
};

export const addDraftedPlayersInState = (
  state: SaveState,
  draftedPlayers: PlayerRowDTO[],
): { header: SaveHeaderDTO; players: PlayerRowDTO[] } => {
  const addedPlayers: StoredPlayer[] = [];

  draftedPlayers.forEach((player) => {
    if (state.roster.some((rosterPlayer) => rosterPlayer.id === player.id)) {
      return;
    }

    const { years, year1CapHit } = getRookieContract(player.rank);
    const rookiePlayer: StoredPlayer = {
      ...player,
      contractYearsRemaining: years,
      capHit: formatMoneyMillions(year1CapHit),
      capHitValue: year1CapHit,
      salary: year1CapHit,
      guaranteed: 0,
      status: 'ROOKIE',
      year1CapHit,
    };

    state.roster.push(rookiePlayer);
    addedPlayers.push(rookiePlayer);
    state.header.rosterCount = state.roster.length;
    state.header.capSpace = Number((state.header.capSpace - year1CapHit).toFixed(1));
  });

  return {
    header: getSaveHeaderSnapshot(state),
    players: addedPlayers,
  };
};
