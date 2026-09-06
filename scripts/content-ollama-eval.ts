import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertLocalOllamaUrl, getContentAiConfig } from '../src/features/content/ai-provider';
import { OllamaTopicSummarizer } from '../src/features/content/ollama-summarizer';
import { loadOllamaEvaluationItems } from '../src/features/content/ollama-evaluation-fixtures';

loadEnvConfig(process.cwd());
async function runOllamaEvaluation() {
  const config = getContentAiConfig();
  if (config.provider !== 'ollama')
    throw new Error('Set CONTENT_AI_PROVIDER=ollama to run the local evaluator.');
  const baseUrl = assertLocalOllamaUrl(config.ollamaBaseUrl);
  try {
    const health = await fetch(`${baseUrl}/api/tags`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (error) {
    throw new Error(
      `Local Ollama is unavailable at ${baseUrl}. Evaluation stopped; no cloud provider was called.`,
      { cause: error },
    );
  }
  const summarizer = new OllamaTopicSummarizer(config.ollamaModel, baseUrl);
  const fixtures = await loadOllamaEvaluationItems();
  const results = [];
  for (const fixture of fixtures) {
    try {
      const generated = await summarizer.summarizeWithMetrics({
        teamAbbr: fixture.teamAbbr,
        teamName: fixture.teamName,
        topicKey: fixture.topicKey,
        sources: [fixture.source],
      });
      results.push({
        fixture,
        ok: true,
        jsonValid: true,
        sourceIdsValid: true,
        unsupportedContentDetected: false,
        ...generated,
      });
    } catch (error) {
      results.push({
        fixture,
        ok: false,
        jsonValid: !(error instanceof SyntaxError),
        sourceIdsValid: !String(error).includes('source ID'),
        unsupportedContentDetected: String(error).includes('Unsupported'),
        error: error instanceof Error ? error.message : String(error),
        metrics: { retries: 0 },
      });
    }
  }
  const outDir = path.join(process.cwd(), 'tmp/ollama-eval');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'results.json'),
    JSON.stringify({ model: config.ollamaModel, itemCount: results.length, results }, null, 2),
  );
  const report = [
    `# Local Ollama content evaluation`,
    ``,
    `Model: ${config.ollamaModel}`,
    `Items: ${results.length}`,
    `Failures: ${results.filter((r) => !r.ok).length}`,
    ``,
  ];
  results.forEach((result, index) => {
    const output = 'output' in result ? result.output : null;
    report.push(
      `## ${index + 1}. ${result.fixture.source.title}`,
      ``,
      `SOURCE EXCERPT`,
      ``,
      result.fixture.source.excerpt,
      ``,
      `LOCAL MODEL OUTPUT`,
      ``,
      `- Headline: ${output?.headline ?? 'FAILED'}`,
      `- Summary: ${output?.summary ?? 'FAILED'}`,
      `- What happened: ${output?.whatHappened ?? 'FAILED'}`,
      `- Why it matters: ${output?.whyItMatters ?? 'null'}`,
      `- What's next: ${output?.whatsNext ?? 'null'}`,
      ``,
      `VALIDATION`,
      ``,
      `- JSON valid: ${result.jsonValid}`,
      `- All source IDs valid: ${result.sourceIdsValid}`,
      `- Unsupported names/facts detected: ${result.unsupportedContentDetected}`,
      `- Generation time: ${'latencyMs' in result.metrics ? result.metrics.latencyMs : 'n/a'} ms`,
      `- Prompt/output tokens: ${'promptTokens' in result.metrics ? `${result.metrics.promptTokens ?? 'n/a'} / ${result.metrics.outputTokens ?? 'n/a'}` : 'n/a'}`,
      `- Output characters: ${output ? JSON.stringify(output).length : 0}`,
      `- Retries: ${result.metrics.retries}`,
      result.ok ? '' : `- Failure: ${result.error}`,
      ``,
    );
  });
  await writeFile(path.join(outDir, 'report.md'), report.join('\n'));
  console.log(`Saved ${results.length} local-only evaluations to ${outDir}`);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

runOllamaEvaluation().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
