import { REWARD_ACTION_YARDS } from './config';
export const REWARD_WAYS = [
  {
    label: 'Daily Trivia',
    href: '/trivia',
    action: 'DAILY_TRIVIA_CORRECT',
    detail: 'Answer correctly',
    icon: 'trivia',
  },
  {
    label: 'Get Caught Up',
    href: '/catch-up',
    action: 'CATCH_UP_COMPLETE',
    detail: 'Finish your catch-up',
    icon: 'articles',
  },
  {
    label: 'Finish a Game',
    href: '/trivia',
    action: 'TRIVIA_GAME_COMPLETE',
    detail: 'Complete a trivia game',
    icon: 'game',
  },
  {
    label: 'Make Predictions',
    href: '/game-day',
    action: 'PREDICTION_SUBMITTED',
    detail: 'Submit a prediction',
    icon: 'prediction',
  },
  {
    label: 'Game Day Check-in',
    href: '/game-day',
    action: 'GAME_DAY_CHECKIN',
    detail: 'Check in on game day',
    icon: 'checkin',
  },
  {
    label: 'Win Buddy Trivia',
    href: '/trivia',
    action: 'TRIVIA_BUDDY_WIN',
    detail: 'Win against a buddy',
    icon: 'crew',
  },
  {
    label: 'Correct Prediction',
    href: '/game-day',
    action: 'PREDICTION_CORRECT',
    detail: 'Get a prediction right',
    icon: 'prediction',
  },
  {
    label: 'Trivia Answer',
    href: '/trivia',
    action: 'TRIVIA_CORRECT',
    detail: 'Answer correctly in a game',
    icon: 'trivia',
  },
].map((way) => ({
  ...way,
  yards: REWARD_ACTION_YARDS[way.action as keyof typeof REWARD_ACTION_YARDS],
}));
