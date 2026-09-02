export type TriviaCategory =
  | 'CURRENT_TEAM'
  | 'TEAM_HISTORY'
  | 'PLAYERS'
  | 'COACHES'
  | 'PLAYOFFS'
  | 'SUPER_BOWL'
  | 'DRAFT'
  | 'RECORDS'
  | 'RIVALRIES'
  | 'STADIUM'
  | 'NUMBERS'
  | 'TRANSACTIONS'
  | 'MOMENTS';

export type TriviaAnswerChoice = 'A' | 'B' | 'C' | 'D';

export type TriviaQuestion = {
  id: string;
  teamId: string;
  question: string;
  answers: Record<TriviaAnswerChoice, string>;
  correctAnswer?: TriviaAnswerChoice;
  explanation: string;
  category: TriviaCategory;
  verified: boolean;
  active: boolean;
};

export type TriviaMode = 'QUICK' | 'FULL' | 'FRIEND_CHALLENGE' | 'GROUP';

export const QUESTION_COUNT: Record<TriviaMode, number> = {
  QUICK: 5,
  FULL: 10,
  FRIEND_CHALLENGE: 10,
  GROUP: 10,
};
