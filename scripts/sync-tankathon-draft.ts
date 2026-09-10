import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseTankathonDraftBoard,
  TANKATHON_DRAFT_URL,
} from '@/server/data-sources/tankathon-draft';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'src/server/data/draft-prospects-2027.json');
const MANIFEST = path.join(ROOT, 'src/server/data/draft-prospects-2027.meta.json');
const LEGACY = path.join(ROOT, 'src/server/data/draft-prospects.json');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const projectedRange = (rank: number) =>
  rank <= 10
    ? 'Top 10'
    : rank <= 32
      ? 'Round 1'
      : rank <= 64
        ? 'Round 2'
        : rank <= 96
          ? 'Round 3'
          : rank <= 128
            ? 'Round 4'
            : 'Day 3';

const main = async () => {
  const fetchedAt = new Date().toISOString();
  const fixturePath = process.argv.find((argument) => argument.startsWith('--html='))?.slice(7);
  const force = process.argv.includes('--force') || Boolean(fixturePath);
  if (!force) {
    const currentManifest = JSON.parse(
      await readFile(MANIFEST, 'utf8').catch(() => '{"fetchedAt":null}'),
    ) as { fetchedAt?: string | null };
    const lastFetched = currentManifest.fetchedAt
      ? new Date(currentManifest.fetchedAt).getTime()
      : 0;
    if (lastFetched && Date.now() - lastFetched < 14 * 24 * 60 * 60 * 1000) {
      console.log('Draft prospect dataset is less than 14 days old; no refresh is due.');
      return;
    }
  }
  let html: string;
  if (fixturePath) {
    html = await readFile(fixturePath, 'utf8');
  } else {
    const response = await fetch(TANKATHON_DRAFT_URL, {
      headers: {
        'user-agent': 'DownAndDistanceDraftSync/1.0 (low-frequency reference-data refresh)',
      },
    });
    if (!response.ok) throw new Error(`Tankathon returned HTTP ${response.status}.`);
    html = await response.text();
  }
  const board = parseTankathonDraftBoard(html, fetchedAt);
  const legacy = JSON.parse(await readFile(LEGACY, 'utf8')) as DraftProspectRecord[];
  const profiles = new Map(legacy.map((prospect) => [normalizeName(prospect.name), prospect]));

  const prospects: DraftProspectRecord[] = board.prospects.map((entry) => {
    const profile = profiles.get(normalizeName(entry.name));
    const range = projectedRange(entry.sourceRank);
    const size = [entry.height, entry.weight ? `${entry.weight} pounds` : null]
      .filter(Boolean)
      .join(', ');
    return {
      id: `2027-${slugify(entry.name)}-${slugify(entry.school)}`,
      draftYear: 2027,
      sourceRank: entry.sourceRank,
      name: entry.name,
      normalizedName: normalizeName(entry.name),
      school: entry.school,
      schoolLogo: entry.schoolLogo,
      position: entry.position,
      positionRank: 0,
      ranking: entry.sourceRank,
      sourceRanks: { pff: null, espn: null, consensus: null, tankathon: entry.sourceRank },
      averageRank: entry.sourceRank,
      confidence: 'high',
      espnPlayerId: profile?.espnPlayerId ?? null,
      espnProfileUrl: profile?.espnProfileUrl ?? null,
      headshotUrl: profile?.headshotUrl ?? null,
      headshotSource: profile?.headshotUrl ? 'espn-profile-cache' : null,
      headshotStatus: profile?.headshotUrl ? 'verified-cache-match' : 'fallback',
      headshotSourceUrl: profile?.espnProfileUrl ?? null,
      age: profile?.age ?? null,
      classYear: '2027 Draft',
      height: entry.height,
      weight: entry.weight,
      hometown: profile?.hometown ?? null,
      stats: {},
      summary: `${size ? `${size} ` : ''}${entry.position} from ${entry.school} and the current No. ${entry.sourceRank} prospect on Tankathon's 2027 board.`,
      archetype: null,
      projectedRange: range,
      source: 'tankathon',
      sourceUpdatedAt: board.sourceUpdatedAt,
      sourceProfileUrl: entry.profileUrl,
      grade: Math.max(60, 96 - (entry.sourceRank - 1) * 0.24).toFixed(1),
      projectedPick: entry.sourceRank,
    };
  });

  const positionCounts = new Map<string, number>();
  prospects.forEach((prospect) => {
    const next = (positionCounts.get(prospect.position ?? '') ?? 0) + 1;
    positionCounts.set(prospect.position ?? '', next);
    prospect.positionRank = next;
  });

  const previous = await readFile(OUTPUT, 'utf8').catch(() => null);
  if (previous) await writeFile(`${OUTPUT}.last-good`, previous);
  await writeFile(`${OUTPUT}.tmp`, `${JSON.stringify(prospects, null, 2)}\n`);
  await rename(`${OUTPUT}.tmp`, OUTPUT);
  await writeFile(
    MANIFEST,
    `${JSON.stringify(
      {
        draftYear: 2027,
        version: `2027-tankathon-${board.sourceUpdatedAt.slice(0, 10)}`,
        source: TANKATHON_DRAFT_URL,
        sourceUpdatedAt: board.sourceUpdatedAt,
        fetchedAt,
        prospectCount: prospects.length,
        headshotCount: prospects.filter((prospect) => prospect.headshotUrl).length,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Published ${prospects.length} 2027 Tankathon prospects.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
