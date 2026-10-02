import type { FrontOfficeEvent } from '../types/front-office';

// Legacy results may lack a category. Keep this pattern compatible with PostgreSQL ~*.
export const GAME_RESULT_HEADLINE_PATTERN =
  "^[A-Za-z0-9 .'-]+ (beats?|defeats?|edges?|routs?|tops?) [A-Za-z0-9 .'-]+( [0-9]+[-–][0-9]+)?[.!]?$|^[A-Za-z0-9 .'-]+ and [A-Za-z0-9 .'-]+ finish tied[.!]?$";
const resultHeadline = new RegExp(GAME_RESULT_HEADLINE_PATTERN, 'i');

export function isFrontOfficeNewsNotification(
  event: Pick<FrontOfficeEvent, 'id' | 'type' | 'headline' | 'metadata'>,
) {
  const category = String(event.metadata.newsCategory ?? '').toUpperCase();
  return (
    event.type !== 'welcome_message' &&
    String(event.metadata.channel ?? '').toUpperCase() !== 'MESSAGE' &&
    !['GAME_RECAP', 'GAME_RESULT', 'GAME'].includes(category) &&
    !event.id.includes(':game-result:') &&
    !(event.metadata.homeScore != null && event.metadata.awayScore != null) &&
    !resultHeadline.test(event.headline)
  );
}
