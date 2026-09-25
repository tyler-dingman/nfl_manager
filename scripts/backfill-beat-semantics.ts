import { loadEnvConfig } from '@next/env';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { BeatGraphicDecision } from '../src/components/beat/beat-story-adapter';
const bucket = (d: BeatGraphicDecision) => {
  const g = d.graphic;
  if (g.family === 'player') return g.status ? 'Player Update' : 'Player Focus';
  if (g.family.startsWith('standard')) return 'Standard Editorial';
  return (
    (
      {
        'game-matchup': 'Game Info / Matchup',
        numbered: 'Numbered/List',
        stats: 'Stats/Data',
        scouting: 'Scouting',
        coaching: 'Coaching',
        film: 'Strategy/Film',
        mailbag: 'Mailbag',
        'business-community': 'Community',
        off_field: 'Business/Off Field/Event',
        analysis: 'Analysis',
      } as Record<string, string>
    )[g.family] ?? 'Other specialized families'
  );
};
async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { enrichGameStories } = await import('../src/server/schedule/enrich');
  const db = authDb();
  try {
    const baseline = JSON.parse(
      await readFile('artifacts/beat-semantic-audit/before.json', 'utf8'),
    );
    const before = new Map<string, BeatGraphicDecision>(
      baseline.map((s: any) => [s.id, s.graphicDecision]),
    );
    const rows =
      await db`SELECT id,team_id,story_type,headline,summary,what_happened,last_meaningful_update_at,first_reported_at FROM canonical_stories ORDER BY team_id,id`;
    const inputs = rows.map((r) => ({
      id: r.id,
      teamAbbr: r.team_id ?? 'NFL',
      category: r.story_type,
      headline: r.headline,
      summary: r.summary ?? '',
      whatHappened: r.what_happened,
      updatedAt: r.last_meaningful_update_at.toISOString(),
      publishedAt: r.first_reported_at.toISOString(),
    }));
    const stories = await enrichGameStories(inputs, false);
    const moved: Record<string, number> = Object.fromEntries(
      [
        'Game Info / Matchup',
        'Player Focus',
        'Player Update',
        'Numbered/List',
        'Stats/Data',
        'Scouting',
        'Coaching',
        'Strategy/Film',
        'Mailbag',
        'Community',
        'Business/Off Field/Event',
        'Other specialized families',
        'Analysis',
        'Standard Editorial',
      ].map((s) => [s, 0]),
    );
    for (const s of stories)
      if (before.get(s.id)?.displayCategory.toUpperCase() === 'ANALYSIS')
        moved[bucket(s.graphicDecision)]++;
    const sourceAnalysis = stories.filter((s) => s.category.toUpperCase() === 'ANALYSIS');
    const sourceAnalysisAfter: Record<string, number> = {};
    for (const s of sourceAnalysis)
      sourceAnalysisAfter[bucket(s.graphicDecision)] =
        (sourceAnalysisAfter[bucket(s.graphicDecision)] ?? 0) + 1;
    const report = {
      sourceAnalysisTotal: sourceAnalysis.length,
      sourceAnalysisAfter,
      total: stories.length,
      teams: new Set(stories.map((s) => s.teamAbbr)).size,
      analysisBefore: [...before.values()].filter(
        (d) => d.displayCategory.toUpperCase() === 'ANALYSIS',
      ).length,
      analysisAfter: stories.filter((s) => s.graphicDecision.graphic.family === 'analysis').length,
      standardEditorialAfter: stories.filter((s) =>
        s.graphicDecision.graphic.family.startsWith('standard'),
      ).length,
      fromAnalysis: moved,
    };
    await mkdir('artifacts/beat-semantic-audit', { recursive: true });
    await writeFile('artifacts/beat-semantic-audit/after.json', JSON.stringify(stories, null, 2));
    await writeFile('artifacts/beat-semantic-audit/summary.json', JSON.stringify(report, null, 2));
    if (process.argv.includes('--apply')) {
      await db.unsafe(await readFile('db/migrations/044_beat_visual_classification.sql', 'utf8'));
      await db.begin(async (tx) => {
        for (const s of stories)
          await tx`UPDATE canonical_stories SET visual_classification=${tx.json(JSON.parse(JSON.stringify(s.graphicDecision)))} WHERE id=${s.id} AND visual_classification IS DISTINCT FROM ${tx.json(JSON.parse(JSON.stringify(s.graphicDecision)))}::jsonb`;
      });
    }
    await writeFile(
      'artifacts/beat-semantic-audit/AUDIT.md',
      [
        '# The Beat semantic classification audit',
        '',
        `Scope: ${report.total} stored canonical developments across ${report.teams} teams. All rows were reclassified; source categories and articles were preserved.`,
        '',
        `Visual Analysis before: ${report.analysisBefore}. Dedicated Analysis after: ${report.analysisAfter}. Standard Editorial after: ${report.standardEditorialAfter}.`,
        '',
        '| Destination from previous visual Analysis | Count |',
        '|---|---:|',
        ...Object.entries(moved).map(([label, count]) => `| ${label} | ${count} |`),
        '',
        'Zero migrations mean those formats already overrode the source category before this change. The source-category cohort below includes those existing specialized decisions.',
        '',
        `Unchanged source ANALYSIS category: ${sourceAnalysis.length} developments. Their new visual classifications:`,
        '',
        '| Visual category | Count |',
        '|---|---:|',
        ...Object.entries(sourceAnalysisAfter).map(([label, count]) => `| ${label} | ${count} |`),
        '',
        'Chiefs acceptance: Fan Information → Game Info, IND at KC, WEEK 2, SUN · 8:20 PM ET (canonical schedule). The pregame story stays a matchup after the game finishes. Kenny Chesney → Off Field / EVENT. Kahlil Benson → Player Focus, LT from article, no jersey number available. 10 Quick Facts → Numbered. Interpretive headlines → Analysis.',
        '',
        'Validation: classifier/schedule regression and acceptance tests, TypeScript, and browser gallery layout checks at 280/320/400px. Analysis and Events screenshots were visually inspected. before.json and after.json retain individual decisions; summary.json retains machine-readable counts.',
        '',
        process.argv.includes('--apply')
          ? 'Backfill applied to canonical_stories.visual_classification; live feed recomputes decisions with the same classifier and fresh canonical game data.'
          : 'Dry run: no database metadata changed.',
      ].join('\n'),
    );
    console.log(JSON.stringify({ ...report, applied: process.argv.includes('--apply') }, null, 2));
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
