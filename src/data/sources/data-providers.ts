import type { SourceDefinition } from './types';

const dataSource = (
  id: string,
  displayName: string,
  trustScore: number,
  url: string,
  notes: string,
): SourceDefinition => ({
  id,
  name: displayName,
  displayName,
  team: null,
  category: 'DATA',
  trustScore,
  breakingNewsScore: 65,
  analysisScore: 85,
  teamRelevanceScore: 100,
  platform: 'WEB',
  url,
  enabled: true,
  priority: trustScore,
  notes,
});

export const DATA_PROVIDER_SOURCES: SourceDefinition[] = [
  dataSource(
    'SPOTRAC',
    'Spotrac',
    90,
    'https://www.spotrac.com/nfl/',
    'Contracts and transactions',
  ),
  dataSource(
    'OVER_THE_CAP',
    'Over the Cap',
    94,
    'https://overthecap.com/',
    'Salary cap, contracts, and dead money',
  ),
  dataSource(
    'PRO_FOOTBALL_REFERENCE',
    'Pro Football Reference',
    95,
    'https://www.pro-football-reference.com/',
    'Historical statistics',
  ),
  dataSource('NFL_DATA', 'NFL', 100, 'https://www.nfl.com/', 'Official league information'),
];
