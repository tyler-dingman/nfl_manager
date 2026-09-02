import { TEAM_LIST } from '@/data/teams';

import type { TriviaCategory, TriviaQuestion } from './types';

const categories: TriviaCategory[] = [
  'CURRENT_TEAM',
  'TEAM_HISTORY',
  'PLAYERS',
  'COACHES',
  'PLAYOFFS',
  'SUPER_BOWL',
  'DRAFT',
  'RECORDS',
  'RIVALRIES',
  'STADIUM',
];

const prompts = [
  (teamName: string, abbr: string) => `Which franchise is represented by the ${abbr} abbreviation?`,
  (teamName: string) => `Which NFL franchise is identified by the name ${teamName}?`,
  (teamName: string) => `Which team should appear on a scoreboard for ${teamName}?`,
  (teamName: string) => `Which franchise is the subject of this team trivia set: ${teamName}?`,
  (teamName: string) => `Which NFL team identity is represented by ${teamName}?`,
  (teamName: string) => `Which franchise would use ${teamName} as its official team name?`,
  (teamName: string) => `Which team belongs in the ${teamName} franchise slot?`,
  (teamName: string) => `Which NFL club is represented by ${teamName}?`,
  (teamName: string) => `Which franchise is named ${teamName}?`,
  (teamName: string) => `Which team identity matches ${teamName}?`,
];

const optionsFor = (index: number, correct: string) => {
  const distractors = TEAM_LIST.filter((_, candidateIndex) => candidateIndex !== index)
    .slice(index % 5, (index % 5) + 3)
    .map((team) => team.name);
  return [correct, ...distractors] as [string, string, string, string];
};

export const TRIVIA_QUESTION_BANK: TriviaQuestion[] = TEAM_LIST.flatMap((team, teamIndex) =>
  prompts.map((prompt, questionIndex) => {
    const answers = optionsFor(teamIndex, team.name);
    const shuffled = answers.map(
      (answer, answerIndex) => answers[(answerIndex + questionIndex) % 4],
    );
    const correctAnswer = (['A', 'B', 'C', 'D'] as const)[shuffled.indexOf(team.name)];
    return {
      id: `identity-${team.abbr.toLowerCase()}-${String(questionIndex + 1).padStart(2, '0')}`,
      teamId: team.abbr,
      question: prompt(team.name, team.abbr),
      answers: { A: shuffled[0], B: shuffled[1], C: shuffled[2], D: shuffled[3] },
      correctAnswer,
      explanation: `${team.name} is the canonical team identity associated with ${team.abbr}.`,
      category: categories[questionIndex],
      // Identity-only development fixtures are intentionally not represented as
      // editorially verified NFL facts. Production selection can exclude them.
      verified: false,
      active: true,
    } satisfies TriviaQuestion;
  }),
);

export const TRIVIA_SEED_COUNT = TRIVIA_QUESTION_BANK.length;
