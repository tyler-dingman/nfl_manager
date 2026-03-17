import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { IngestedLeagueData } from '@/server/data/nfl-data';
import { syncCap } from '@/server/ingest/cap';
import { syncPlayers } from '@/server/ingest/players';
import { syncTeams } from '@/server/ingest/teams';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');

const readExisting = async (): Promise<IngestedLeagueData> => {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as IngestedLeagueData;
  } catch {
    return { updatedAt: new Date(0).toISOString(), teams: [], players: [], cap: [] };
  }
};

const run = async () => {
  const existing = await readExisting();
  const now = new Date().toISOString();

  const canonicalTeams = syncTeams();
  let players = existing.players;
  let cap = existing.cap;

  try {
    const playerSync = await syncPlayers(existing.players);
    players = playerSync.players;
    console.log(
      `[players] inserted=${playerSync.insertedPlayers} updated=${playerSync.updatedPlayers} errors=${playerSync.rosterErrors.length}`,
    );
  } catch (error) {
    console.warn(
      `[players] sync failed, continuing with existing data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  try {
    const capSync = await syncCap(existing.cap);
    cap = capSync.cap;
    console.log(`[cap] updated=${capSync.updatedCount} unmatched=${capSync.unmatched.length}`);
  } catch (error) {
    console.warn(
      `[cap] sync failed, continuing with existing data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  const payload: IngestedLeagueData = {
    updatedAt: now,
    teams: canonicalTeams.map((team) => ({
      id: team.abbreviation,
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      conference: team.conference,
      division: team.division,
      normalizedName: team.name.toLowerCase(),
    })),
    players,
    cap,
  };

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const teamCount = payload.teams.length;
  const capCount = payload.cap.length;
  const playerCount = payload.players.length;
  const mismatchCount = Math.max(0, teamCount - capCount);

  console.log('sync summary');
  console.log(`teams: ${teamCount}`);
  console.log(`players: ${playerCount}`);
  console.log(`cap records: ${capCount}`);
  console.log(`mismatches: ${mismatchCount}`);
};

run().catch((error) => {
  console.error(`sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
});
