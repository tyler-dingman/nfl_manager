import { TEAM_LIST } from '@/data/teams';
import { getGeneratedTeamBriefings } from '@/features/content/generated-briefings';
import type { TeamBriefing } from '@/features/content/types';

import { estimateAudioDuration, generateThreeAndOutAudioScript } from './audio';
import { applyEditorialOverrides } from './editorial-store';
import { calculateImportanceScore, rankThreeAndOutStories } from './ranking';
import type {
  EditorialOverride,
  HistoricalThreeAndOut,
  StoryScoreSignals,
  ThreeAndOutPackage,
  ThreeAndOutSource,
  ThreeAndOutStory,
} from './types';

const TEAM_DEVELOPMENT_SEEDS: Record<string, [string, string, string, string, string]> = {
  KC: [
    'Offensive line combinations remain the central camp question',
    'The receiver rotation is beginning to take shape',
    'The final secondary spots remain unsettled',
    'Which tackle combination gives Kansas City the best Week 1 line?',
    'Special-teams roles could decide the final roster spots',
  ],
  CHI: [
    'The offense is testing its preferred protection plan',
    'Chicago is sorting through a crowded receiver rotation',
    'The defensive front is building its early-down packages',
    'Should Chicago prioritize continuity over upside on the offensive line?',
    'The final coverage-unit jobs remain open',
  ],
  PHI: [
    'Philadelphia is settling the right side of its offensive line',
    'The secondary rotation remains fluid',
    'Young defenders are pushing for sub-package snaps',
    'Should Philadelphia keep a sixth receiver on the initial roster?',
    'Special teams could settle the last receiver decision',
  ],
  DAL: [
    'Dallas is evaluating its new offensive line combinations',
    'The backfield workload remains open',
    'The defense is testing its pressure packages',
    'Should Dallas use a committee in the backfield?',
    'The final defensive-back roles remain unsettled',
  ],
  GB: [
    'Green Bay is narrowing its pass-catcher rotation',
    'The offensive line is testing its most flexible five',
    'Young defenders are competing for pressure-package work',
    'Should Green Bay prioritize experience in the receiver rotation?',
    'Return duties could determine the final skill-position spot',
  ],
};

const defaultSeed = (teamName: string): [string, string, string, string, string] => [
  `${teamName} is sorting out its most important roster competition`,
  'The coaching staff is testing its preferred personnel groups',
  'Special-teams work is shaping the bottom of the roster',
  `Should ${teamName} favor continuity when setting the opening lineup?`,
  'The final roster spots remain connected to game-day versatility',
];

const signals = (rank: number): StoryScoreSignals => ({
  footballImpact: 92 - rank * 8,
  sourceStrength: 76 - rank * 3,
  velocity: 82 - rank * 7,
  freshness: 94 - rank * 4,
  fanInterest: 86 - rank * 6,
  novelty: 78 - rank * 5,
});

const developmentSource = (
  teamId: string,
  storyId: string,
  teamName: string,
  publishedAt: string,
): ThreeAndOutSource => ({
  id: `${storyId}-development-source`,
  storyId,
  sourceName: 'Down & Distance development desk',
  authorName: null,
  sourceType: 'DEVELOPMENT',
  sourceUrl: `/huddle?team=${teamId}`,
  publishedAt,
  isOriginalReporter: false,
  isOfficialSource: false,
});

const briefingSources = (storyId: string, briefing: TeamBriefing): ThreeAndOutSource[] =>
  briefing.sources.map((source, index) => ({
    id: source.id,
    storyId,
    sourceName: source.publisher,
    authorName: null,
    sourceType: source.kind === 'official' ? 'OFFICIAL' : 'REPORTING',
    sourceUrl: source.url,
    publishedAt: source.publishedAt,
    isOriginalReporter: index === 0,
    isOfficialSource: source.kind === 'official',
  }));

const makeStory = ({
  teamId,
  teamName,
  rank,
  title,
  now,
  briefing,
}: {
  teamId: string;
  teamName: string;
  rank: number;
  title: string;
  now: string;
  briefing?: TeamBriefing;
}): ThreeAndOutStory => {
  const id = briefing?.id ?? `${teamId.toLowerCase()}-development-${rank}`;
  const storySignals = signals(rank);
  const sources = briefing
    ? briefingSources(id, briefing)
    : [developmentSource(teamId, id, teamName, now)];
  return {
    id,
    teamId,
    title: briefing?.headline ?? title,
    shortTitle: briefing?.headline ?? title,
    summary:
      briefing?.summary ??
      `This is realistic development content for testing the ${teamName} briefing experience. It is not presented as current reporting.`,
    whyItMatters:
      briefing?.whyItMatters ??
      'The decision can affect early personnel usage, game-day flexibility, and which players earn meaningful snaps.',
    whatsNext:
      'Watch the next team availability, practice report, roster move, or game for a material update.',
    status: rank === 1 && briefing ? 'DEVELOPING' : rank === 2 ? 'MOVING_UP' : 'HOLDING',
    importanceScore: calculateImportanceScore(storySignals),
    scoreSignals: storySignals,
    previousRank: rank === 2 ? 4 : rank === 3 ? 2 : rank,
    currentRank: rank,
    createdAt: briefing?.updatedAt ?? now,
    updatedAt: briefing?.updatedAt ?? now,
    firstPublishedAt: briefing?.updatedAt ?? now,
    lastMaterialUpdateAt: briefing?.updatedAt ?? now,
    sourceCount: sources.length,
    sources,
    newSinceLastVisit:
      rank === 1 ? 'This story has received a material update since your previous visit.' : null,
    videoStatus: 'NONE',
    audioStatus: 'READY',
  };
};

export function getThreeAndOutPackage(
  teamId: string,
  editorialOverrides: EditorialOverride[] = [],
): ThreeAndOutPackage {
  const normalized = teamId.toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === normalized) ?? TEAM_LIST[0];
  const now = new Date().toISOString();
  const seed = TEAM_DEVELOPMENT_SEEDS[team.abbr] ?? defaultSeed(team.name);
  const briefing = getGeneratedTeamBriefings(team.abbr)[0];
  const candidates = [
    makeStory({ teamId: team.abbr, teamName: team.name, rank: 1, title: seed[0], now, briefing }),
    makeStory({ teamId: team.abbr, teamName: team.name, rank: 2, title: seed[1], now }),
    makeStory({ teamId: team.abbr, teamName: team.name, rank: 3, title: seed[2], now }),
    makeStory({ teamId: team.abbr, teamName: team.name, rank: 4, title: seed[4], now }),
    makeStory({
      teamId: team.abbr,
      teamName: team.name,
      rank: 5,
      title: 'The next transaction window could reshape the final roster',
      now,
    }),
  ];
  const ranked = rankThreeAndOutStories(applyEditorialOverrides(candidates, editorialOverrides));
  const stories = ranked.slice(0, 3) as ThreeAndOutPackage['current']['stories'];
  const generatedAt = briefing?.updatedAt ?? now;
  const snapshotId = `${team.abbr.toLowerCase()}-${generatedAt.replace(/\D/g, '').slice(0, 12)}`;
  const current: ThreeAndOutPackage['current'] = {
    id: snapshotId,
    teamId: team.abbr,
    teamName: team.name,
    generatedAt,
    storyIds: stories.map((story) => story.id) as [string, string, string],
    stories,
    puntStories: ranked.slice(3),
    fourthDown: {
      id: `${team.abbr.toLowerCase()}-fourth-down`,
      teamId: team.abbr,
      question: seed[3],
      options: [
        { id: 'go-for-it', label: 'Go for it', votes: 72 },
        { id: 'punt', label: 'Punt', votes: 28 },
      ],
      associatedStoryIds: [stories[0].id, stories[1].id],
    },
    audioStatus: 'READY',
    audioUrl: null,
    audioDuration: null,
    audioGeneratedAt: generatedAt,
    audioScriptVersion: snapshotId,
    videoStatus: 'NONE',
    videoUrl: null,
    videoThumbnail: null,
    videoDuration: null,
    videoGeneratedAt: null,
    videoSnapshotId: snapshotId,
  };
  const script = generateThreeAndOutAudioScript(current);
  current.audioDuration = estimateAudioDuration(script);
  const historyTimes = [2, 8].map((hours) =>
    new Date(new Date(generatedAt).getTime() - hours * 3_600_000).toISOString(),
  );
  const previous: HistoricalThreeAndOut[] = historyTimes.map((time, index) => ({
    id: `${snapshotId}-previous-${index + 1}`,
    teamId: team.abbr,
    teamName: team.name,
    generatedAt: time,
    storyIds: [stories[0].id, stories[index === 0 ? 2 : 1].id, ranked[3].id],
    storyTitles: [stories[0].title, stories[index === 0 ? 2 : 1].title, ranked[3].title],
  }));
  return { current, previous };
}
