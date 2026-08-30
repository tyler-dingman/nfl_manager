export type FalcoAlertType =
  | 'FREE_FALL'
  | 'POSITION_RUN'
  | 'VALUE_STEAL'
  | 'RISKY_REACH'
  | 'CAP_CRISIS'
  | 'BIG_SIGNING'
  | 'BIG_TRADE';

export const quotesByType: Record<FalcoAlertType, string[]> = {
  FREE_FALL: [
    "He's slipping.",
    "Something's spooked teams. Could be noise. Could be real.",
    'Trust your read.',
  ],
  POSITION_RUN: [
    'DOWN & DISTANCE ALERT: Position run underway — {POSITION} flying off the board.',
    "DOWN & DISTANCE ALERT: {POSITION} is heating up. That's three in the last five picks.",
    "DOWN & DISTANCE ALERT: The {POSITION} market is moving. Don't blink.",
    'DOWN & DISTANCE ALERT: {POSITION} run is real. Teams are stacking that spot.',
    'DOWN & DISTANCE ALERT: {POSITION} wave just hit — three in five picks.',
    'DOWN & DISTANCE ALERT: {POSITION} is the story of this stretch.',
    'DOWN & DISTANCE ALERT: {POSITION} run in progress — the board is changing fast.',
    "DOWN & DISTANCE ALERT: It's a {POSITION} rush right now.",
  ],
  VALUE_STEAL: [
    "DOWN & DISTANCE ALERT: {PLAYER} is a steal at {PICK}. That's real value.",
    'DOWN & DISTANCE ALERT: {PLAYER} at {PICK} is highway robbery.',
    'DOWN & DISTANCE ALERT: Value! {PLAYER} fell right into their lap.',
    'DOWN & DISTANCE ALERT: {PLAYER} landing at {PICK} is a gift.',
    "DOWN & DISTANCE ALERT: That's the kind of value teams dream about - {PLAYER}.",
    'DOWN & DISTANCE ALERT: {PLAYER} at {PICK} is pure profit.',
    'DOWN & DISTANCE ALERT: A value swing — {PLAYER} was supposed to go earlier.',
    'DOWN & DISTANCE ALERT: Massive value with {PLAYER}.',
  ],
  RISKY_REACH: [
    "DOWN & DISTANCE ALERT: That's a reach - {PLAYER} went well ahead of projection.",
    'DOWN & DISTANCE ALERT: {PLAYER} at {PICK} is early. Big swing by {TEAM}.',
    "DOWN & DISTANCE ALERT: That's a risky reach. {PLAYER} climbed fast.",
    'DOWN & DISTANCE ALERT: {TEAM} jumped the board for {PLAYER}.',
    "DOWN & DISTANCE ALERT: {PLAYER} came off the board early. That's a bet.",
    "DOWN & DISTANCE ALERT: That's aggressive. {PLAYER} was projected later.",
    'DOWN & DISTANCE ALERT: {TEAM} rolled the dice early on {PLAYER}.',
    'DOWN & DISTANCE ALERT: Bold reach for {PLAYER}.',
  ],
  CAP_CRISIS: [
    "You're in the red. Pain heals. Glory lasts forever-but not if you can't sign anyone.",
  ],
  BIG_SIGNING: ["That's a statement move. The room will feel it."],
  BIG_TRADE: ["That's a statement move. The room will feel it."],
};

export const fillFalcoTemplate = (
  template: string,
  data: Record<string, string | number | undefined>,
): string =>
  Object.entries(data).reduce((result, [key, value]) => {
    if (value === undefined) return result;
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
