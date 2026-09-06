import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

import { TEAM_LIST } from '@/data/teams';
import { OllamaTopicSummarizer } from '@/features/content/ollama-summarizer';
import type { ContentSource, TeamBriefing } from '@/features/content/types';
import { getContentAiConfig } from '@/features/content/ai-provider';

loadEnvConfig(process.cwd());

const TEAM_HOSTS: Record<string, string> = {
  ARI: 'azcardinals.com',
  ATL: 'atlantafalcons.com',
  BAL: 'baltimoreravens.com',
  BUF: 'buffalobills.com',
  CAR: 'panthers.com',
  CHI: 'chicagobears.com',
  CIN: 'bengals.com',
  CLE: 'clevelandbrowns.com',
  DAL: 'dallascowboys.com',
  DEN: 'denverbroncos.com',
  DET: 'detroitlions.com',
  GB: 'packers.com',
  HOU: 'houstontexans.com',
  IND: 'colts.com',
  JAX: 'jaguars.com',
  KC: 'chiefs.com',
  LV: 'raiders.com',
  LAC: 'chargers.com',
  LAR: 'therams.com',
  MIA: 'miamidolphins.com',
  MIN: 'vikings.com',
  NE: 'patriots.com',
  NO: 'neworleanssaints.com',
  NYG: 'giants.com',
  NYJ: 'newyorkjets.com',
  PHI: 'philadelphiaeagles.com',
  PIT: 'steelers.com',
  SEA: 'seahawks.com',
  SF: '49ers.com',
  TB: 'buccaneers.com',
  TEN: 'tennesseetitans.com',
  WAS: 'commanders.com',
};

type FeedItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
};

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const tagValue = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1] ?? '');
};

const attributeValue = (item: string, tag: string, attribute: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]+)"`, 'i'));
  return decodeXml(match?.[1] ?? '');
};

const parseFeed = (xml: string): FeedItem[] =>
  [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1] ?? '';
      const published = new Date(tagValue(item, 'pubDate'));
      return {
        title: tagValue(item, 'title'),
        description: tagValue(item, 'description'),
        url: tagValue(item, 'link'),
        publishedAt: Number.isNaN(published.getTime())
          ? new Date().toISOString()
          : published.toISOString(),
        imageUrl:
          attributeValue(item, 'media:content', 'url') ||
          attributeValue(item, 'enclosure', 'url') ||
          null,
      };
    })
    .filter((item) => item.title && item.url);

const lowValuePatterns = [
  /how to watch/i,
  /how to listen/i,
  /tickets?/i,
  /photo(s| gallery)?\b/i,
  /podcast/i,
  /wallpaper/i,
  /cheerleader/i,
  /community spotlight/i,
  /en espa[nñ]ol/i,
  /¿|cómo|cuándo|dónde/i,
];

const newsValuePatterns = [
  /trade|acquire/i,
  /sign|waive|release|roster|cut/i,
  /injur|return|practice/i,
  /depth chart|starter|position/i,
  /recap|takeaway|observations?/i,
  /draft|contract|extension/i,
];

const selectTopArticles = (items: FeedItem[], limit: number) => {
  const now = Date.now();
  const seen = new Set<string>();
  return [...items]
    .slice(0, 30)
    .filter((item) => {
      const key = `${item.url}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => {
      const ageHours = Math.max(0, (now - new Date(item.publishedAt).getTime()) / 3_600_000);
      const lowValue = lowValuePatterns.some((pattern) => pattern.test(item.title));
      const newsValue = newsValuePatterns.some(
        (pattern) => pattern.test(item.title) || pattern.test(item.description),
      );
      return {
        item,
        score: 100 - index * 4 - ageHours / 12 + (newsValue ? 28 : 0) - (lowValue ? 80 : 0),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ item }) => item);
};

const summarizer = new OllamaTopicSummarizer();

const categoryFor = (article: FeedItem) => {
  const text = `${article.title} ${article.description}`;
  if (/trade|acquire/i.test(text)) return 'Breaking trade';
  if (/injur|return to practice/i.test(text)) return 'Injury watch';
  if (/sign|waive|release|roster|cut/i.test(text)) return 'Roster watch';
  if (/preseason|game|recap|takeaway|observations?/i.test(text)) return 'Game recap';
  if (/draft/i.test(text)) return 'Draft';
  return 'Team update';
};

const syncTeam = async (team: (typeof TEAM_LIST)[number], limit: number) => {
  const host = TEAM_HOSTS[team.abbr];
  if (!host) throw new Error(`No official news host configured for ${team.abbr}`);
  const feedUrl = `https://www.${host}/rss/news`;
  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Down-Distance-Local-Content-Test/1.0' },
  });
  if (!response.ok) throw new Error(`${team.abbr} RSS failed: ${response.status}`);
  const articles = selectTopArticles(parseFeed(await response.text()), limit);
  if (!articles.length) throw new Error(`${team.abbr} RSS contained no usable articles`);
  const model = getContentAiConfig().ollamaModel;
  const useExtractiveSafety = model.includes('0.6b');
  const briefings: TeamBriefing[] = [];
  for (const [index, article] of articles.entries()) {
    const articleKey = createHash('sha256').update(article.url).digest('hex').slice(0, 16);
    const topicKey = `official-story-${articleKey}`;
    const source: ContentSource = {
      id: `${team.abbr.toLowerCase()}-official-${articleKey}`,
      teamAbbr: team.abbr,
      kind: 'official',
      publisher: team.name,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      excerpt: article.description || article.title,
      imageUrl: article.imageUrl,
      topicKey,
      importance: Math.max(60, 90 - index * 6),
    };
    const generated = await summarizer.summarize({
      teamAbbr: team.abbr,
      teamName: team.name,
      topicKey,
      sources: [source],
    });
    briefings.push({
      id: `${team.abbr.toLowerCase()}-${topicKey}`,
      teamAbbr: team.abbr,
      ...generated,
      category: categoryFor(article),
      headline: useExtractiveSafety ? article.title : generated.headline,
      summary: useExtractiveSafety ? article.description || article.title : generated.summary,
      whyItMatters: useExtractiveSafety ? null : generated.whyItMatters,
      imageUrl: article.imageUrl,
      updatedAt: article.publishedAt,
      sourceCount: 1,
      sources: [
        {
          id: source.id,
          kind: source.kind,
          publisher: source.publisher,
          title: source.title,
          url: source.url,
          publishedAt: source.publishedAt,
        },
      ],
    });
  }
  return briefings;
};

const main = async () => {
  const requestedTeam = process.argv
    .find((argument) => argument.startsWith('--team='))
    ?.split('=')[1]
    ?.toUpperCase();
  const requestedLimit = Number(
    process.argv.find((argument) => argument.startsWith('--limit='))?.split('=')[1] ?? '1',
  );
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 1;
  const outputPath = path.join(process.cwd(), 'src/server/data-cache/team-briefings.json');
  const existing = JSON.parse(await readFile(outputPath, 'utf8')) as Record<string, TeamBriefing[]>;
  const output: Record<string, TeamBriefing[]> = requestedTeam ? existing : {};
  const failures: string[] = [];
  const teams = requestedTeam ? TEAM_LIST.filter((team) => team.abbr === requestedTeam) : TEAM_LIST;
  if (!teams.length) throw new Error(`Unknown team: ${requestedTeam}`);

  for (const [index, team] of teams.entries()) {
    process.stdout.write(`[${index + 1}/${teams.length}] ${team.abbr} ${team.name} ... `);
    try {
      const briefings = await syncTeam(team, limit);
      output[team.abbr] = briefings;
      console.log(
        `${briefings.length} briefings: ${briefings.map((item) => item.headline).join(' | ')}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${team.abbr}: ${message}`);
      console.log(`FAILED: ${message}`);
    }
  }

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nSaved ${Object.keys(output).length} team briefings to ${outputPath}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
};

void main();
