import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('canonical display title owns the complete Three & Out typography', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');
  const rule = css.match(/\.dd-display-title\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.match(rule, /font-family:\s*inherit/);
  assert.match(rule, /font-feature-settings:\s*normal/);
  assert.match(rule, /font-stretch:\s*normal/);
  assert.match(rule, /font-style:\s*italic/);
  assert.match(rule, /font-variation-settings:\s*normal/);
  assert.match(rule, /font-weight:\s*900/);
  assert.match(rule, /letter-spacing:\s*-0\.05em/);
  assert.match(rule, /line-height:\s*1/);
  assert.match(rule, /text-transform:\s*uppercase/);
});

test('Three & Out and every Front Office title surface use the same display class', async () => {
  const [pageHeader, overviewHero, shell, homepage, catchUp, capSpace, bigBoard] =
    await Promise.all([
      readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
      readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
      readFile('src/components/app-shell.tsx', 'utf8'),
      readFile('src/components/down-distance-home.tsx', 'utf8'),
      readFile('src/components/catch-up/three-out-audio-card.tsx', 'utf8'),
      readFile('src/app/cap-space/page.tsx', 'utf8'),
      readFile('src/app/draft/big-board/page.tsx', 'utf8'),
    ]);

  assert.match(homepage, /<h3 className="dd-display-title/);
  assert.match(catchUp, /<h2 className="dd-display-title/);
  assert.match(pageHeader, /<h1 className="dd-display-title">/);
  assert.match(overviewHero, /<h1 className="dd-display-title">/);
  assert.match(shell, /className="front-office-wordmark dd-display-title"/);
  assert.match(capSpace, /<h1 className="dd-display-title/);
  assert.match(bigBoard, /<h1 className="dd-display-title/);
});

test('legacy title utility and conflicting title overrides are removed', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');

  assert.doesNotMatch(css, /dd-three-out-display/);
  assert.match(css, /\.front-office-app h1:not\(\.dd-display-title\)/);

  for (const selector of ['fo-overview-copy h1', 'fo-page-heading h1']) {
    const rule =
      css.match(new RegExp(`\\.${selector.replace(' ', '\\s+')}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
    assert.doesNotMatch(
      rule,
      /font-(?:family|style|weight|stretch|feature-settings|variation-settings)/,
    );
    assert.doesNotMatch(rule, /letter-spacing|line-height|text-transform/);
  }
});
