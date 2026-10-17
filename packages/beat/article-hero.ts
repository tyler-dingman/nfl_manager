import {
  adaptBeatStory,
  type BeatGraphicDecision,
  type BeatStoryInput,
} from '../../src/components/beat/beat-story-adapter';
import {
  standardVariant,
  validBeatGraphic,
  type BeatGraphicData,
} from '../../src/components/beat/beat-model';
import manifest from '../../public/assets/the-beat-asset-library/manifest.json';

export type ArticleHeroStory = Omit<BeatStoryInput, 'sources'> & {
  graphicDecision?: BeatGraphicDecision;
  publishedAt?: string;
  sourceCount: number;
  sources?: { url: string; publishedAt?: string }[];
};

/** Cards and detail pages must honor the same persisted artwork decision. */
export function resolveBeatArtwork(
  story: BeatStoryInput & { graphicDecision?: BeatGraphicDecision },
) {
  const decision = story.graphicDecision ?? adaptBeatStory(story);
  return {
    ...decision,
    graphic: validBeatGraphic(decision.graphic)
      ? decision.graphic
      : { family: standardVariant(story.id) },
  } satisfies BeatGraphicDecision;
}

export function beatRecipeFamily(family: BeatGraphicData['family']) {
  switch (family) {
    case 'off_field':
    case 'mailbag':
      return 'business-community';
    case 'analysis':
    case 'depth-chart':
    case 'interview':
    case 'team-update':
      return 'league';
    case 'practice':
      return 'standard-c';
    case 'roster-roundup':
      return 'transaction';
    case 'recap':
      return 'game-matchup';
    default:
      return family;
  }
}
export function beatLayerOpacity(id: string, fallback: number) {
  return (
    (
      {
        'dark-grain-texture': 0.12,
        'etched-schematic-texture': 0.045,
        'diagonal-shadow-bands': 0.015,
        'diagonal-accent-stripes': 0.38,
      } as Record<string, number>
    )[id] ?? fallback
  );
}
export function articleDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  // Explicit UTC avoids runtime locale differences during hydration.
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
export function articlePublishedAt(story: ArticleHeroStory) {
  return (
    story.publishedAt ??
    story.sources
      ?.map((s) => s.publishedAt)
      .filter((s): s is string => !!s && Number.isFinite(Date.parse(s)))
      .sort()[0]
  );
}
export function articleAge(updatedAt: string | undefined, now: number) {
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return '';
  const minutes = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60000));
  return minutes < 1
    ? 'NOW'
    : minutes < 60
      ? `${minutes}M`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}H`
        : `${Math.floor(minutes / 1440)}D`;
}
export const articleHeroDesign = { minHeight: 216, mobileMinHeight: 248 } as const;

/** Native rendering adapter uses the existing recipe layers and factual card fields. */
export function beatArtworkMotif(data: BeatGraphicData, category: string, team: string) {
  const editorial = category.toUpperCase() === 'EDITORIAL' || data.family === 'analysis';
  const layers = [
    ...manifest.sharedLayers,
    ...(editorial
      ? ['diagonal-accent-stripes']
      : manifest.recipes[beatRecipeFamily(data.family)].layers),
  ];
  let primary = editorial ? 'EDITORIAL.' : category.toUpperCase();
  let secondary = team;
  let detail = '';
  let outline = false;
  let teams: string[] = [];
  switch (data.family) {
    case 'player':
      primary = data.position ?? team;
      secondary = data.name;
      detail = team;
      outline = true;
      break;
    case 'injury':
      primary = data.period ?? '+';
      secondary = 'INJURY REPORT';
      detail = data.detail ?? data.rows.map((r) => `${r.count} ${r.status}`).join(' · ');
      break;
    case 'game-matchup':
      primary = 'VS';
      teams = [data.leftTeam, data.rightTeam];
      secondary = data.week ?? '';
      detail = data.kickoff ?? '';
      break;
    case 'game-result':
      primary = `${data.leftScore} – ${data.rightScore}`;
      teams = [data.leftTeam, data.rightTeam];
      secondary = data.final;
      break;
    case 'transaction':
      primary = data.action.replaceAll('_', ' ');
      secondary = data.players?.map((p) => p.name).join(' · ') ?? data.name;
      detail = [data.position, data.team].filter(Boolean).join(' · ');
      break;
    case 'roster-roundup':
      primary = 'ROSTER';
      secondary = 'MOVES';
      break;
    case 'numbered':
      primary = data.count;
      secondary = data.descriptor;
      break;
    case 'stats':
      primary = data.count ?? 'STATS';
      secondary = data.descriptor;
      break;
    case 'recap':
      primary = 'RECAP';
      teams = data.teams;
      break;
    case 'quote':
      primary = '“';
      secondary = data.attribution;
      break;
    case 'interview':
      primary = data.transcript ? 'TRANSCRIPT' : 'INTERVIEW';
      secondary = data.name ?? team;
      break;
    case 'team-update':
    case 'off_field':
    case 'business-community':
      primary = data.label;
      break;
    case 'depth-chart':
      primary = 'DEPTH CHART';
      break;
    case 'mailbag':
      primary = 'MAILBAG';
      break;
    case 'practice':
      primary = 'PRACTICE';
      break;
    case 'film':
      primary = 'FILM ROOM';
      break;
    case 'coaching':
      primary = data.label ?? 'GAME PLAN';
      break;
    case 'scouting':
      primary = 'KNOW YOUR FOE';
      teams = data.opponent ? [data.opponent] : [];
      break;
    case 'video':
      primary = data.title;
      break;
    case 'developing':
      primary = 'DEVELOPING';
      break;
  }
  return { layers, primary, secondary, detail, outline, teams };
}
