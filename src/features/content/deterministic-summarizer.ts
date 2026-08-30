import type { TopicSummarizer } from './types';

const topicCopy: Record<
  string,
  { category: string; headline: (team: string) => string; whyItMatters: string }
> = {
  'diego-pounds-trade': {
    category: 'Breaking trade',
    headline: () => 'Chiefs add another tackle as the offensive-line picture shifts again',
    whyItMatters:
      'Pounds gives Kansas City another young tackle option at the exact moment the club is setting its initial roster and evaluating protection depth for the regular season.',
  },
  'preseason-finale': {
    category: 'Top story',
    headline: () => 'The preseason is over. Now Kansas City’s hardest roster decisions begin.',
    whyItMatters:
      'The tie itself does not affect the season, but the final game tape could decide the last several roster spots before Kansas City turns fully toward Week 1.',
  },
  'position-battle': {
    category: 'Top story',
    headline: (team) => `${team}’s biggest position battle may be taking shape`,
    whyItMatters:
      'The winner could change both the starting lineup and how the unit is structured.',
  },
  'roster-move': {
    category: 'Roster watch',
    headline: (team) => `${team} make a roster move with depth-chart implications`,
    whyItMatters:
      'The move adds competition and insurance at a position with short-term uncertainty.',
  },
  'injury-watch': {
    category: 'Injury watch',
    headline: (team) => `${team} receive an encouraging injury update`,
    whyItMatters: 'A healthy return would stabilize a key part of the projected starting lineup.',
  },
};

export class DeterministicTopicSummarizer implements TopicSummarizer {
  async summarize({ teamName, topicKey, sources }: Parameters<TopicSummarizer['summarize']>[0]) {
    const copy = topicCopy[topicKey] ?? {
      category: 'Team update',
      headline: (team: string) => `What is happening with ${team} right now`,
      whyItMatters: 'This is one of the most relevant developments around the team today.',
    };
    const summary = sources
      .slice(0, 3)
      .map((source) => source.excerpt)
      .join(' ');

    return {
      category: copy.category,
      headline: copy.headline(teamName),
      summary,
      whyItMatters: copy.whyItMatters,
      sourceIds: sources.map((source) => source.id),
    };
  }
}
