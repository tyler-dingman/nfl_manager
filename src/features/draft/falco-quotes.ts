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
    'FIVE WIDE ALERT: Position run underway — {POSITION} flying off the board.',
    "FIVE WIDE ALERT: {POSITION} is heating up. That's three in the last five picks.",
    "FIVE WIDE ALERT: The {POSITION} market is moving. Don't blink.",
    'FIVE WIDE ALERT: {POSITION} run is real. Teams are stacking that spot.',
    'FIVE WIDE ALERT: {POSITION} wave just hit — three in five picks.',
    'FIVE WIDE ALERT: {POSITION} is the story of this stretch.',
    'FIVE WIDE ALERT: {POSITION} run in progress — the board is changing fast.',
    "FIVE WIDE ALERT: It's a {POSITION} rush right now.",
  ],
  VALUE_STEAL: [
    "FIVE WIDE ALERT: {PLAYER} is a steal at {PICK}. That's real value.",
    'FIVE WIDE ALERT: {PLAYER} at {PICK} is highway robbery.',
    'FIVE WIDE ALERT: Value! {PLAYER} fell right into their lap.',
    'FIVE WIDE ALERT: {PLAYER} landing at {PICK} is a gift.',
    "FIVE WIDE ALERT: That's the kind of value teams dream about - {PLAYER}.",
    'FIVE WIDE ALERT: {PLAYER} at {PICK} is pure profit.',
    'FIVE WIDE ALERT: A value swing — {PLAYER} was supposed to go earlier.',
    'FIVE WIDE ALERT: Massive value with {PLAYER}.',
  ],
  RISKY_REACH: [
    "FIVE WIDE ALERT: That's a reach - {PLAYER} went well ahead of projection.",
    'FIVE WIDE ALERT: {PLAYER} at {PICK} is early. Big swing by {TEAM}.',
    "FIVE WIDE ALERT: That's a risky reach. {PLAYER} climbed fast.",
    'FIVE WIDE ALERT: {TEAM} jumped the board for {PLAYER}.',
    "FIVE WIDE ALERT: {PLAYER} came off the board early. That's a bet.",
    "FIVE WIDE ALERT: That's aggressive. {PLAYER} was projected later.",
    'FIVE WIDE ALERT: {TEAM} rolled the dice early on {PLAYER}.',
    'FIVE WIDE ALERT: Bold reach for {PLAYER}.',
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
