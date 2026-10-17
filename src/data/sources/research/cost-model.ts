/** Scenario inputs, NOT account telemetry or measured production CPU. Decimal MB. */
export function sourceExpansionModel(input: {
  dau: number;
  feeds: number;
  checksPerFeedPerDay: number;
  uniqueCandidatesPerDay: number;
}) {
  for (const value of Object.values(input))
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid scenario');
  const checks = Math.ceil(input.feeds * input.checksPerFeedPerDay);
  const extraChecks = Math.max(0, checks - 1040);
  const extraCandidates = Math.max(0, input.uniqueCandidatesPerDay - 200);
  const extraJobs = extraChecks + extraCandidates;
  const extraDailyMb = (extraCandidates * 2048 + extraChecks * 256 + extraJobs * 192) / 1e6;
  const writes = Math.ceil(67709 + extraChecks * 10.03 + extraCandidates * 30.26 + extraJobs * 26);
  const requests = Math.ceil(7984 + 40.8 * input.dau + extraJobs * 1.2);
  const reads = Math.ceil(1949974 + input.dau * 328.32 + extraJobs * 20);
  const r2A = Math.ceil(256212 + extraCandidates * 2 * 30);
  const r2B = Math.ceil(1255800 + input.dau * 3181.32 + extraCandidates * 2 * 30);
  const r2Mb = 6025.14 + (extraCandidates * 8192 * 2 * 365) / 1e6 + extraDailyMb * 365 * 8;
  const days = [30, 90, 180, 365];
  const d1Mb = Object.fromEntries(
    days.map((day) => [day, (321.16 * day) / 365 + extraDailyMb * day]),
  );
  const limits = {
    workerRequests: requests <= 100000,
    d1Reads: reads <= 5000000,
    d1Writes: writes <= 100000,
    d1Database365: d1Mb[365] <= 500,
    engineeringStorageTarget: d1Mb[365] < 350,
    r2Storage: r2Mb <= 10000,
    r2ClassA: r2A <= 1000000,
    r2ClassB: r2B <= 10000000,
  };
  return {
    ...input,
    feedRequestsPerDay: checks,
    workerRequestsPerDay: requests,
    d1ReadsPerDay: reads,
    d1WritesPerDay: writes,
    d1Mb,
    r2Mb365: r2Mb,
    r2ClassAMonth: r2A,
    r2ClassBMonth: r2B,
    workerCpuMs: null,
    accountUsageVerified: false,
    externalPaidApiCalls: 0,
    limits,
    projectedMonthlyCostUsd: Object.entries(limits)
      .filter(([name]) => name !== 'engineeringStorageTarget')
      .every(([, passes]) => passes)
      ? 0
      : null,
  };
}
