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

test('homepage and shared strategic heroes use the canonical display class', async () => {
  const [pageHeader, strategicHero, overviewHero, shell, hero, capSpace, bigBoard] =
    await Promise.all([
      readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
      readFile('src/components/front-office/front-office-strategic-hero.tsx', 'utf8'),
      readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
      readFile('src/components/app-shell.tsx', 'utf8'),
      readFile('src/components/home/game-day-homepage-hero.tsx', 'utf8'),
      readFile('src/app/cap-space/page.tsx', 'utf8'),
      readFile('src/app/draft/big-board/page.tsx', 'utf8'),
    ]);

  assert.match(hero, /<h1 className="dd-home-hero-display/);
  assert.match(strategicHero, /<h1 className="dd-home-hero-display">/);
  assert.match(pageHeader, /<FrontOfficeStrategicHero/);
  assert.match(overviewHero, /<h1 className="dd-home-hero-display">/);
  assert.match(shell, /className="front-office-wordmark dd-home-hero-display"/);
  assert.match(capSpace, /<FrontOfficeStrategicHero/);
  assert.match(bigBoard, /DraftExperienceHero/);
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

test('strategic hero owns the standard Front Office eyebrow', async () => {
  const [pageHeader, strategicHero, overviewHero] = await Promise.all([
    readFile('src/components/front-office/front-office-page-header.tsx', 'utf8'),
    readFile('src/components/front-office/front-office-strategic-hero.tsx', 'utf8'),
    readFile('src/components/front-office/front-office-overview-hero.tsx', 'utf8'),
  ]);

  assert.match(overviewHero, /fo-title-eyebrow[^>]+>\s*Your team\. Your moves\./);
  assert.doesNotMatch(overviewHero, /A bigger tomorrow|Your tomorrow/);
  assert.match(strategicHero, /Front Office · \{section\}/);
  assert.match(pageHeader, /section=\{title\}/);
  assert.doesNotMatch(pageHeader, /fo-title-eyebrow|fo-strapline/);
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

test('strategic hero stays Down and Distance navy across team themes', async () => {
  const css = await readFile(
    'src/components/front-office/front-office-strategic-hero.module.css',
    'utf8',
  );
  const hero = css.match(/\.hero\s*\{([^}]+)\}/)?.[1] ?? '';

  assert.match(hero, /background:\s*#041a30/);
  assert.doesNotMatch(hero, /var\(--team-/);
  assert.match(css, /playbook-xo-arrows\.svg/);
});
