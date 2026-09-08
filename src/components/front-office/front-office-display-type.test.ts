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
  assert.match(rule, /letter-spacing:\s*-0\.015em/);
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

test('Front Office eyebrows reuse the Beat hierarchy and redundant straplines are removed', async () => {
  const [pageHeader, overviewHero, css] = await Promise.all([
    readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
    readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
    readFile('src/app/globals.css', 'utf8'),
  ]);

  assert.match(overviewHero, /fo-title-eyebrow[^>]+>\s*Your team\. Your moves\./);
  assert.doesNotMatch(overviewHero, /A bigger tomorrow|Your tomorrow/);
  assert.match(pageHeader, /fo-title-eyebrow[^>]+>\{strapline\}<\/p>/);
  assert.doesNotMatch(pageHeader, /fo-strapline/);

  const eyebrowRule = css.match(/\.fo-title-eyebrow\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(eyebrowRule, /font-size:\s*0\.75rem/);
  assert.match(eyebrowRule, /font-weight:\s*900/);
  assert.match(eyebrowRule, /letter-spacing:\s*0\.25em/);
  assert.match(eyebrowRule, /text-transform:\s*uppercase/);
  assert.doesNotMatch(css, /\.fo-(?:eyebrow|strapline)\s*\{/);
});

test('Front Office uses the shared hero artwork for every team', async () => {
  const overviewHero = await readFile(
    'src/components/front-office/front-office-overview-hero.tsx',
    'utf8',
  );

  assert.match(overviewHero, /src="\/images\/fo_hero\.png"/);
  assert.doesNotMatch(overviewHero, /gameDayHeroAsset|selectedTeamId/);
});

test('Front Office hero centers its larger description without the legacy tagline', async () => {
  const [overviewHero, css] = await Promise.all([
    readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
    readFile('src/app/globals.css', 'utf8'),
  ]);
  const heroRule = css.match(/\.fo-overview-hero\s*\{([^}]+)\}/)?.[1] ?? '';
  const descriptionRule = css.match(/\.fo-overview-description\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.doesNotMatch(overviewHero, /Champions are built, not bought/);
  assert.match(heroRule, /display:\s*flex/);
  assert.match(heroRule, /align-items:\s*center/);
  assert.match(descriptionRule, /font-size:\s*clamp\(1rem,\s*1\.35vw,\s*1\.25rem\)/);
});

test('Office title accents use the brightest accessible team color', async () => {
  const css = await readFile('src/app/globals.css', 'utf8');
  const heroAccent = css.match(/\.fo-overview-copy h1 em\s*\{([^}]+)\}/)?.[1] ?? '';
  const navAccent = css.match(/\.front-office-wordmark strong\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.match(heroAccent, /color:\s*var\(--team-secondary-on-dark\)/);
  assert.match(navAccent, /color:\s*var\(--team-secondary-on-dark\)/);
  assert.doesNotMatch(heroAccent, /#ffcc18/i);
});
