import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { z } from 'zod';

import { TRIVIA_QUESTION_BANK } from '@/features/trivia/question-bank';

const jsonQuestion = z.object({
  id: z.string().min(3),
  teamId: z
    .string()
    .min(2)
    .max(4)
    .transform((value) => value.toUpperCase()),
  question: z.string().min(8),
  answers: z.array(z.string().min(1)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(3),
  category: z.string().min(2),
  era: z.string().optional(),
  seasonYear: z.number().int().nullable().optional(),
  isEvergreen: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type ImportedQuestion = z.infer<typeof jsonQuestion> & { sourceFile: string };
const choices = ['A', 'B', 'C', 'D'] as const;

async function loadJsonBank() {
  const directory = path.join(process.cwd(), 'data', 'trivia');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  const questions: ImportedQuestion[] = [];
  for (const file of files) {
    const parsed = z
      .array(jsonQuestion)
      .parse(JSON.parse(await readFile(path.join(directory, file), 'utf8')));
    questions.push(...parsed.map((question) => ({ ...question, sourceFile: file })));
  }
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error(`Duplicate Trivia question id: ${question.id}`);
    ids.add(question.id);
  }
  return { files, questions };
}

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const { files, questions } = await loadJsonBank();
  const coveredTeams = new Set(questions.map((question) => question.teamId));
  const fallback = TRIVIA_QUESTION_BANK.filter((question) => !coveredTeams.has(question.teamId));
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });
  try {
    await sql.begin(async (tx) => {
      for (const question of questions) {
        const correctAnswer = choices[question.correctAnswerIndex];
        await tx`
          INSERT INTO trivia_questions
            (id, team_id, question, answer_a, answer_b, answer_c, answer_d, correct_answer,
             explanation, category, source_note, verified, active)
          VALUES
            (${question.id}, ${question.teamId}, ${question.question}, ${question.answers[0]},
             ${question.answers[1]}, ${question.answers[2]}, ${question.answers[3]}, ${correctAnswer},
             ${question.explanation}, ${question.category},
             ${`Curated team question bank: data/trivia/${question.sourceFile}`}, true,
             ${question.isActive})
          ON CONFLICT (id) DO UPDATE SET
            team_id=EXCLUDED.team_id, question=EXCLUDED.question, answer_a=EXCLUDED.answer_a,
            answer_b=EXCLUDED.answer_b, answer_c=EXCLUDED.answer_c, answer_d=EXCLUDED.answer_d,
            correct_answer=EXCLUDED.correct_answer, explanation=EXCLUDED.explanation,
            category=EXCLUDED.category, source_note=EXCLUDED.source_note,
            verified=EXCLUDED.verified, active=EXCLUDED.active, updated_at=now()`;
      }
      for (const question of fallback) {
        if (!question.correctAnswer) continue;
        await tx`
          INSERT INTO trivia_questions
            (id, team_id, question, answer_a, answer_b, answer_c, answer_d, correct_answer,
             explanation, category, source_note, verified, active)
          VALUES
            (${question.id}, ${question.teamId}, ${question.question}, ${question.answers.A},
             ${question.answers.B}, ${question.answers.C}, ${question.answers.D},
             ${question.correctAnswer}, ${question.explanation}, ${question.category},
             'DEVELOPMENT FALLBACK — no team JSON file is currently available.',
             ${question.verified}, ${question.active})
          ON CONFLICT (id) DO NOTHING`;
      }
    });
    const counts = questions.reduce<Record<string, number>>((result, question) => {
      result[question.teamId] = (result[question.teamId] ?? 0) + 1;
      return result;
    }, {});
    console.log(`Imported ${questions.length} curated questions from ${files.length} JSON files.`);
    console.log(
      `Team counts: ${Object.entries(counts)
        .map(([team, count]) => `${team}:${count}`)
        .join(' ')}`,
    );
    if (fallback.length)
      console.log(
        `Retained ${fallback.length} development fallback questions for teams without JSON files.`,
      );
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
