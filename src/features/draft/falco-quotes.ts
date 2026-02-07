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
    'FALCO ALERT: Position run underway — {POSITION} flying off the board.',
    "FALCO ALERT: {POSITION} is heating up. That's three in the last five picks.",
    "FALCO ALERT: The {POSITION} market is moving. Don't blink.",
    'FALCO ALERT: {POSITION} run is real. Teams are stacking that spot.',
    'FALCO ALERT: {POSITION} wave just hit — three in five picks.',
    'FALCO ALERT: {POSITION} is the story of this stretch.',
    'FALCO ALERT: {POSITION} run in progress — the board is changing fast.',
    "FALCO ALERT: It's a {POSITION} rush right now.",
  ],
  VALUE_STEAL: [
    "FALCO ALERT: {PLAYER} is a steal at {PICK}. That's real value.",
    'FALCO ALERT: {PLAYER} at {PICK} is highway robbery.',
    'FALCO ALERT: Value! {PLAYER} fell right into their lap.',
    'FALCO ALERT: {PLAYER} landing at {PICK} is a gift.',
    "FALCO ALERT: That's the kind of value teams dream about - {PLAYER}.",
    'FALCO ALERT: {PLAYER} at {PICK} is pure profit.',
    'FALCO ALERT: A value swing — {PLAYER} was supposed to go earlier.',
    'FALCO ALERT: Massive value with {PLAYER}.',
  ],
  RISKY_REACH: [
    "FALCO ALERT: That's a reach - {PLAYER} went well ahead of projection.",
    'FALCO ALERT: {PLAYER} at {PICK} is early. Big swing by {TEAM}.',
    "FALCO ALERT: That's a risky reach. {PLAYER} climbed fast.",
    'FALCO ALERT: {TEAM} jumped the board for {PLAYER}.',
    "FALCO ALERT: {PLAYER} came off the board early. That's a bet.",
    "FALCO ALERT: That's aggressive. {PLAYER} was projected later.",
    'FALCO ALERT: {TEAM} rolled the dice early on {PLAYER}.',
    'FALCO ALERT: Bold reach for {PLAYER}.',
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
