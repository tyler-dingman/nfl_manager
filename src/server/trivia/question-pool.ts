import { TRIVIA_QUESTION_BANK } from '@/features/trivia/question-bank';
import { authDb } from '@/server/auth/database';

const choices = ['A', 'B', 'C', 'D'] as const;

/**
 * Production migrations intentionally create schema without seed data. Ensure a
 * game can still start on a fresh database, while leaving curated questions as
 * the preferred pool whenever they are present.
 */
export async function ensureTriviaQuestionPool(teamId: string, minimum: number) {
  const sql = authDb();
  const normalizedTeamId = teamId.toUpperCase();
  const counts = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS count
    FROM trivia_questions
    WHERE team_id=${normalizedTeamId} AND active=true AND verified=true
  `;
  if ((counts[0]?.count ?? 0) >= minimum) return;

  const fallback = TRIVIA_QUESTION_BANK.filter(
    (question) => question.teamId === normalizedTeamId && question.active,
  ).slice(0, minimum);
  if (fallback.length < minimum) throw new Error('Not enough active questions.');

  await sql.begin(async (tx) => {
    for (const question of fallback) {
      if (!question.correctAnswer) continue;
      await tx`
        INSERT INTO trivia_questions
          (id, team_id, question, answer_a, answer_b, answer_c, answer_d,
           correct_answer, explanation, category, source_note, verified, active)
        VALUES
          (${question.id}, ${normalizedTeamId}, ${question.question},
           ${question.answers[choices[0]]}, ${question.answers[choices[1]]},
           ${question.answers[choices[2]]}, ${question.answers[choices[3]]},
           ${question.correctAnswer}, ${question.explanation}, ${question.category},
           'Bundled baseline question used when production seed data is unavailable.', true, true)
        ON CONFLICT (id) DO UPDATE SET
          active=true,
          verified=true,
          updated_at=now()
      `;
    }
  });
}
