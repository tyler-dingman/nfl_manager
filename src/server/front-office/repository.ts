import { authDb } from '@/server/auth/database';
import { normalizeFranchiseSimulationState } from '@/lib/franchise-simulation';
import type {
  FranchiseSimulationState,
  FrontOfficePath,
  FrontOfficeSaveMetadata,
} from '@/types/front-office';

type FrontOfficeSaveRow = {
  saveId: string;
  teamAbbr: string;
  season: number;
  selectedPath: FrontOfficePath | null;
  simulationPhase: string | null;
  initializedAt: Date | string | null;
  simulation: unknown;
  version: number;
};

export function normalizeFranchiseSimulation(value: unknown): FranchiseSimulationState | null {
  return normalizeFranchiseSimulationState(value);
}

const mapRow = (row: FrontOfficeSaveRow): FrontOfficeSaveMetadata => {
  const simulation = normalizeFranchiseSimulation(row.simulation);
  return {
    ...row,
    // A committed simulation snapshot owns progression. simulation_phase is retained as an
    // index/fallback for pre-simulation saves, but must never override the snapshot on restore.
    simulationPhase: simulation?.phase ?? row.simulationPhase,
    simulation,
    initializedAt: row.initializedAt ? new Date(row.initializedAt).toISOString() : null,
  };
};

export async function getFrontOfficeSaveMetadata(userId: string, saveId: string) {
  const rows = await authDb()<FrontOfficeSaveRow[]>`
    SELECT save_id AS "saveId", team_abbr AS "teamAbbr", season,
      selected_path AS "selectedPath", simulation_phase AS "simulationPhase",
      initialized_at AS "initializedAt", simulation_state AS simulation, version
    FROM user_front_office_saves
    WHERE user_id = ${userId} AND save_id = ${saveId}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertFrontOfficeSaveMetadata(input: {
  userId: string;
  saveId: string;
  teamAbbr: string;
  season: number;
  selectedPath?: FrontOfficePath | null;
  simulationPhase?: string | null;
}) {
  const rows = await authDb()<FrontOfficeSaveRow[]>`
    INSERT INTO user_front_office_saves
      (user_id, save_id, team_abbr, season, selected_path, simulation_phase, initialized_at)
    VALUES
      (${input.userId}, ${input.saveId}, ${input.teamAbbr}, ${input.season},
       ${input.selectedPath ?? null}, ${input.simulationPhase ?? null},
       ${input.selectedPath ? new Date() : null})
    ON CONFLICT (user_id, save_id) DO UPDATE SET
      team_abbr = EXCLUDED.team_abbr,
      season = EXCLUDED.season,
      selected_path = COALESCE(EXCLUDED.selected_path, user_front_office_saves.selected_path),
      simulation_phase = COALESCE(EXCLUDED.simulation_phase, user_front_office_saves.simulation_phase),
      initialized_at = COALESCE(user_front_office_saves.initialized_at, EXCLUDED.initialized_at),
      updated_at = now()
    RETURNING save_id AS "saveId", team_abbr AS "teamAbbr", season,
      selected_path AS "selectedPath", simulation_phase AS "simulationPhase",
      initialized_at AS "initializedAt", simulation_state AS simulation, version`;
  return mapRow(rows[0]);
}

export async function saveFranchiseSimulation(input: {
  userId: string;
  saveId: string;
  expectedVersion: number;
  simulation: FranchiseSimulationState;
}) {
  const db = authDb();
  const rows = await db<FrontOfficeSaveRow[]>`
    UPDATE user_front_office_saves
    SET simulation_state = ${db.json(input.simulation as any)},
      simulation_phase = ${input.simulation.phase},
      version = version + 1,
      updated_at = now()
    WHERE user_id = ${input.userId} AND save_id = ${input.saveId}
      AND version = ${input.expectedVersion}
    RETURNING save_id AS "saveId", team_abbr AS "teamAbbr", season,
      selected_path AS "selectedPath", simulation_phase AS "simulationPhase",
      initialized_at AS "initializedAt", simulation_state AS simulation, version`;
  return rows[0] ? mapRow(rows[0]) : null;
}
