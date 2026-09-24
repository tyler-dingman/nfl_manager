/** Audit the captured real feed sample; fetch snapshots separately to keep this reproducible. */
import { mkdir, writeFile } from 'node:fs/promises';
import stories from '../src/components/beat/__fixtures__/all-team-stories.json';
import { adaptBeatStory } from '../src/components/beat/beat-story-adapter';
import { beatPalette, validBeatGraphic } from '../src/components/beat/beat-model';

async function main() {
  await mkdir('artifacts/beat-renderer-audit', { recursive: true });
  const audit = stories.map((story) => {
    const decision = adaptBeatStory(story);
    return {
      story,
      decision,
      requiredMetadataValid: validBeatGraphic(decision.graphic),
      accent: beatPalette(story.teamAbbr).accent,
    };
  });
  await writeFile('artifacts/beat-renderer-audit/decisions.json', JSON.stringify(audit, null, 2));
  const lines = [
    '# All-team composition audit',
    'Scope: eight captured real feed articles per team, all 32 teams (256 articles). Current feeds may change.',
    'A specialized classification alone is not a pass. The browser suite separately checks required-data validity, rendered family, accent, Barlow typography, equal dark-section height, foreground bounds, and number/divider alignment on mobile and desktop.',
    '',
    '| Team | Story | Family | Required data | Accent | Selection / fallback reason |',
    '|---|---|---|---|---|---|',
    ...audit.map(
      ({ story: s, decision: d, requiredMetadataValid, accent }) =>
        '| ' +
        s.teamAbbr +
        ' | ' +
        s.headline.replaceAll('|', '—') +
        ' | ' +
        d.graphic.family +
        ' | ' +
        (requiredMetadataValid ? 'Valid' : 'INVALID') +
        ' | ' +
        accent +
        ' | ' +
        (d.fallbackReason ?? d.reason) +
        ' |',
    ),
    '',
    'Full factual fields, source excerpts, source URLs and publication context are in decisions.json.',
    '',
    '## Required visual examples',
    '- Chiefs Quick Facts and 33–30 Colts: KC-1440.png / KC-390.png.',
    '- DJ Moore, Bills 41–31 Lions and W2 inactive report: BUF-1440.png / BUF-390.png.',
    '- Bengals coaching and four-arrow roster composition: CIN-1440.png / CIN-390.png.',
    '- Panthers scouting, depth chart and roster addition: CAR-1440.png / CAR-390.png.',
    '- Raiders: LV-1440.png / LV-390.png. The current recap contains a verified 26–14 score, so it correctly uses Final. The scoreless Raiders recap is explicitly covered by a labeled development composition fixture.',
    '- 10 Things Said, 3 Takeaways, scoreless Raiders recap, Raiders matchup, W2 inactive report and DJ Moore status unit: fixture-*.png at 280/320/400px.',
    '',
    '## Data boundaries',
    'Unknown kickoff is omitted, not borrowed from an unrelated article. Transcripts without an attributed usable quote use Standard. Player Focus requires a position; Player Update requires a name and status. Unknown injury totals, player numbers and contract facts stay absent. Stats-topic and generic injury-report compositions are deliberate complete variants, as specified.',
    'The selected team controls accents. Team-score pairs never imply home/away. Declared gallery examples are composition fixtures, not additional reporting.',
  ];
  await writeFile('artifacts/beat-renderer-audit/AUDIT.md', lines.join('\n'));
  console.log(
    'Wrote audit for',
    audit.length,
    'articles across',
    new Set(stories.map((s) => s.teamAbbr)).size,
    'teams',
  );
}
void main();
