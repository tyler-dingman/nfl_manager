export type Source = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  isOfficialSource: boolean;
};
export type Story = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  whatsNext: string;
  status: string;
  importanceScore: number;
  sources: Source[];
  lastMaterialUpdateAt: string;
  teamId?: string;
  storyType?: string;
  visualType?: import('../../../packages/editorial-visual').EditorialVisualType;
};
export type ThreePackage = { current: { teamId: string; teamName: string; stories: Story[] } };
export type Briefing = {
  id: string;
  headline: string;
  summary: string;
  whyItMatters?: string;
  category: string;
  updatedAt: string;
  sources: Array<{ id: string; publisher: string; url: string }>;
};
export type WireEntry = {
  id: string;
  storyId: string;
  type: string;
  headline: string;
  summary: string;
  occurredAt: string;
  primarySource?: { name: string; url: string } | null;
};
export type HomeData = {
  teamId: string;
  huddle: Briefing[];
  threeAndOut: ThreePackage | null;
  wire: WireEntry[];
};
export type CatchUpItem = {
  id: string;
  storyId: string;
  type: 'NEW' | 'CHANGED' | 'RESOLVED';
  headline: string;
  summary: string;
  whatChanged: string | null;
  whyItMatters: string;
  sourceCount: number;
  sources: Source[];
};
export type CatchUpData = {
  eligible: boolean;
  teamName: string;
  baselineAt: string;
  totalMeaningfulChanges: number;
  estimatedReadMinutes: number;
  items: CatchUpItem[];
};
export type TriviaChoice = 'A' | 'B' | 'C' | 'D';
export type DailyTrivia = {
  dailyQuestion: {
    id: string;
    questionId: string;
    question: string;
    answers: Record<TriviaChoice, string>;
    category: string;
    completed: boolean;
    result: {
      selectedAnswer: TriviaChoice;
      correct: boolean;
      pointsAwarded: number;
      correctAnswer: TriviaChoice;
    } | null;
    explanation?: string;
  };
};
export type DailyTriviaResult = {
  correct: boolean;
  points: number;
  answer: TriviaChoice;
  explanation: string;
};
export type TriviaGame = {
  gameId: string;
  teamId: string;
  position: number;
  questionCount: number;
  timerSeconds: number;
  score: number;
  correctAnswers: number;
  completed: boolean;
  waitingForPlayers?: boolean;
  standings?: Array<{
    userId: string;
    name: string;
    score: number;
    correctAnswers: number;
    currentRank?: number | null;
    previousRank?: number | null;
  }>;
  question: null | {
    id: string;
    question: string;
    answerA: string;
    answerB: string;
    answerC: string;
    answerD: string;
    category: string;
    presentedAt: string;
  };
};
export type TriviaGroupRoom = {
  gameId: string;
  joinCode: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED';
  isHost: boolean;
  participants: Array<{
    id: string;
    name: string;
    status: 'INVITED' | 'JOINED';
    score: number;
    correctAnswers: number;
  }>;
};
export type TriviaGameResult = {
  correct: boolean;
  points: number;
  selectedAnswer: TriviaChoice | null;
  correctAnswer: TriviaChoice;
  explanation: string;
  timedOut: boolean;
  yardAwarded: number;
  touchdownsEarned: number;
  completed: boolean;
};
export type GameDayRoom = import('../../../packages/game-day').GameDayRoom;
