import type { FrontOfficeEvent } from '../types/front-office';
import { isFrontOfficeNewsNotification } from './front-office-news-notifications';
export type NewsPreferences = {
  myTeam: boolean;
  league: boolean;
  injuries: boolean;
  game: boolean;
  frequency: 'normal' | 'important' | 'minimal';
};
export const defaultNewsPreferences: NewsPreferences = {
  myTeam: true,
  league: true,
  injuries: true,
  game: false,
  frequency: 'normal',
};
export const newsCategory = (e: FrontOfficeEvent) =>
  String(
    e.metadata.newsCategory ?? (e.type === 'trade_rumor' ? 'RUMOR' : 'ROSTER MOVE'),
  ).toUpperCase();
export const newsPersona = (e: FrontOfficeEvent) => {
  const category = newsCategory(e);
  if (category.includes('RUMOR')) return 'LEAGUE BUZZ';
  if (category.includes('DRAFT')) return 'DRAFT DESK';
  if (['TRADE', 'TRANSACTION', 'CONTRACT', 'SIGNING', 'ROSTER MOVE'].includes(category))
    return 'FRONT OFFICE WIRE';
  return 'D&D NEWS';
};
export function eligibleNewsToasts(events: FrontOfficeEvent[], team: string, p: NewsPreferences) {
  return events.filter((e) => {
    if (!isFrontOfficeNewsNotification(e)) return false;
    const own = e.teamAbbr === team || e.relatedTeamAbbr === team;
    const category = newsCategory(e);
    if (['GAME_RECAP', 'GAME'].includes(category) && !p.game) return false;
    if (['INJURY', 'RETURN'].includes(category) && !p.injuries) return false;
    if (own ? !p.myTeam : !p.league) return false;
    if (p.frequency === 'minimal')
      return own && (e.priority === 'urgent' || e.metadata.isBreaking === true);
    if (p.frequency === 'important')
      return e.priority === 'urgent' || (own && e.priority === 'high');
    return e.priority !== 'low';
  });
}
export function newsBatchSummary(events: FrontOfficeEvent[]) {
  const groups = new Map<string, number>();
  events.forEach((e) => {
    const c = newsCategory(e).toLowerCase();
    groups.set(c, (groups.get(c) ?? 0) + 1);
  });
  return [...groups].map(([c, n]) => `${n} ${c}${n === 1 ? '' : ' updates'}`).join(' · ');
}
