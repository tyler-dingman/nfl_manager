import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getInjuryGraphicCopy } from './injury-graphic-copy';
import { shouldUseRookieBlueprintGraphic } from './rookie-blueprint-category';
import { shouldUseTradeTalkGraphic } from './trade-talk-category';
import { getHeroPalette } from '@/lib/playbook-hero';

test('uses deterministic dynamic copy with a safe injury fallback', () => {
  assert.deepEqual(getInjuryGraphicCopy({}), {
    eyebrow: 'INJURY REPORT',
    primaryText: 'INJURY',
    accentText: 'ALERT',
  });
  assert.equal(getInjuryGraphicCopy({ headline: 'Questionable for Sunday' }).primaryText, 'GAME');
  assert.equal(getInjuryGraphicCopy({ summary: 'Missed Thursday practice' }).accentText, 'WATCH');
  assert.equal(
    getInjuryGraphicCopy({ summary: 'Expected to miss 4-6 weeks' }).accentText,
    '4-6 WEEKS',
  );
});

test('canonical team branding produces distinct proof-team accents', () => {
  assert.notEqual(getHeroPalette('KC').secondaryRoute, getHeroPalette('CIN').secondaryRoute);
  assert.notEqual(getHeroPalette('BAL').secondaryRoute, getHeroPalette('CAR').secondaryRoute);
  for (const team of ['KC', 'CIN', 'BUF', 'BAL', 'CAR', 'GB', 'LV', 'MIA']) {
    assert.match(getHeroPalette(team).secondaryRoute, /^#[0-9a-f]{6}$/i);
  }
});

test('card composes the neutral background and recolorable vector masks without photos or logos', async () => {
  const [component, sharedComponent, css] = await Promise.all([
    readFile('src/components/editorial/injury-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/content-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/injury-graphic-card.module.css', 'utf8'),
  ]);
  assert.match(css, /background-neutral\.webp/);
  assert.match(css, /medical-cross\.svg/);
  assert.match(css, /heartbeat\.svg/);
  assert.match(css, /var\(--card-accent\)/);
  assert.match(css, /\.divider[\s\S]*height: 8px;[\s\S]*var\(--card-accent\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /12cqw/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(sharedComponent, /new Set\(\['BAL', 'CAR'\]\)/);
  assert.doesNotMatch(`${component}${sharedComponent}`, /logo_url|headshot|player.*image/i);
});

test('The Beat uses the injury graphic and leaves non-injury cards conditional', async () => {
  const source = await readFile('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(source, /normalizedCategory\.includes\('INJUR'\)/);
  assert.match(source, /isInjury \? \(/);
});

test('contract template uses shared sizing, live HTML copy, and recolorable supplied assets', async () => {
  const [contract, shared, css] = await Promise.all([
    readFile('src/components/editorial/contract-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/content-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/injury-graphic-card.module.css', 'utf8'),
  ]);
  assert.match(contract, /primaryText = 'CONTRACT'/);
  assert.match(contract, /accentText = 'UPDATE'/);
  assert.match(shared, /template: ContentGraphicTemplate/);
  assert.match(css, /contract-template-overlay\.svg/);
  assert.doesNotMatch(`${contract}${shared}`, /logo_url|headshot|player.*image/i);
});

test('The Beat maps only canonical contract categories to the contract graphic', async () => {
  const source = await readFile('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(source, /\['CONTRACT', 'CONTRACT NEWS', 'CONTRACT UPDATE'\]/);
  assert.match(source, /isContract \? \(/);
});

test('trade talk uses the shared generated-card architecture and supplied recolorable art', async () => {
  const [component, shared, css] = await Promise.all([
    readFile('src/components/editorial/trade-talk-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/content-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/injury-graphic-card.module.css', 'utf8'),
  ]);
  assert.match(component, /template="trade-talk"/);
  assert.match(component, /eyebrow = 'FRONT OFFICE'/);
  assert.match(component, /primaryText = 'TRADE'/);
  assert.match(component, /accentText = 'TALK'/);
  assert.match(shared, /styles\.tradeArrowRight/);
  assert.match(shared, /styles\.tradeArrowLeft/);
  assert.match(shared, /styles\.tradeStreaks/);
  assert.match(css, /down-distance-trade-talk-card-pack\/shared\/background-neutral\.webp/);
  assert.match(css, /trade\/arrow-right\.svg/);
  assert.match(css, /trade\/arrow-left\.svg/);
  assert.match(css, /trade\/motion-streaks\.svg/);
  assert.match(css, /\.accentLayer[\s\S]*background-color: var\(--card-accent\)/);
  assert.match(css, /\.card[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.doesNotMatch(`${component}${shared}`, /logo_url|headshot|player.*image/i);
});

test('trade talk accent follows the canonical proof-team palettes', () => {
  const expectedRoute = (team: string) =>
    new Set(['BAL', 'CAR']).has(team)
      ? getHeroPalette(team).primaryRoute
      : getHeroPalette(team).secondaryRoute;
  const colors = ['KC', 'CIN', 'BAL', 'CAR', 'BUF'].map(expectedRoute);
  assert.equal(new Set(colors).size, colors.length);
  assert.equal(expectedRoute('KC'), '#FFB81C');
  assert.equal(expectedRoute('CIN'), '#FB4F14');
  assert.equal(expectedRoute('BAL'), '#6b63a1');
  assert.equal(expectedRoute('CAR'), '#0085CA');
  assert.equal(expectedRoute('BUF'), '#d03855');
});

test('trade discussion taxonomy maps to Trade Talk while completed trades stay canonical', () => {
  assert.equal(
    shouldUseTradeTalkGraphic({ category: 'TRADE_RUMOR', headline: 'Club is listening' }),
    true,
  );
  assert.equal(
    shouldUseTradeTalkGraphic({ category: 'TRADE', headline: 'Veteran requested a trade' }),
    true,
  );
  assert.equal(
    shouldUseTradeTalkGraphic({ category: 'TRADE', headline: 'Chiefs acquired a veteran receiver' }),
    false,
  );
  assert.equal(
    shouldUseTradeTalkGraphic({ category: 'TRANSACTION', headline: 'Teams completed a trade' }),
    false,
  );
});

test('The Beat inserts Trade Talk without replacing canonical story metadata and actions', async () => {
  const source = await readFile('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(source, /shouldUseTradeTalkGraphic\(\{ category, headline, summary, status \}\)/);
  assert.match(source, /isTradeTalk \? \(/);
  assert.match(source, /TradeTalkGraphicCard teamAbbr=\{teamId\}/);
  assert.match(source, /category\.replaceAll/);
  assert.match(source, /\{headline\}/);
  assert.match(source, /\{summary\}/);
  assert.match(source, /View \{sourceCount\}/);
  assert.match(source, /Updated \$\{time\}/);
  assert.match(source, /ShareToCrewButton/);
});

test('rookie blueprint mirrors Injury geometry without the badge or underline', async () => {
  const [component, shared, css] = await Promise.all([
    readFile('src/components/editorial/rookie-blueprint-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/content-graphic-card.tsx', 'utf8'),
    readFile('src/components/editorial/injury-graphic-card.module.css', 'utf8'),
  ]);
  assert.match(component, /template="rookie-blueprint"/);
  assert.match(component, /eyebrow = 'DRAFT'/);
  assert.match(component, /primaryText = 'ROOKIE'/);
  assert.match(component, /accentText = 'BLUEPRINT'/);
  assert.match(shared, /rookieBlueprint[\s\S]*styles\.bar/);
  assert.match(css, /down-distance-rookie-blueprint-card-pack\/shared\/background-neutral\.webp/);
  assert.doesNotMatch(`${shared}${css}`, /rookie\/draft-badge\.svg|styles\.rookieBadge/);
  assert.doesNotMatch(`${shared}${css}`, /rookie\/underline-swoosh\.svg|styles\.rookieUnderline/);
  assert.match(css, /\.bar[\s\S]*top: 6\.5%;[\s\S]*left: 5%;/);
  assert.doesNotMatch(css, /\.rookieCopy\s*\{[^}]*\b(?:top|right|bottom|left):/s);
  assert.match(css, /\.card[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.doesNotMatch(`${component}${shared}`, /nfl|logo_url|headshot|player.*image/i);
});

test('rookie blueprint uses the unchanged canonical proof-team accent resolver', () => {
  const expectedRoute = (team: string) =>
    new Set(['BAL', 'CAR']).has(team)
      ? getHeroPalette(team).primaryRoute
      : getHeroPalette(team).secondaryRoute;
  assert.deepEqual(['KC', 'CIN', 'BAL', 'CAR', 'BUF'].map(expectedRoute), [
    '#FFB81C',
    '#FB4F14',
    '#6b63a1',
    '#0085CA',
    '#d03855',
  ]);
});

test('rookie development maps to Blueprint while future prospect coverage keeps Draft taxonomy', () => {
  for (const category of [
    'ROOKIE WATCH',
    'ROOKIE',
    'DRAFT PICK DEVELOPMENT',
    'DRAFT CLASS',
    'FIRST-YEAR PLAYER',
  ]) {
    assert.equal(shouldUseRookieBlueprintGraphic({ category, headline: 'Young players develop' }), true);
  }
  assert.equal(
    shouldUseRookieBlueprintGraphic({
      category: 'DRAFT',
      headline: 'Chiefs rookie continues to impress at practice',
    }),
    true,
  );
  assert.equal(
    shouldUseRookieBlueprintGraphic({
      category: 'DRAFT',
      headline: '2027 prospects rise on the latest big board',
    }),
    false,
  );
  assert.equal(
    shouldUseRookieBlueprintGraphic({ category: 'DRAFT', headline: 'Top college quarterbacks' }),
    false,
  );
});

test('The Beat inserts Rookie Blueprint while preserving canonical card content and actions', async () => {
  const source = await readFile('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(source, /shouldUseRookieBlueprintGraphic\(\{ category, headline, summary \}\)/);
  assert.match(source, /isRookieBlueprint \? \(/);
  assert.match(source, /RookieBlueprintGraphicCard teamAbbr=\{teamId\}/);
  assert.match(source, /category\.replaceAll/);
  assert.match(source, /\{headline\}/);
  assert.match(source, /\{summary\}/);
  assert.match(source, /View \{sourceCount\}/);
  assert.match(source, /ShareToCrewButton/);
});
