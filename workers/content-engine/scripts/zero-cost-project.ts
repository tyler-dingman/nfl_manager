import { readFile, writeFile } from 'node:fs/promises';
const benchmark = JSON.parse(await readFile('measurements/zero-cost-benchmark.json', 'utf8'));
const queue = JSON.parse(await readFile('measurements/zero-cost-queue.json', 'utf8'));
const publication = JSON.parse(await readFile('measurements/zero-cost-publication.json', 'utf8'));
const quotas = {
  d1DatabaseBytes: 500000000,
  d1AccountBytes: 5000000000,
  d1ReadsPerDay: 5000000,
  d1WritesPerDay: 100000,
  d1DatabaseCount: 10,
  workerRequestsPerDay: 100000,
  workerCpuMsPerInvocation: 10,
  d1QueriesPerInvocation: 50,
  r2StorageBytes: 10000000000,
  r2ClassAPer30Days: 1000000,
  r2ClassBPer30Days: 10000000,
  cronCount: 5,
};
const budgets = Object.fromEntries(Object.entries(quotas).map(([k, v]) => [k, v * 0.8]));
const assumptions = {
  safetyMargin: 0.2,
  operationMultiplier: 1.2,
  pageMultiplier: 1.2,
  additionalPrivateR2Copies: 1,
  retainedFullDatabaseSnapshots: 8,
  databaseBackupChunkBytes: 512000,
  activeAndControlRowsForExport: 20000,
  activeQueueAndLegacyControlBytes: 20000000,
  migrationScratchBytes: 10000000,
  sourcePollsPerDay: 1040,
  sourceCheckpointWritesPerPoll: 3,
  sourceCheckpointReadsPerPoll: 4,
  deliveryChecksPerDay: 288,
  newsSchedulerRunsPerDay: 8,
  searchReconciliationsPerDay: 1,
  oddsRefreshesPerWeek: 3,
  oddsRefreshRequestsPerRun: 100,
  apiRequestsPerDau: 28,
  publicParlayApiRequestsPerDau: 8,
  ssrNavigationRequestsPerDau: 6,
  staticAssetRequestsPerDau: 200,
  registeredUsersPerDau: 5,
  minimumRetainedRegisteredUsers: 100,
  optedInSubscriberShare: 0.5,
  publicEditorialRequestsPerDau: 12,
  privateApiRequestsPerDau: 6,
  searchRequestsPerDau: 2,
  anonymousPublicRequestShare: 0.4,
  anonymousHitRatesByDau: { 100: 0.25, 1000: 0.6, 5000: 0.8 },
  r2ObjectsPerPublicMiss: 11,
  searchCacheHitRate: 0.25,
  searchRowsExaminedPerMiss: 200,
  privateOriginRowReadsPerDau: 60,
  privateOriginRowWritesPerDau: 4,
  estimatedCpuMsPerWorkerRequest: 8,
  peakFractionOfDailyTraffic: 0.2,
  peakWindowSeconds: 600,
};
const output: any = {
  scope:
    'Measured local editorial repositories plus explicit launch estimates. Free-tier Cloudflare component cost only; retained PostgreSQL/Node/model/email/odds/CI costs unknown. No whole-product $0 certification.',
  checkedDate: '2026-10-16',
  quotas,
  budgets,
  assumptions,
  alternatives: {},
  traffic: {},
};
for (const [key, v] of Object.entries(benchmark.results) as [string, any][]) {
  const strategy = key[0],
    retentionValues = strategy === 'B' ? [7, 14, 30] : [0];
  for (const retention of retentionValues) {
    const postGrowth =
      strategy === 'B' ? v.retirement.after.ownedBytes - v.before.ownedBytes : v.ownedGrowthBytes;
    const hotExtra = strategy === 'B' ? v.after.ownedBytes - v.retirement.after.ownedBytes : 0;
    const baseWrites =
      v.rowsWritten +
      publication.rowsWritten +
      queue.dailyRowsWritten +
      queue.dailyTerminalDeletionRowsWritten +
      1040 * 3 +
      (v.retirement?.rowsWritten ?? 0) +
      512;
    const baseReads =
      v.rowsRead +
      publication.rowsRead +
      queue.dailyRowsRead +
      queue.dailyTerminalAdditionalReadAllowance +
      1040 * 4 +
      (v.retirement?.rowsRead ?? 0) +
      288 * 32;
    const beforeRows = new Map(
      v.before.objects.filter((o: any) => o.type === 'table').map((o: any) => [o.name, o.rows]),
    );
    const dailyGrowingRows =
      v.after.objects
        .filter((o: any) => o.type === 'table' && o.name.startsWith('lean_'))
        .reduce((n: number, o: any) => n + o.rows - Number(beforeRows.get(o.name) ?? 0), 0) + 83;
    const horizons: any = {};
    for (const days of [30, 90, 180, 365, 730, 1095]) {
      const d1Bytes = Math.ceil(
        v.before.ownedBytes +
          30000000 +
          1.2 *
            ((postGrowth + publication.ownedGrowthBytes) * days +
              hotExtra * Math.min(days, retention)),
      );
      const payloadR2Bytes = Math.ceil((v.objectBytes + publication.objectBytes) * days * 2 * 1.2);
      const inventoryBackupR2Bytes = Math.ceil(d1Bytes * 8 * 1.2);
      const backupObjects = Math.ceil(d1Bytes / 512000) + 1;
      horizons[days] = {
        d1Bytes,
        payloadR2Bytes,
        inventoryBackupR2Bytes,
        r2Bytes: payloadR2Bytes + inventoryBackupR2Bytes,
        dailyFullInventoryExportRows: dailyGrowingRows * days + 20000,
        dailyBackupObjectWrites: backupObjects,
        dailyBackupCheckpointWrites: Math.ceil(backupObjects / 8) * 4,
      };
    }
    const peak = horizons[365];
    const dailyWrites = Math.ceil(1.2 * (baseWrites + peak.dailyBackupCheckpointWrites));
    const dailyReads = Math.ceil(1.2 * (baseReads + peak.dailyFullInventoryExportRows));
    const backgroundRequests = Math.ceil(
      1.2 *
        (v.objectWrites +
          publication.objectWrites +
          1400 +
          1040 +
          288 +
          8 +
          1 +
          (3 * 100) / 7 +
          peak.dailyBackupObjectWrites),
    );
    output.alternatives[`${key}${retention ? `-${retention}d` : ''}`] = {
      strategy,
      retentionDays: retention,
      dailyD1Reads: dailyReads,
      dailyD1Writes: dailyWrites,
      backgroundRequests,
      dailyR2PrimaryWrites: v.objectWrites + publication.objectWrites,
      dailyR2Writes: (v.objectWrites + publication.objectWrites) * 2 + peak.dailyBackupObjectWrites,
      dailyR2ReadsBenchmarkConservative:
        (v.objectReads + publication.objectReads) * 2 +
        queue.dailyTerminalAdditionalR2ReadAllowance +
        peak.dailyBackupObjectWrites,
      r2ClassAPer30Days: Math.ceil(
        ((v.objectWrites + publication.objectWrites) * 2 + peak.dailyBackupObjectWrites) * 30 * 1.2,
      ),
      r2BackgroundClassBPer30Days:
        Math.ceil(
          1.2 *
            ((v.objectReads + publication.objectReads) * 2 +
              queue.dailyTerminalAdditionalR2ReadAllowance +
              peak.dailyBackupObjectWrites),
        ) * 30,
      horizons,
      workerCpu: 'UNVERIFIED; only Node coordinator CPU measured',
      supportsIndexedHistory: strategy !== 'C',
      costIfWithinFreeLimits: 0,
    };
  }
}
const selected = output.alternatives['A-entropy'];
for (const dau of [0, 100, 1000, 5000]) {
  const effectiveHit = 0.4 * (dau === 100 ? 0.25 : dau === 1000 ? 0.6 : dau === 5000 ? 0.8 : 0);
  const userOriginPublicMisses = 12 * dau * (1 - effectiveHit),
    searchMisses = 2 * dau * (1 - 0.25);
  const publicRowsPerMiss = 30; // Covers indexed discovery page/detail mixture; read-meter sensitivity below.
  const d1Reads =
    selected.dailyD1Reads + Math.ceil(1.2 * userOriginPublicMisses * publicRowsPerMiss);
  const requests = selected.backgroundRequests + Math.ceil(1.2 * 34 * dau);
  const r2ReadsPerDay = Math.ceil(
    1.2 * (selected.dailyR2ReadsBenchmarkConservative + userOriginPublicMisses * 11),
  );
  const r2BMonthly = r2ReadsPerDay * 30;
  const passesSafe =
    requests <= budgets.workerRequestsPerDay &&
    d1Reads <= budgets.d1ReadsPerDay &&
    selected.dailyD1Writes <= budgets.d1WritesPerDay &&
    selected.horizons[365].d1Bytes <= budgets.d1DatabaseBytes &&
    selected.horizons[365].r2Bytes <= budgets.r2StorageBytes &&
    selected.r2ClassAPer30Days <= budgets.r2ClassAPer30Days &&
    r2BMonthly <= budgets.r2ClassBPer30Days;
  const passesHard =
    requests <= quotas.workerRequestsPerDay &&
    d1Reads <= quotas.d1ReadsPerDay &&
    selected.dailyD1Writes <= quotas.d1WritesPerDay &&
    selected.horizons[365].d1Bytes <= quotas.d1DatabaseBytes &&
    selected.horizons[365].r2Bytes <= quotas.r2StorageBytes &&
    selected.r2ClassAPer30Days <= quotas.r2ClassAPer30Days &&
    r2BMonthly <= quotas.r2ClassBPer30Days;
  output.traffic[dau] = {
    dau,
    workerRequestsPerDay: requests,
    estimatedWorkerCpuMsPerDay: requests * 8,
    workerCpuPerRequest: 'UNVERIFIED; 8ms is planning budget, not a measured runtime result',
    d1ReadsPerDay: d1Reads,
    d1WritesPerDay: selected.dailyD1Writes,
    r2ReadsPerDay,
    r2ClassBPer30Days: r2BMonthly,
    r2ClassAPer30Days: selected.r2ClassAPer30Days,
    r2WritesPerDay: selected.dailyR2Writes,
    storage: selected.horizons,
    backgroundRequests: selected.backgroundRequests,
    apiRequestsPerDay: 28 * dau,
    ssrNavigationRequestsPerDay: 6 * dau,
    staticAssetRequestsPerDay: 200 * dau,
    retainedRegisteredUsers: Math.max(100, 5 * dau),
    deliveryPgRowTouchesPlanningEstimate: 288 * Math.ceil(0.5 * Math.max(100, 5 * dau)) * 4,
    searchRequestsPerDay: 2 * dau,
    searchOriginRequestsPerDay: Math.ceil(searchMisses),
    searchPgRowsReadEstimate: Math.ceil(searchMisses * 200),
    privatePgRowsReadEstimate: 60 * dau,
    privatePgRowsWrittenEstimate: 4 * dau,
    parlayApiRequestsPerDay: 8 * dau,
    priorMeasuredParlayFullEventEgressSensitivityPerMonth: Math.ceil(0.2 * dau * 30 * 17511152),
    priorFo1RosterEgressSensitivityPerMonth: Math.ceil(0.2 * dau * 30 * 2310000),
    retainedNeonPollingCuHoursPerMonth: 180,
    retainedNeonFreeStatus:
      'FAIL for nominal 5-minute all-day DB polling at default 0.25 CU; not a current account usage measurement',
    peakWorkerRps: (requests * 0.2) / 600,
    peakUserD1RowsPerSecond: (d1Reads * 0.2) / 600,
    cacheHitRateEstimate: effectiveHit,
    r2ObjectsPerPublicMiss: 11,
    full20ObjectMissMonthlyR2ClassB:
      Math.ceil(1.2 * (selected.dailyR2ReadsBenchmarkConservative + userOriginPublicMisses * 20)) *
      30,
    zeroCacheMonthlyR2ClassB:
      Math.ceil(1.2 * (selected.dailyR2ReadsBenchmarkConservative + 12 * dau * 11)) * 30,
    zeroCacheDailyD1Reads: selected.dailyD1Reads + Math.ceil(1.2 * 12 * dau * 30),
    cloudflareComponentMonthlyCost: passesHard
      ? '$0 estimated, CPU/integration unverified'
      : 'Free plan not serviceable; no paid usage authorized',
    within20PercentBudgets: passesSafe,
    withinHardNumericalLimitsExcludingCpu: passesHard,
    wholeProductMonthlyCost:
      'UNKNOWN; existing backend/DB/model/email/CI/provider costs not certified',
  };
}
const requestMax = Math.floor(
  (budgets.workerRequestsPerDay - selected.backgroundRequests) / (1.2 * 34),
);
const r2Max = Math.floor(
  (budgets.r2ClassBPer30Days / 30 - 1.2 * selected.dailyR2ReadsBenchmarkConservative) /
    (1.2 * 12 * (1 - 0.4 * 0.6) * 11),
);
const readMax = Math.floor(
  (budgets.d1ReadsPerDay - selected.dailyD1Reads) / (1.2 * 12 * (1 - 0.4 * 0.6) * 30),
);
output.maximumEstimatedEditorialDauWithSafety = Math.max(0, Math.min(requestMax, readMax, r2Max));
output.maximumEstimatedEditorialDauAt20ObjectsPerMiss = Math.max(
  0,
  Math.min(
    requestMax,
    readMax,
    Math.floor(
      (budgets.r2ClassBPer30Days / 30 - 1.2 * selected.dailyR2ReadsBenchmarkConservative) /
        (1.2 * 12 * (1 - 0.4 * 0.6) * 20),
    ),
  ),
);
output.maximumQualifiedWholeProductDau = 0;
output.selected =
  'A — lean D1 metadata + immutable self-describing R2 documents; retain existing transactional and search systems pending cost qualification';
output.readiness = 'CONDITIONAL';
output.retainedInfrastructure = {
  neon: {
    officialFreeCuHours: 100,
    safeCuHours: 80,
    officialStorageBytes: 1000000000,
    safeStorageBytes: 800000000,
    officialTransferBytes: 5000000000,
    safeTransferBytes: 4000000000,
    defaultCu: 0.25,
    suspendMinutes: 5,
    existingDeliveryCallsPer30Days: 8640,
    nominalContinuousPollingCuHours: 180,
    status:
      'Current nominal all-day five-minute DB polling fails Free compute even at zero DAU. Actual plan/usage uninspected.',
    source: 'https://neon.com/pricing',
  },
  priorPocReferences: {
    integrationAudit: 'c785bbc5',
    frontOffice: 'afe79c90',
    nextDueScheduler: '0dd422d5',
    parlayCadence: '50190c9d superseded by current user instruction: 3 times/week',
  },
  commercialNodeHosting:
    'Vercel Hobby is non-commercial/personal; eligible hosting and existing native Node dependencies are unresolved. No plan was activated.',
};
output.notes = [
  'No official 350MB limit; 400MB is the 20% reserve budget under the actual 500MB per-database cap.',
  'All numerical estimates reserve retry/peak operations; high-frequency application traffic does not increase content-ingestion writes.',
  'R2 totals include an second verified full copy in a separate private store; not provider-independent disaster isolation and 20% storage reserve, not just compressed payload estimates.',
  'Full daily metadata export is conservatively charged as a row read per retained record; backup orchestration is a planning requirement, not a production implementation.',
  'Queue storage has a 20MB active/control reserve conditional on safe terminal handoff. The current original queue is not automatically retired by the new repository.',
  'PostgreSQL/model service quotas, search index physical growth, email delivery and auth CPU/Node compatibility remain blockers, not zero-cost assumptions.',
];
await writeFile('measurements/zero-cost-projection.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
