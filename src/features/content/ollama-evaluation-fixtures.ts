import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContentSource, TeamBriefing } from './types';

export const OLLAMA_EVALUATION_SIZE = 20;

export async function loadOllamaEvaluationItems(
  file = path.join(process.cwd(), 'src/server/data-cache/team-briefings.json'),
) {
  const cache = JSON.parse(await readFile(file, 'utf8')) as Record<string, TeamBriefing[]>;
  const items: Array<{
    teamAbbr: string;
    teamName: string;
    topicKey: string;
    source: ContentSource;
  }> = [];
  for (const teamAbbr of Object.keys(cache).sort()) {
    for (const briefing of cache[teamAbbr] ?? []) {
      for (const source of briefing.sources ?? []) {
        items.push({
          teamAbbr,
          teamName: teamAbbr,
          topicKey: briefing.id,
          source: { ...source, teamAbbr, excerpt: briefing.summary, topicKey: briefing.id },
        });
        if (items.length === OLLAMA_EVALUATION_SIZE) return items;
      }
    }
  }
  throw new Error(
    `Evaluation fixture requires exactly ${OLLAMA_EVALUATION_SIZE} existing source items; found ${items.length}.`,
  );
}
