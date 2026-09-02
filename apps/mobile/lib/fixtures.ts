import type { HomeData, Story } from './types';
const source = {
  id: 'fixture',
  sourceName: 'Chiefs Communications',
  sourceUrl: 'https://www.chiefs.com',
  isOfficialSource: true,
};
export const stories: Story[] = [
  [
    'trade',
    'Chiefs add veteran help up front',
    'Kansas City completed a move to reinforce the offensive line.',
    'The move adds another experienced option before the opener.',
  ],
  [
    'practice',
    'A key receiver returns to full practice',
    'The latest designation is an encouraging change from the previous session.',
    'Availability changes how the offense can structure its opening plan.',
  ],
  [
    'roster',
    'The final roster competition is taking shape',
    'Special-teams work is separating the last group of roster candidates.',
    'Game-day versatility could decide the final spot.',
  ],
].map((x, i) => ({
  id: x[0],
  title: x[1],
  summary: x[2],
  whyItMatters: x[3],
  whatsNext: 'Watch the next official practice report or roster announcement.',
  status: i === 0 ? 'BREAKING' : 'DEVELOPING',
  importanceScore: 95 - i * 6,
  sources: [source],
  lastMaterialUpdateAt: new Date(Date.now() - i * 3600000).toISOString(),
}));
export const fixtureHome: HomeData = {
  teamId: 'KC',
  threeAndOut: { current: { teamId: 'KC', teamName: 'Kansas City Chiefs', stories } },
  huddle: [
    'Protection plan gets another look',
    'Young defenders earn more first-team work',
    'Coaches clarify the return-role competition',
    'The numbers behind the new roster move',
  ].map((headline, i) => ({
    id: `huddle-${i}`,
    headline,
    summary: 'A concise, sourced overview of what Chiefs fans should know right now.',
    whyItMatters: 'This development may affect early-season roles and roster decisions.',
    category: ['AROUND THE TEAM', 'PRACTICE', 'WHAT THEY’RE SAYING', 'FILM / NUMBERS'][i],
    updatedAt: new Date(Date.now() - (i + 2) * 3600000).toISOString(),
    sources: [{ id: 'fixture', publisher: 'D&D fixture', url: 'https://www.chiefs.com' }],
  })),
  wire: stories.map((s, i) => ({
    id: `wire-${s.id}`,
    storyId: s.id,
    type: i === 0 ? 'BREAKING' : 'UPDATE',
    headline: s.title,
    summary: s.summary,
    occurredAt: s.lastMaterialUpdateAt,
    primarySource: { name: 'Chiefs Communications', url: 'https://www.chiefs.com' },
  })),
};
