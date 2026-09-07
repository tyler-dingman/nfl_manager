import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Front Office display titles use the authoritative Three & Out typography', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');
  const rule = css.match(/\.dd-three-out-display\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.match(rule, /font-family:\s*inherit\s*!important/);
  assert.match(rule, /font-style:\s*italic\s*!important/);
  assert.match(rule, /font-weight:\s*900\s*!important/);
  assert.match(rule, /line-height:\s*1\s*!important/);
  assert.match(rule, /letter-spacing:\s*-0\.05em\s*!important/);
  assert.match(rule, /text-transform:\s*uppercase\s*!important/);
});

test('shared page, overview, and secondary-nav titles all use the display class', async () => {
  const [pageHeader, overviewHero, shell] = await Promise.all([
    readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
    readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
    readFile('src/components/app-shell.tsx', 'utf8'),
  ]);

  assert.match(pageHeader, /<h1 className="dd-three-out-display">/);
  assert.match(overviewHero, /<h1 className="dd-three-out-display">/);
  assert.match(shell, /className="front-office-wordmark dd-three-out-display"/);
});
