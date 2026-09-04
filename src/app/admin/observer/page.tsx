'use client';

import { useEffect, useMemo, useState } from 'react';

type Payload = { registry: any[]; report: any | null; error?: string };

export default function ObserverDashboard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('ALL');
  const [tier, setTier] = useState('ALL');
  const [decision, setDecision] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [hours, setHours] = useState(24);
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [pushThreshold, setPushThreshold] = useState(80);

  useEffect(() => {
    void fetch('/api/admin/observer?team=KC', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as Payload;
        if (!response.ok) throw new Error(body.error ?? 'Unable to load observer run.');
        setPayload(body);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load observer run.'),
      );
  }, []);

  const events = useMemo(
    () =>
      (payload?.report?.events ?? []).filter((event: any) => {
        const sources = event.sources ?? [];
        return (
          (source === 'ALL' || sources.some((item: any) => item.id === source)) &&
          (tier === 'ALL' ||
            sources.some(
              (item: any) => String(item.tier === 'A' ? 1 : item.tier === 'B' ? 2 : 3) === tier,
            )) &&
          (decision === 'ALL' || event.replayDecision?.decision === decision) &&
          (category === 'ALL' || event.category === category) &&
          Date.now() - new Date(event.captured_at).getTime() <= hours * 3_600_000 &&
          Number(event.confidence) >= minimumConfidence
        );
      }),
    [category, decision, hours, minimumConfidence, payload, source, tier],
  );

  const replay = async () => {
    const report = payload?.report;
    if (!report) return;
    const thresholds = { ...report.thresholds, pushNotificationMin: pushThreshold };
    const response = await fetch('/api/admin/observer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: report.run.id, thresholds }),
    });
    const body = await response.json();
    if (response.ok)
      setPayload((current) => (current ? { ...current, report: body.report } : current));
  };

  if (error)
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-black">Observer dashboard</h1>
        <p className="mt-5 text-red-700">{error}</p>
      </main>
    );
  if (!payload) return <main className="p-8 font-bold">Loading observer dashboard…</main>;
  const report = payload.report;
  const outcomeLabels: Record<string, string> = {
    push: 'Push notification',
    theBeat: 'The Beat',
    hotRead: 'Hot Read',
    filmRoom: 'Film Room',
    threeAndOut: 'Three & Out',
  };
  return (
    <main className="mx-auto max-w-[1440px] p-4 text-slate-950 sm:p-8">
      <h1 className="text-3xl font-black">Chiefs observer dashboard</h1>
      <p className="mt-2 text-slate-600">
        Review real ingestion, proposed content, notification decisions, and source health.
      </p>
      {!report ? (
        <p className="mt-8 rounded-2xl border p-6">No observer run exists yet.</p>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(report.summary)
              .filter(([, value]) => ['string', 'number'].includes(typeof value))
              .map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-white p-4">
                  <p className="text-xs font-black uppercase text-slate-500">
                    {label.replace(/([A-Z])/g, ' $1')}
                  </p>
                  <p className="mt-2 text-2xl font-black">{String(value)}</p>
                </div>
              ))}
          </section>
          <section className="mt-6 flex flex-wrap gap-3 rounded-2xl border bg-slate-50 p-4">
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="rounded-lg border p-2"
            >
              <option value="ALL">All sources</option>
              {payload.registry.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              className="rounded-lg border p-2"
            >
              <option value="ALL">All tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              className="rounded-lg border p-2"
            >
              <option value="ALL">All decisions</option>
              <option>PUSH</option>
              <option>CANDIDATE</option>
              <option>FEED_ONLY</option>
              <option>INDEX_ONLY</option>
              <option>SUPPRESSED</option>
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-lg border p-2"
            >
              <option value="ALL">All content types</option>
              {Array.from(
                new Set<string>((report.events ?? []).map((event: any) => String(event.category))),
              ).map((value: string) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              Time{' '}
              <select
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
                className="rounded-lg border p-2"
              >
                <option value={1}>Last hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Min confidence{' '}
              <input
                type="number"
                min="0"
                max="100"
                value={minimumConfidence}
                onChange={(event) => setMinimumConfidence(Number(event.target.value))}
                className="w-20 rounded-lg border p-2"
              />
            </label>
            <label className="flex items-center gap-2">
              Push threshold{' '}
              <input
                type="number"
                min="0"
                max="120"
                value={pushThreshold}
                onChange={(event) => setPushThreshold(Number(event.target.value))}
                className="w-20 rounded-lg border p-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void replay()}
              className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white"
            >
              Replay decisions
            </button>
          </section>
          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-black">Candidate events ({events.length})</h2>
            {events.map((event: any) => (
              <article
                key={`${event.story_id}:${event.story_version}`}
                className="rounded-2xl border bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-black">{event.proposed_story.headline}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">
                    {event.replayDecision.decision} · {event.score}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{event.proposed_story.summary}</p>
                <p className="mt-3 text-xs font-bold">
                  Confidence {event.confidence} · {event.category} · {event.replayDecision.reason}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Sources: {event.source_item_count ?? event.sources.length} · Publishers:{' '}
                  {event.publisher_count ?? '—'} · Independent publishers:{' '}
                  {event.independent_source_count ?? '—'}
                </p>
                {event.cluster_reason ? (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <strong>Cluster decision:</strong> {event.cluster_reason}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {Object.entries(event.outcomes ?? {}).map(([surface, rawOutcome]) => {
                    const outcome = rawOutcome as { action: string; reason: string };
                    const active =
                      outcome.action.startsWith('WOULD_') && !outcome.action.includes('NOT');
                    return (
                      <div
                        key={surface}
                        title={outcome.reason}
                        className={`rounded-xl border p-3 ${
                          active
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <p className="text-xs font-black uppercase">
                          {outcomeLabels[surface] ?? surface}
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {outcome.action.replaceAll('_', ' ')}
                        </p>
                        <p className="mt-1 text-xs">{outcome.reason}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {event.sources.map((item: any) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-red-700 hover:underline"
                    >
                      {item.name} ↗
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </section>
          <section className="mt-8">
            <h2 className="text-xl font-black">Source health</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Method</th>
                    <th>Last success</th>
                    <th>Failures</th>
                    <th>Avg latency</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {report.health.map((item: any) => (
                    <tr key={item.id} className="border-t">
                      <td className="py-3 font-bold">{item.name}</td>
                      <td>{item.fetch_strategy}</td>
                      <td>
                        {item.last_successful_at
                          ? new Date(item.last_successful_at).toLocaleString()
                          : 'Never'}
                      </td>
                      <td>{item.consecutive_failures}</td>
                      <td>
                        {item.average_latency_ms
                          ? `${Math.round(item.average_latency_ms)} ms`
                          : '—'}
                      </td>
                      <td className="max-w-xs truncate text-red-700">{item.last_error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
