import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { IngestedLeagueData } from '@/server/data/nfl-data';
import { syncCap } from '@/server/ingest/cap';
import { syncContracts } from '@/server/ingest/contracts';
import { syncPlayers } from '@/server/ingest/players';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');

const run = async () => {
  const now = new Date().toISOString();

  const playerSync = await syncPlayers();
  const capSync = await syncCap();
  const contractSync = await syncContracts(playerSync.teams, playerSync.players);

  const payload: IngestedLeagueData = {
    updatedAt: now,
    teams: playerSync.teams,
    players: playerSync.players,
    contracts: contractSync.contracts,
    cap: capSync.cap,
  };

  const teamsWithPlayers = new Set(payload.players.map((player) => player.teamAbbr));
  const teamsWithoutPlayers = payload.teams.filter((team) => !teamsWithPlayers.has(team.abbr));
  const contractPlayerIds = new Set(payload.players.map((player) => player.id));
  const unmatchedContracts = payload.contracts.filter((contract) => !contractPlayerIds.has(contract.playerId));

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('sync summary');
  console.log(`teams count: ${payload.teams.length}`);
  console.log(`players count: ${payload.players.length}`);
  console.log(`contracts count: ${payload.contracts.length}`);
  console.log(`cap entries count: ${payload.cap.length}`);
  console.log(`teams without players: ${teamsWithoutPlayers.length}`);
  console.log(`contracts without matching players: ${unmatchedContracts.length}`);
  console.log(
    `[contracts] rows=${contractSync.report.totalContractRows} matched=${contractSync.report.matchedPlayers} unmatched=${contractSync.report.unmatchedPlayers} conflicts=${contractSync.report.duplicateMatchConflicts} missingTeams=${contractSync.report.teamsWithMissingContractPages.length}`,
  );
  console.log(`[players] rosterErrors=${playerSync.rosterErrors.length}`);
  console.log(`[cap] unmatched=${capSync.unmatched.length}`);
};

run().catch((error) => {
  console.error(`sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
});
