import { readFile, writeFile } from 'node:fs/promises';
const measured = JSON.parse(await readFile('measurements/local-benchmark.json', 'utf8'));
const row = (label: string, kind: 'meanRowsRead' | 'meanRowsWritten') =>
  measured.timings[label][kind] as number;
const input = {
  sourceChecks: 1040,
  newOrRevisedCandidates: 200,
  changedStories: 80,
  videoUpdates: 40,
  editions: 32,
  jobs: 1400,
  bridgeOperations: 128,
  runSummaries: 32,
  publicRequests: 20000,
  cacheHitRatio: 0.9,
  originRowsAssumed: 150,
  clusteringRowsPerCandidateAssumed: 500,
  retryReserve: 1.25,
};
const writes =
  input.jobs *
    (row('job.enqueue', 'meanRowsWritten') +
      row('job.claim', 'meanRowsWritten') +
      row('job.complete', 'meanRowsWritten')) +
  input.sourceChecks * row('source.check', 'meanRowsWritten') +
  input.newOrRevisedCandidates * row('candidate.new', 'meanRowsWritten') +
  input.changedStories *
    (row('story.new', 'meanRowsWritten') + row('story.publication', 'meanRowsWritten')) +
  input.newOrRevisedCandidates * row('evidence.new', 'meanRowsWritten') +
  input.videoUpdates * row('video.upsert', 'meanRowsWritten') +
  input.editions * row('edition.publish', 'meanRowsWritten') +
  input.bridgeOperations * 4 +
  input.runSummaries * row('run.record', 'meanRowsWritten');
const reads =
  input.publicRequests * (1 - input.cacheHitRatio) * input.originRowsAssumed +
  input.newOrRevisedCandidates * input.clusteringRowsPerCandidateAssumed +
  input.jobs *
    (row('job.enqueue', 'meanRowsRead') +
      row('job.claim', 'meanRowsRead') +
      row('job.complete', 'meanRowsRead')) +
  input.sourceChecks * row('source.check', 'meanRowsRead') +
  input.newOrRevisedCandidates * row('candidate.new', 'meanRowsRead') +
  input.changedStories * row('story.publication', 'meanRowsRead') +
  input.editions * row('edition.publish', 'meanRowsRead') +
  input.bridgeOperations * 4;
const bytes = (table: string) => measured.jsonBytes[table].meanBytes as number;
const logicalMeasured = Object.values(measured.jsonBytes).reduce(
  (s: number, v: any) => s + v.bytes,
  0,
);
const amplification = Math.max(1.2, measured.sqliteBytes / logicalMeasured);
const dailyJson =
  input.newOrRevisedCandidates *
    (bytes('content_candidates') + bytes('content_candidate_revisions')) +
  input.changedStories *
    (bytes('canonical_stories') +
      bytes('story_versions') +
      bytes('story_publication_decisions') +
      bytes('editorial_cards')) +
  input.newOrRevisedCandidates * bytes('story_evidence') +
  input.videoUpdates * bytes('film_room_videos') +
  input.editions * Math.max(10000, bytes('three_and_out_snapshots')) +
  (input.changedStories + input.editions) * bytes('content_outbox') +
  input.sourceChecks * Math.max(300, bytes('source_checks')) +
  input.jobs * 500 +
  input.runSummaries * 300;
const dailyPhysical = dailyJson * amplification;
const sensitivityPhysical =
  (dailyJson + input.changedStories * Math.max(0, 12000 - bytes('story_versions'))) * amplification;
const output = {
  scope:
    'Projection only; local row meters and synthetic density do not certify production quotas or CPU.',
  input,
  accountLimits: {
    readsPerDay: 5000000,
    writesPerDay: 100000,
    perDatabaseBytes: 500000000,
    workerCpuMs: 10,
    queriesPerInvocation: 50,
  },
  operatingTargets: { readsPerDay: 3500000, writesPerDay: 70000, storageBytes: 350000000 },
  dailyReadsWithReserve: Math.ceil(reads * input.retryReserve),
  dailyWritesWithReserve: Math.ceil(writes * input.retryReserve),
  writeModelConservatism:
    'Candidate commits already insert their processing job; modeling standalone enqueue for all 1400 jobs intentionally double-counts some writes. Bridge costs, clustering, cache hits, and future provider processing are assumptions, not implemented pipeline measurements.',
  workerInvocationsAssumed: 24000,
  storage: {
    sampleBytes: measured.sqliteBytes,
    sampleJsonBytes: logicalMeasured,
    syntheticAmplification: amplification,
    projectedDailyBytes: dailyPhysical,
    projected30DayBytes: measured.sqliteBytes + dailyPhysical * 30,
    projected90DayBytes: measured.sqliteBytes + dailyPhysical * 90,
    daysTo350MB: (350000000 - measured.sqliteBytes) / dailyPhysical,
    daysTo500MB: (500000000 - measured.sqliteBytes) / dailyPhysical,
    with12KBVersionDailyBytes: sensitivityPhysical,
    with12KBVersion90DayBytes: measured.sqliteBytes + sensitivityPhysical * 90,
  },
  decision: {
    dailyRows: 'Conditionally within operating targets for these assumptions only',
    storage: '90-day operating target fails without a separately approved lossless lifecycle plan',
    workerCpu: 'UNQUALIFIED: no deployed Free CPU measurement; Node host CPU is not Worker CPU',
    productionMigration: 'NOT AUTHORIZED; no production access or deployment performed',
  },
};
await writeFile('measurements/free-tier-projection.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
