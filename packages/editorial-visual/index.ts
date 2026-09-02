export const EDITORIAL_VISUAL_TYPES = [
  'PLAYER',
  'INJURY_AVAILABILITY',
  'TRANSACTION',
  'DEVELOPING',
  'DATA',
  'PLAYBOOK',
  'GAME_PREVIEW',
  'GAME_RESULT',
  'DRAFT_FRONT_OFFICE',
  'GENERIC_NEWS',
  'ROSTER_MOVE',
  'TRADE',
  'INJURY_REPORT',
  'ROSTER_WATCH',
  'DEPTH_CHART',
  'BREAKING',
  'QUOTE',
  'STAT',
  'FILM_ROOM',
  'GAME_DAY',
  'FINAL',
  'DRAFT',
  'HEADLINE',
] as const;

export type EditorialVisualType = (typeof EDITORIAL_VISUAL_TYPES)[number];
export type EditorialVisualVariant = 'hero' | 'card' | 'compact';

export type EditorialVisualData = {
  visualType: EditorialVisualType;
  teamId: string;
  eyebrow: string;
  action?: string;
  primaryText: string;
  secondaryText?: string;
  tertiaryText?: string;
  number?: string;
  status?: string;
  opponent?: string;
  opponentTeamId?: string;
  value?: string;
  label?: string;
  attribution?: string;
  items?: Array<{ label: string; detail?: string; movement?: 'UP' | 'DOWN' }>;
  timeline?: Array<{ time: string; label: string }>;
  stats?: Array<{ label: string; value: string }>;
  kickoff?: string;
  venue?: string;
};

export type EditorialStoryInput = {
  teamId?: string | null;
  storyType?: string | null;
  category?: string | null;
  headline?: string | null;
  title?: string | null;
  shortTitle?: string | null;
  summary?: string | null;
  status?: string | null;
  visualType?: EditorialVisualType | null;
  visualTypeOverride?: EditorialVisualType | null;
  visualData?: Partial<EditorialVisualData> | null;
  entities?: string[] | null;
};

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const short = (value: string, limit = 72) =>
  value.length <= limit ? value : `${value.slice(0, limit - 1).trim()}…`;

export function getEditorialVisualForStory(story: EditorialStoryInput): EditorialVisualData {
  const teamId = (story.teamId || 'NFL').toUpperCase();
  const headline = story.shortTitle || story.headline || story.title || 'The latest football story';
  const haystack =
    `${story.storyType || ''} ${story.category || ''} ${story.status || ''} ${headline} ${story.summary || ''}`.toUpperCase();
  let visualType: EditorialVisualType = story.visualTypeOverride || story.visualType || 'HEADLINE';

  if (!story.visualTypeOverride && !story.visualType) {
    const storyType = (story.storyType || story.category || '').toUpperCase();
    if (['TRANSACTION', 'SIGNING', 'RELEASE', 'ROSTER'].includes(storyType))
      visualType = 'TRANSACTION';
    else if (storyType === 'TRADE') visualType = 'TRADE';
    else if (['INJURY', 'PRACTICE', 'SUSPENSION'].includes(storyType))
      visualType = 'INJURY_AVAILABILITY';
    else if (storyType === 'DEPTH_CHART') visualType = 'DEPTH_CHART';
    else if (['DRAFT', 'CONTRACT'].includes(storyType)) visualType = 'DRAFT_FRONT_OFFICE';
    else if (storyType === 'GAME')
      visualType = includesAny(haystack, ['FINAL', 'DEFEATED', 'WINS ', 'LOST '])
        ? 'GAME_RESULT'
        : 'GAME_PREVIEW';
    else if (story.status === 'DEVELOPING') visualType = 'DEVELOPING';
    else if (
      includesAny(haystack, [
        'SIGNED',
        'RELEASED',
        'WAIVED',
        'CLAIMED',
        'ACTIVATED',
        'PROMOTED',
        'PRACTICE SQUAD',
        'TRANSACTION',
      ])
    )
      visualType = 'TRANSACTION';
    else if (
      includesAny(haystack, [
        'INJURY',
        'QUESTIONABLE',
        'DOUBTFUL',
        'LIMITED',
        'DNP',
        'PUP',
        'INJURED RESERVE',
      ])
    )
      visualType = 'INJURY_AVAILABILITY';
    else if (includesAny(haystack, ['TRADE', 'ACQUIRED', 'DEALT TO'])) visualType = 'TRADE';
    else if (includesAny(haystack, ['DEPTH CHART'])) visualType = 'DEPTH_CHART';
    else if (includesAny(haystack, ['POSITION BATTLE', 'ROSTER WATCH', 'COMPETITION', 'STARTER']))
      visualType = 'ROSTER_WATCH';
    else if (story.status === 'BREAKING') visualType = 'BREAKING';
    else if (includesAny(haystack, ['FINAL', 'DEFEATED', 'WINS ', 'LOST ']))
      visualType = 'GAME_RESULT';
    else if (includesAny(haystack, ['GAME DAY', 'MATCHUP', ' VS ', 'KICKOFF']))
      visualType = 'GAME_PREVIEW';
    else if (
      includesAny(haystack, [
        'DRAFT',
        'PICK ',
        'EXTENSION',
        'RESTRUCTURE',
        'FRANCHISE TAG',
        'CONTRACT',
      ])
    )
      visualType = 'DRAFT_FRONT_OFFICE';
    else if (includesAny(haystack, ['FILM', 'SCHEME', 'FORMATION', 'COVERAGE', 'PRESSURE']))
      visualType = 'PLAYBOOK';
    else if (includesAny(haystack, ['STAT', 'PERCENT', ' YARDS', ' YDS', 'SNAPS', 'EPA']))
      visualType = 'DATA';
    else if (story.entities?.length === 1) visualType = 'PLAYER';
    else visualType = 'GENERIC_NEWS';
  }

  const eyebrow: Record<EditorialVisualType, string> = {
    PLAYER: 'PLAYER SPOTLIGHT',
    INJURY_AVAILABILITY: 'INJURY / AVAILABILITY',
    TRANSACTION: 'ROSTER MOVE',
    DEVELOPING: 'DEVELOPING STORY',
    DATA: 'DATA / TREND',
    PLAYBOOK: 'FILM ROOM',
    GAME_PREVIEW: 'GAME PREVIEW',
    GAME_RESULT: 'GAME RESULT',
    DRAFT_FRONT_OFFICE: 'FRONT OFFICE',
    GENERIC_NEWS: 'THE HUDDLE',
    ROSTER_MOVE: 'ROSTER MOVE',
    TRADE: 'TRADE',
    INJURY_REPORT: 'INJURY REPORT',
    ROSTER_WATCH: 'ROSTER WATCH',
    DEPTH_CHART: 'DEPTH CHART',
    BREAKING: 'BREAKING',
    QUOTE: "WHAT THEY'RE SAYING",
    STAT: 'THE NUMBERS',
    FILM_ROOM: 'FILM ROOM',
    GAME_DAY: 'GAME DAY',
    FINAL: 'FINAL',
    DRAFT: 'FRONT OFFICE',
    HEADLINE: 'THE HUDDLE',
  };
  const actionMatch = haystack.match(
    /\b(SIGNED|RELEASED|WAIVED|CLAIMED|ACTIVATED|PROMOTED|TRADED|OUT|QUESTIONABLE|DOUBTFUL|LIMITED|DNP|CLEARED)\b/,
  );
  const numberMatch = haystack.match(/#(\d{1,2})\b/);
  const valueMatch = haystack.match(/\b(\d+(?:\.\d+)?%|\d+\s?(?:YDS|YARDS|SNAPS|TARGETS|TD))\b/);

  return {
    eyebrow: eyebrow[visualType],
    action: actionMatch?.[1],
    primaryText: short(headline),
    secondaryText: story.category || story.storyType || undefined,
    tertiaryText: story.status || undefined,
    number: numberMatch?.[1],
    status: actionMatch?.[1] || story.status || undefined,
    value: valueMatch?.[1],
    ...story.visualData,
    visualType,
    teamId,
  };
}
