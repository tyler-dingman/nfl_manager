import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getInjuryGraphicCopy } from './injury-graphic-copy';
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
  for (const asset of ['contract-document', 'pen', 'signature-flourish', 'ruler-overlay'])
    assert.match(css, new RegExp(`${asset}\\.svg`));
  assert.doesNotMatch(`${contract}${shared}`, /logo_url|headshot|player.*image/i);
});

test('The Beat maps only canonical contract categories to the contract graphic', async () => {
  const source = await readFile('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(source, /\['CONTRACT', 'CONTRACT NEWS', 'CONTRACT UPDATE'\]/);
  assert.match(source, /isContract \? \(/);
});
