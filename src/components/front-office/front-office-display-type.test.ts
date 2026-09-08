import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('canonical Front Office title owns the complete homepage hero typography', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');
  const rule = css.match(/\.dd-home-hero-display\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.match(rule, /font-family:[^}]*ui-sans-serif,\s*system-ui,\s*sans-serif/);
  assert.match(rule, /font-feature-settings:\s*normal/);
  assert.match(rule, /font-stretch:\s*normal/);
  assert.match(rule, /font-style:\s*normal/);
  assert.match(rule, /font-variation-settings:\s*normal/);
  assert.match(rule, /font-weight:\s*900/);
  assert.match(rule, /letter-spacing:\s*-0\.065em/);
  assert.match(rule, /line-height:\s*0\.86/);
  assert.match(rule, /text-transform:\s*uppercase/);
});

test('homepage hero and every Front Office title surface use the same display class', async () => {
  const [pageHeader, overviewHero, shell, hero, capSpace, bigBoard] = await Promise.all([
    readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
    readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
    readFile('src/components/app-shell.tsx', 'utf8'),
    readFile('src/components/home/game-day-homepage-hero.tsx', 'utf8'),
    readFile('src/app/cap-space/page.tsx', 'utf8'),
    readFile('src/app/draft/big-board/page.tsx', 'utf8'),
  ]);

  assert.match(hero, /<h1 className="dd-home-hero-display/);
  assert.match(pageHeader, /<h1 className="dd-home-hero-display">/);
  assert.match(overviewHero, /<h1 className="dd-home-hero-display">/);
  assert.match(shell, /className="front-office-wordmark dd-home-hero-display"/);
  assert.match(capSpace, /<h1 className="dd-home-hero-display/);
  assert.match(bigBoard, /<h1 className="dd-home-hero-display/);
});

test('legacy title utility and conflicting title overrides are removed', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');

  assert.doesNotMatch(css, /\.dd-display-title\s*\{/);
  assert.match(css, /\.front-office-app h1:not\(\.dd-home-hero-display\)/);

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
