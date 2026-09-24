import { getContrastRatio } from '../src/lib/color-utils';
import { TEAM_BRAND_THEMES } from '../src/lib/team-brand-themes';
import { getFrontOfficeTeamTheme } from '../src/lib/team-theme-tokens';

const teams = Object.keys(TEAM_BRAND_THEMES).sort();
const missing: string[] = [];
const failures: string[] = [];

console.log('FRONT OFFICE THEME AUDIT');
console.log('========================\n');

for (const team of teams) {
  const theme = getFrontOfficeTeamTheme(team);
  if (
    !theme.navBackground ||
    !theme.navForeground ||
    !theme.interactive ||
    !theme.interactiveForeground
  ) {
    missing.push(team);
    continue;
  }
  const navRatio = getContrastRatio(theme.navForeground, theme.navBackground);
  const interactiveRatio = getContrastRatio(theme.interactiveForeground, theme.interactive);
  const interactiveTextRatio = getContrastRatio(theme.interactiveText, '#0E232A');
  const navPass = navRatio >= 4.5;
  const interactivePass = interactiveRatio >= 4.5;
  const interactiveTextPass = interactiveTextRatio >= 4.5;
  if (!navPass || !interactivePass || !interactiveTextPass) failures.push(team);
  console.log(team);
  console.log(`Nav: ${navPass ? 'PASS' : 'FAIL'} — ${navRatio.toFixed(1)}:1`);
  console.log(
    `Interactive: ${interactivePass ? 'PASS' : 'FAIL'} — ${interactiveRatio.toFixed(1)}:1\n`,
  );
  console.log(
    `Interactive text: ${interactiveTextPass ? 'PASS' : 'FAIL'} — ${interactiveTextRatio.toFixed(1)}:1\n`,
  );
}

console.log(`Teams:\n${teams.length} / 32\n`);
console.log(`Missing themes:\n${missing.length ? missing.join(', ') : 'NONE'}\n`);
console.log(`Contrast failures:\n${failures.length ? failures.join(', ') : 'NONE'}`);

if (teams.length !== 32 || missing.length || failures.length) process.exitCode = 1;
