import { TEAM_LIST } from '../data/teams';

export { TEAM_HERO_COPY, getTeamHeroCopy } from '../../packages/design/team-hero-copy';

export function getTeamHeroDescription(teamAbbr?: string | null): string {
  const city = TEAM_LIST.find((team) => team.abbr === teamAbbr?.toUpperCase())?.city;
  return `Your home for everything ${city ? `${city} ` : ''}football — the latest news, analysis, roster moves, and fan conversation. Run the team, test your knowledge, and research your next parlay.`;
}
