import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { IngestedLeagueData } from '@/server/data/nfl-data';
import { syncContracts } from '@/server/ingest/contracts';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');

const readExisting = async (): Promise<IngestedLeagueData> => {
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as IngestedLeagueData;
};

const run = async () => {
  const existing = await readExisting();
  const result = await syncContracts(existing.teams, existing.players, existing.contracts ?? []);

  console.log('contracts reconciliation report');
  console.log(JSON.stringify(result.report, null, 2));

  console.log('sample matched contracts');
  result.contracts.slice(0, 25).forEach((contract) => {
    const player = existing.players.find(
      (entry) => entry.id === contract.playerId && entry.teamAbbr === contract.teamId,
    );
    const capHit = contract.capHitCurrentYear ?? 0;
    const deadCap = contract.deadCap ?? 0;
    const guaranteed = contract.guaranteedMoney ?? contract.fullyGuaranteedMoney ?? 0;
    console.log(
      `${player?.fullName ?? contract.playerId} | ${contract.teamId} | capHit=${capHit} | deadCap=${deadCap} | guaranteed=${guaranteed} | synced=${contract.contractLastSyncedAt}`,
    );
  });
};

run().catch((error) => {
  console.error(
    `sync contracts failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  process.exitCode = 1;
});
