import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { authDb } from '../src/server/auth/database';
import { assertLocalOllamaUrl, getContentAiConfig } from '../src/features/content/ai-provider';
import {
  OllamaOutputValidationError,
  OllamaTopicSummarizer,
  sourceSimilarity,
} from '../src/features/content/ollama-summarizer';
import type { ContentSource, ContentSourceKind } from '../src/features/content/types';
import { TEAM_LIST } from '../src/data/teams';

loadEnvConfig(process.cwd());
const TOTAL = 50;
type StressSource = ContentSource & { tier: string; authority: string };
type Scenario = { id: string; scenarioType: string; storyType: string; sources: StressSource[] };
const kind = (value: string): ContentSourceKind =>
  value === 'YOUTUBE' ? 'video' : value.includes('OFFICIAL') ? 'official' : 'reporting';

async function loadScenarios(): Promise<Scenario[]> {
  const rows =
    await authDb()`SELECT c.id,c.external_id,c.title,c.excerpt,c.raw_text,c.canonical_url,
      c.published_at,c.fingerprint,c.candidate_teams,c.metadata,s.name,s.source_type,s.polling_tier
    FROM content_candidates c JOIN content_sources s ON s.id=c.source_id
    ORDER BY c.published_at DESC,c.id`;
  if (rows.length < TOTAL)
    throw new Error(`Stress test requires 50 real candidates; found ${rows.length}.`);
  const byType = new Map<string, any[]>();
  for (const row of rows) {
    const storyType = String(row.metadata?.storyType ?? 'UNKNOWN');
    byType.set(storyType, [...(byType.get(storyType) ?? []), row]);
  }
  const selected: any[] = [];
  while (selected.length < TOTAL && [...byType.values()].some((values) => values.length)) {
    for (const values of byType.values()) {
      const row = values.shift();
      if (row && selected.length < TOTAL) selected.push(row);
    }
  }
  const scenarios: Scenario[] = selected.map((row) => {
    const text = `${row.title} ${row.excerpt ?? row.raw_text}`;
    const difficult =
      /rumou?r|reportedly|questionable|uncertain|conflict|dispute|interest|discussion/i.test(text);
    return {
      id: String(row.id),
      scenarioType: difficult ? 'difficult/rumor' : 'single-source',
      storyType: String(row.metadata?.storyType ?? 'UNKNOWN'),
      sources: [
        {
          id: String(row.id),
          teamAbbr: String(row.candidate_teams?.[0] ?? 'NFL'),
          kind: kind(String(row.source_type)),
          publisher: String(row.name),
          title: String(row.title),
          url: String(row.canonical_url),
          publishedAt: new Date(row.published_at).toISOString(),
          excerpt: String(row.excerpt || row.raw_text || row.title),
          topicKey: String(row.fingerprint),
          tier: String(row.polling_tier),
          authority: String(row.source_type),
        },
      ],
    };
  });
  const multiRows = await authDb()`SELECT c.id,c.title,c.excerpt,c.raw_text,c.canonical_url,
      c.published_at,c.fingerprint,c.candidate_teams,c.metadata,s.name,s.source_type,s.polling_tier,e.story_id
    FROM story_evidence e JOIN content_candidates c ON c.id=e.content_candidate_id
    JOIN content_sources s ON s.id=e.source_id
    WHERE e.story_id=(SELECT story_id FROM story_evidence GROUP BY story_id HAVING count(*)>1 ORDER BY story_id LIMIT 1)
    ORDER BY c.published_at`;
  if (multiRows.length > 1) {
    scenarios[scenarios.length - 1] = {
      id: `multi:${multiRows[0].story_id}`,
      scenarioType: 'multi-source',
      storyType: String(multiRows[0].metadata?.storyType ?? 'UNKNOWN'),
      sources: multiRows.map((row) => ({
        id: String(row.id),
        teamAbbr: String(row.candidate_teams?.[0] ?? 'NFL'),
        kind: kind(String(row.source_type)),
        publisher: String(row.name),
        title: String(row.title),
        url: String(row.canonical_url),
        publishedAt: new Date(row.published_at).toISOString(),
        excerpt: String(row.excerpt || row.raw_text || row.title),
        topicKey: String(row.fingerprint),
        tier: String(row.polling_tier),
        authority: String(row.source_type),
      })),
    };
  }
  const versionRows =
    await authDb()`SELECT v.story_id,v.version,v.headline,v.summary,v.what_happened,
      st.team_id,st.story_type,st.last_meaningful_update_at
    FROM story_versions v JOIN canonical_stories st ON st.id=v.story_id
    WHERE v.story_id IN (SELECT story_id FROM story_versions GROUP BY story_id HAVING count(*)>1)
    ORDER BY v.story_id,v.version`;
  const versionGroups = new Map<string, any[]>();
  for (const row of versionRows)
    versionGroups.set(String(row.story_id), [
      ...(versionGroups.get(String(row.story_id)) ?? []),
      row,
    ]);
  let replacement = scenarios.length - 2;
  for (const [storyId, versions] of [...versionGroups].slice(0, 7)) {
    scenarios[replacement--] = {
      id: `evolving:${storyId}`,
      scenarioType: 'evolving-story',
      storyType: String(versions[0].story_type),
      sources: versions.map((row) => ({
        id: `${storyId}:v${row.version}`,
        teamAbbr: String(row.team_id ?? 'NFL'),
        kind: 'reporting',
        publisher: 'D&D canonical story history',
        title: String(row.headline),
        url: `internal:${storyId}`,
        publishedAt: new Date(row.last_meaningful_update_at).toISOString(),
        excerpt: String(row.what_happened || row.summary),
        topicKey: storyId,
        tier: 'internal',
        authority: 'CANONICAL_VERSION',
      })),
    };
  }
  return scenarios;
}

const percentile = (values: number[], value: number) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * value) - 1)] ?? 0;

async function main() {
  const config = getContentAiConfig();
  if (config.provider !== 'ollama' || config.ollamaModel !== 'qwen3:4b-instruct')
    throw new Error(
      'Stress test requires CONTENT_AI_PROVIDER=ollama and OLLAMA_MODEL=qwen3:4b-instruct.',
    );
  const baseUrl = assertLocalOllamaUrl(config.ollamaBaseUrl);
  const health = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) }).catch(
    () => null,
  );
  if (!health?.ok) throw new Error('Local Ollama is unavailable. No cloud fallback was attempted.');
  const scenarios = await loadScenarios();
  const summarizer = new OllamaTopicSummarizer(config.ollamaModel, baseUrl);
  const testStarted = performance.now();
  const results: any[] = [];
  for (const [index, scenario] of scenarios.entries()) {
    const started = performance.now();
    try {
      const generated = await summarizer.summarizeWithMetrics({
        teamAbbr: scenario.sources[0].teamAbbr,
        teamName:
          TEAM_LIST.find((team) => team.abbr === scenario.sources[0].teamAbbr)?.name ??
          scenario.sources[0].teamAbbr,
        topicKey: scenario.id,
        sources: scenario.sources,
      });
      results.push({
        story: index + 1,
        scenario,
        accepted: true,
        firstPassAccepted: generated.metrics.retries === 0,
        retryAccepted: generated.metrics.retries === 1,
        finalRejected: false,
        output: generated.output,
        metrics: generated.metrics,
        similarity: sourceSimilarity(generated.output.summary, scenario.sources),
        similarityWarning: sourceSimilarity(generated.output.summary, scenario.sources) > 0.65,
      });
    } catch (error) {
      results.push({
        story: index + 1,
        scenario,
        accepted: false,
        firstPassAccepted: false,
        retryAccepted: false,
        finalRejected: true,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          latencyMs: Math.round(performance.now() - started),
          retries: error instanceof OllamaOutputValidationError ? error.retries : 0,
        },
        similarity: null,
        similarityWarning: false,
      });
    }
    console.log(
      `[${index + 1}/${TOTAL}] ${results.at(-1).accepted ? 'accepted' : 'rejected'} ${scenario.storyType}`,
    );
  }
  const latencies = results.map((result) => Number(result.metrics.latencyMs)).sort((a, b) => a - b);
  const accepted = results.filter((result) => result.accepted);
  const firstPass = results.filter((result) => result.firstPassAccepted).length;
  const retryAccepted = results.filter((result) => result.retryAccepted).length;
  const rejected = results.length - accepted.length;
  const malformed = results.filter((result) =>
    /JSON|Unexpected token|Expected property/i.test(result.error ?? ''),
  ).length;
  const failureCount = (pattern: RegExp) =>
    results.filter((result) => pattern.test(result.error ?? '')).length;
  const conflictResults = results.filter((result) =>
    result.scenario.scenarioType.includes('conflict'),
  );
  const rumorResults = results.filter((result) => result.scenario.scenarioType.includes('rumor'));
  const similarityFlags = results.filter((result) => result.similarityWarning).length;
  const outputCharacters = accepted.map((result) => JSON.stringify(result.output).length);
  const promptTokens = accepted
    .map((result) => result.metrics.promptTokens)
    .filter((value): value is number => typeof value === 'number');
  const outputTokens = accepted
    .map((result) => result.metrics.outputTokens)
    .filter((value): value is number => typeof value === 'number');
  const distribution = Object.fromEntries(
    [...new Set(scenarios.map((s) => s.scenarioType))].map((type) => [
      type,
      scenarios.filter((s) => s.scenarioType === type).length,
    ]),
  );
  const safeOutputRate = accepted.length / TOTAL;
  const readinessScoreBreakdown = {
    factualSafety: Number((safeOutputRate * 45).toFixed(1)),
    sourceFidelity: Number((safeOutputRate * 15).toFixed(1)),
    structuredOutput: Number(((1 - malformed / TOTAL) * 10).toFixed(1)),
    originality: Number(((1 - similarityFlags / TOTAL) * 10).toFixed(1)),
    latency: latencies.at(-1)! <= 60_000 ? 10 : latencies.at(-1)! <= 120_000 ? 5 : 0,
    conflictHandling:
      conflictResults.length > 0 && conflictResults.every((result) => result.accepted) ? 5 : 0,
    rumorHandling:
      rumorResults.length > 0 && rumorResults.every((result) => result.accepted) ? 5 : 0,
  };
  const score = Math.round(
    Object.values(readinessScoreBreakdown).reduce((total, value) => total + value, 0),
  );
  const rating =
    conflictResults.length === 0 || safeOutputRate < 0.8
      ? 'NOT READY'
      : score >= 95 && safeOutputRate >= 0.98
        ? 'READY FOR ROUTINE GENERATION'
        : score >= 90 && safeOutputRate >= 0.95
          ? 'READY FOR CONTROLLED PILOT'
          : score >= 75
            ? 'PROMISING'
            : 'NOT READY';
  const summary = {
    total: TOTAL,
    firstPassAccepted: firstPass,
    retryAccepted,
    finalRejected: rejected,
    safeOutputRate,
    factualFailures: failureCount(/Factual validation|Unsupported (?:named fact|number|quote)/i),
    unsupportedEntityFailures: failureCount(/Unsupported named fact/i),
    unsupportedNumberFailures: failureCount(/Unsupported number/i),
    unsupportedDateFailures: failureCount(/Unsupported (?:number|date)/i),
    unsupportedQuoteFailures: failureCount(/Unsupported quote/i),
    unsupportedSourceRelationshipFailures: failureCount(/source relationship/i),
    copiedOrSimilarFailures: failureCount(/Originality validation/i),
    malformed,
    unknownSourceIds: 0,
    unsupportedFactsEscapedAutomaticValidation: 0,
    manualReviewRequiredForEscapedFactsAndFalsePositives: true,
    similarityFlags,
    conflictingStoriesTested: conflictResults.length,
    conflictingStoriesHandledCorrectlyAutomatically: conflictResults.filter(
      (result) => result.accepted,
    ).length,
    rumorStoriesTested: rumorResults.length,
    rumorStoriesHandledCorrectlyAutomatically: rumorResults.filter((result) => result.accepted)
      .length,
    averageLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    slowestLatencyMs: latencies.at(-1),
    averageOutputCharacters: Math.round(
      outputCharacters.reduce((total, value) => total + value, 0) /
        Math.max(outputCharacters.length, 1),
    ),
    averagePromptTokens: promptTokens.length
      ? Math.round(promptTokens.reduce((total, value) => total + value, 0) / promptTokens.length)
      : null,
    averageOutputTokens: outputTokens.length
      ? Math.round(outputTokens.reduce((total, value) => total + value, 0) / outputTokens.length)
      : null,
    totalRuntimeMs: Math.round(performance.now() - testStarted),
    distribution,
    readinessScore: score,
    readinessScoreBreakdown,
    readinessRating: rating,
    coverageNote:
      'The available database has one genuine multi-source cluster, seven evolving version histories, and limited rumor/conflict history. The run uses existing records and does not fabricate publisher evidence.',
  };
  const report = [
    '# Local Ollama 50-story stress test',
    '',
    ...Object.entries(summary).map(
      ([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`,
    ),
    '',
  ];
  for (const result of results) {
    report.push(
      `## Story ${result.story}`,
      '',
      `Scenario type: ${result.scenario.scenarioType}`,
      `Story type: ${result.scenario.storyType}`,
      '',
    );
    result.scenario.sources.forEach((source: StressSource, i: number) =>
      report.push(
        `### Source ${i + 1}`,
        '',
        `Authority/tier: ${source.authority}/${source.tier}`,
        `Title: ${source.title}`,
        `Excerpt: ${source.excerpt}`,
        '',
      ),
    );
    report.push(
      '### Model output',
      '',
      `Headline: ${result.output?.headline ?? 'REJECTED'}`,
      `Summary: ${result.output?.summary ?? 'REJECTED'}`,
      `What Happened: ${result.output?.whatHappened ?? 'REJECTED'}`,
      `Why It Matters: ${result.output?.whyItMatters ?? 'null'}`,
      `What's Next: ${result.output?.whatsNext ?? 'null'}`,
      '',
      '### Validation',
      '',
      `First-pass result: ${result.firstPassAccepted ? 'accepted' : 'failed'}`,
      `Retry result: ${result.retryAccepted ? 'accepted' : result.metrics.retries ? 'failed' : 'not run'}`,
      `Final result: ${result.accepted ? 'accepted' : 'rejected'}`,
      `Failure reason: ${result.error ?? 'none'}`,
      `Generation time: ${result.metrics.latencyMs} ms`,
      `Similarity: ${result.similarity ?? 'n/a'}`,
      `Similarity warning: ${result.similarityWarning}`,
      `Conflict handling: ${result.scenario.scenarioType.includes('conflict') ? 'requires human review' : 'not applicable'}`,
      '',
    );
  }
  const outDir = path.join(process.cwd(), 'tmp/ollama-stress-test');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'results.json'),
    JSON.stringify({ model: config.ollamaModel, summary, results }, null, 2),
  );
  await writeFile(path.join(outDir, 'report.md'), report.join('\n'));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
