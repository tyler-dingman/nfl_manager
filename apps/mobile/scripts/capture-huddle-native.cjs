const { chromium } = require('../../../node_modules/playwright');
const fs = require('fs'),
  path = require('path');
const out = path.resolve('reports/huddle/previews');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [360, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://localhost:8090/sign-in');
      await page.getByRole('button', { name: 'Skip introduction' }).click();
      await page.getByRole('button', { name: 'Log In', exact: true }).click();
      await page.getByLabel('Email', { exact: true }).fill('test@gmail.com');
      await page.getByLabel('Password', { exact: true }).fill('test');
      await page.getByRole('button', { name: 'Log In', exact: true }).click();
      await page
        .getByRole('button', {
          name: width === 360 ? 'Philadelphia Eagles' : 'Minnesota Vikings',
          exact: true,
        })
        .click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Maybe later', exact: true }).click();
      await page.getByText('THE HUDDLE · Join your team’s conversation →', { exact: true }).click();
      console.log('Native preview route', page.url());
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `native-${width}-loaded.png`), fullPage: true });
      await page
        .getByText('Sample play: pass complete for 12 yards. First down.', { exact: true })
        .waitFor();
      await page.screenshot({ path: path.join(out, `native-${width}-live.png`), fullPage: true });
      await page.getByRole('button', { name: 'Polls', exact: true }).click();
      await page.getByRole('button', { name: /Offense/ }).click();
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
      await page.getByLabel('Say something', { exact: true }).fill('Native fixture message');
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.getByText('Native fixture message', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Play-by-Play', exact: true }).click();
      await page.screenshot({ path: path.join(out, `native-${width}-plays.png`), fullPage: true });
      await page.close();
    }
    console.log(
      'PASS React Native Web 360/430: navigation, live field, polls, send, PBP. Not physical-device validation.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
