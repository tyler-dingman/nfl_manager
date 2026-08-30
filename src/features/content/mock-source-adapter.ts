import type { ContentSource, ContentSourceAdapter } from './types';

const now = () => new Date().toISOString();

export class MockContentSourceAdapter implements ContentSourceAdapter {
  async collect(teamAbbr: string, teamName: string): Promise<ContentSource[]> {
    const teamSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return [
      {
        id: `${teamAbbr}-official-practice`,
        teamAbbr,
        kind: 'official',
        publisher: teamName,
        title: `${teamName} publish the latest practice update`,
        url: `https://www.nfl.com/teams/${teamSlug}/`,
        publishedAt: now(),
        excerpt:
          'The team reported another competitive practice with the first unit rotating players at a key position.',
        topicKey: 'position-battle',
      },
      {
        id: `${teamAbbr}-local-position-report`,
        teamAbbr,
        kind: 'reporting',
        publisher: 'Local team coverage',
        title: 'First-team repetitions offer a clue in an important position battle',
        url: 'https://www.nfl.com/news/',
        publishedAt: now(),
        excerpt:
          'Multiple practice observers noted that one player received the majority of first-team work for a third consecutive session.',
        topicKey: 'position-battle',
      },
      {
        id: `${teamAbbr}-press-conference`,
        teamAbbr,
        kind: 'video',
        publisher: 'NFL YouTube',
        title: 'Coach discusses competition and the upcoming evaluation plan',
        url: 'https://www.youtube.com/@NFL',
        publishedAt: now(),
        excerpt:
          'The coach said the competition remains open but emphasized consistency, communication, and recent progress.',
        topicKey: 'position-battle',
      },
      {
        id: `${teamAbbr}-transaction`,
        teamAbbr,
        kind: 'official',
        publisher: 'NFL Transactions',
        title: `${teamName} adjust the roster ahead of the next practice`,
        url: 'https://www.nfl.com/transactions/league/signings/',
        publishedAt: now(),
        excerpt:
          'The club added depth at a position carrying short-term injury uncertainty and released a player at another spot.',
        topicKey: 'roster-move',
      },
      {
        id: `${teamAbbr}-roster-analysis`,
        teamAbbr,
        kind: 'reporting',
        publisher: 'League analysis',
        title: 'What the latest roster move means for the depth chart',
        url: 'https://www.nfl.com/news/',
        publishedAt: now(),
        excerpt:
          'The move creates added competition for a reserve role without materially changing the projected starting lineup.',
        topicKey: 'roster-move',
      },
      {
        id: `${teamAbbr}-injury-update`,
        teamAbbr,
        kind: 'official',
        publisher: teamName,
        title: 'Injury update brings encouraging news for the starting lineup',
        url: `https://www.nfl.com/teams/${teamSlug}/`,
        publishedAt: now(),
        excerpt:
          'A starter returned to limited work and remains on track in the team’s gradual return-to-play plan.',
        topicKey: 'injury-watch',
      },
      {
        id: `${teamAbbr}-injury-context`,
        teamAbbr,
        kind: 'reporting',
        publisher: 'National football desk',
        title: 'The timeline and depth-chart impact of the latest injury news',
        url: 'https://www.nfl.com/injuries/',
        publishedAt: now(),
        excerpt:
          'The current timeline is encouraging, although the team still has several evaluation steps before full clearance.',
        topicKey: 'injury-watch',
      },
    ];
  }
}
