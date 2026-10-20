import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const dir = (await readFile('/private/tmp/dd-rc3-private-location.txt', 'utf8')).trim(),
  account = JSON.parse(await readFile(dir + '/qualification-account.json', 'utf8')),
  stage = (await readFile(dir + '/staging-cookie.txt', 'utf8')).split('=').slice(1).join('='),
  base = 'https://down-distance-rc3-staging-web.tdingman5.workers.dev',
  host = new URL(base).host,
  out = 'reports/hosted-staging-rc3/completion/';
const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  }),
  context = await browser.newContext(),
  records = [],
  blocked = new Set();
await context.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.host !== host && !['data:', 'blob:'].includes(u.protocol)) {
    blocked.add(u.host);
    return route.abort();
  }
  return route.continue();
});
await context.addCookies([
  {
    name: '__Host-dd_staging',
    value: stage,
    domain: host,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
  },
]);
const page = await context.newPage();
page.on('pageerror', (e) => records.push({ type: 'pageerror', message: e.message.slice(0, 160) }));
try {
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 45000 });
  records.push({
    label: 'signed-out home redirect',
    path: new URL(page.url()).pathname,
    loginOptionsVisible: await page
      .getByText(/continue with email|sign in with email|log in with email/i)
      .count(),
    bodyBytes: (await page.locator('body').innerText()).length,
  });
  await page.getByRole('button', { name: 'Continue with email' }).click();
  records.push({
    label: 'email login form hydrated',
    passwordFields: await page.locator('input[type=password]').count(),
  });
  await page.screenshot({ path: out + 'login-email-browser.png', fullPage: false });
  await context.addCookies([
    {
      name: 'dd_session',
      value: account.finalSession.split('=').slice(1).join('='),
      domain: host,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  for (const path of ['/']) {
    const response = await page.goto(base + path, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(1200);
    records.push({
      label: 'authenticated browser page',
      requestedPath: path,
      finalPath: new URL(page.url()).pathname,
      status: response?.status(),
      title: await page.title(),
      bodyBytes: (await page.locator('body').innerText()).length,
    });
  }
  await page.screenshot({ path: out + 'account-browser.png', fullPage: false });
} catch (e) {
  records.push({ error: e.message.slice(0, 250) });
} finally {
  await browser.close();
  await writeFile(
    out + 'browser-final.json',
    JSON.stringify(
      { records, externalBrowserRequestsBlocked: [...blocked], nativeDeviceValidation: false },
      null,
      2,
    ) + '\n',
  );
}
console.log(JSON.stringify(records));
