/** Read-only audit of production feed decisions. Run: node --import tsx scripts/audit-beat-cards.ts */
import { mkdir, writeFile } from 'node:fs/promises';
import { adaptBeatStory, type BeatStoryInput } from '../src/components/beat/beat-story-adapter';

async function main() {
  await mkdir('artifacts/beat-audit', { recursive: true });
  const entries = [];
  for (const team of ['HOU', 'MIA', 'BUF', 'CHI', 'TB', 'IND']) {
    const response = await fetch('http://localhost:3000/api/content/huddle?team=' + team);
    if (!response.ok) throw new Error(team + ': HTTP ' + response.status);
    const body = await response.json();
    for (const story of body.briefings.slice(0, 8) as BeatStoryInput[])
      entries.push({ story, decision: adaptBeatStory(story) });
  }
  await writeFile('artifacts/beat-audit/current-audit.json', JSON.stringify(entries, null, 2));
  const standard = entries.filter((e) => e.decision.fallbackReason).length;
  const lines = [
    '# Live Beat card audit',
    'Captured ' +
      new Date().toISOString() +
      '. Current top eight per team; these can differ from the review screenshots.',
    standard +
      ' of 48 remain Standard because their text does not establish a supported specific format.',
    'Each extracted value below is checked against the canonical headline/summary supplied by the feed; source links and publication context are preserved in the JSON. This is not independent verification of the underlying reporting.',
    '',
  ];
  for (const { story, decision: d } of entries) {
    lines.push(
      '## ' + story.teamAbbr + ' — ' + story.headline,
      '- Family: ' + d.graphic.family,
      '- Reason: ' + d.reason,
      '- Fallback: ' + (d.fallbackReason ?? 'None'),
      '- Graphic: ' + JSON.stringify(d.graphic),
      ...d.evidence.map(
        (e) =>
          '- ' + e.field + ' = ' + JSON.stringify(e.value) + ' ← ' + e.source + ': ' + e.excerpt,
      ),
      ...d.sourceUrls.map((url) => '- Source: ' + url),
      '',
    );
  }
  await writeFile('artifacts/beat-audit/current-audit.md', lines.join('\n'));
  console.log('Audited', entries.length, 'articles;', standard, 'Standard fallbacks');
}
void main();
