import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
// Runs the real Firebase JS SDK against isolated REST protocol fixtures, never a Firebase project.
let script: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/firebase-login.tsx'],
    bundle: true,
    write: false,
    jsx: 'automatic',
    tsconfig: 'tsconfig.test.json',
    define: { 'process.env.NODE_ENV': '"test"' },
    alias: {
      'next/navigation': path.resolve('tests/mobile/fixtures/firebase-login-navigation.ts'),
    },
  });
  script = result.outputFiles[0].text;
});
for (const flow of ['login', 'signup', 'reset'] as const)
  test(`Firebase SDK ${flow} preserves web form flow without legacy password API calls`, async ({
    page,
  }) => {
    page.on('pageerror', (error) => console.log('BROWSER ERROR', error.message));
    const now = Math.floor(Date.now() / 1000);
    const jwt =
      [
        { alg: 'RS256', kid: 'browser-fixture' },
        {
          sub: 'synthetic-browser-user',
          aud: 'synthetic-firebase-fixture',
          iss: 'https://securetoken.google.com/synthetic-firebase-fixture',
          iat: now,
          exp: now + 3600,
          auth_time: now,
          email: 'browser@example.invalid',
          firebase: {
            sign_in_provider: 'password',
            identities: { email: ['browser@example.invalid'] },
          },
        },
      ]
        .map((x) => Buffer.from(JSON.stringify(x)).toString('base64url'))
        .join('.') + '.fixture-signature';
    const calls: string[] = [];
    let exchanged = false;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url()),
        op = url.pathname;
      if (url.hostname === 'firebase-ui.invalid') {
        if (op === '/login')
          return route.fulfill({
            contentType: 'text/html',
            body:
              '<div id="root"></div><script>window.process={env:{NODE_ENV:"test"}};</script><script>' +
              script.replaceAll('</script', '<\\/script') +
              '</script>',
          });
        if (op === '/api/auth/config')
          return route.fulfill({
            json: {
              ok: true,
              mode: 'firebase',
              email: true,
              providers: {},
              firebase: {
                projectId: 'synthetic-firebase-fixture',
                apiKey: 'public-browser-fixture-key',
                authDomain: 'synthetic-firebase-fixture.firebaseapp.com',
                appId: 'synthetic-browser-app',
              },
            },
          });
        if (op === '/api/auth/firebase/session') {
          calls.push('exchange');
          expect(route.request().postDataJSON().idToken).toBe(jwt);
          exchanged = true;
          return route.fulfill({ json: { ok: true } });
        }
        if (op === '/api/auth/me')
          return route.fulfill({
            status: exchanged ? 200 : 401,
            json: { ok: exchanged, user: exchanged ? { id: 'synthetic-app-uuid' } : null },
          });
        if (op.startsWith('/api/auth/')) throw Error('Legacy auth endpoint reached: ' + op);
        return route.abort();
      }
      if (url.hostname === 'identitytoolkit.googleapis.com') {
        calls.push(op);
        if (op.endsWith('accounts:lookup'))
          return route.fulfill({
            json: {
              users: [
                {
                  localId: 'synthetic-browser-user',
                  email: 'browser@example.invalid',
                  emailVerified: true,
                  providerUserInfo: [{ providerId: 'password', email: 'browser@example.invalid' }],
                },
              ],
            },
          });
        if (op.endsWith('accounts:sendOobCode'))
          return route.fulfill({ json: { email: 'browser@example.invalid' } });
        if (op.endsWith('accounts:update'))
          return route.fulfill({
            json: { localId: 'synthetic-browser-user', displayName: 'Synthetic Fan' },
          });
        return route.fulfill({
          json: {
            idToken: jwt,
            refreshToken: 'synthetic-refresh-token',
            expiresIn: '3600',
            localId: 'synthetic-browser-user',
            email: 'browser@example.invalid',
          },
        });
      }
      if (url.hostname === 'securetoken.googleapis.com')
        return route.fulfill({
          json: {
            access_token: jwt,
            refresh_token: 'synthetic-refresh-token',
            expires_in: '3600',
            token_type: 'Bearer',
            user_id: 'synthetic-browser-user',
            project_id: 'synthetic-firebase-fixture',
          },
        });
      return route.abort();
    });
    await page.goto('http://firebase-ui.invalid/login');
    await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
    if (flow === 'signup') await page.getByRole('button', { name: /Create an account/i }).click();
    if (flow === 'reset') await page.getByRole('button', { name: /Forgot password/i }).click();
    await page.getByLabel('Email', { exact: true }).fill('browser@example.invalid');
    if (flow !== 'reset')
      await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-password-42');
    if (flow === 'signup') {
      await page.getByLabel('Name (optional)').fill('Synthetic Fan');
      await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic-test-password-42');
    }
    await page
      .getByRole('button', {
        name:
          flow === 'signup' ? 'Create account' : flow === 'reset' ? 'Send reset link' : 'Sign in',
        exact: true,
      })
      .click();
    if (flow === 'reset') {
      await expect(
        page.getByText('If an account exists, a reset link will be sent.', { exact: true }),
      ).toBeVisible();
      expect(calls.some((c) => c.endsWith('accounts:sendOobCode'))).toBe(true);
    } else {
      await expect(page.locator('body')).toHaveAttribute('data-destination', '/front-office');
      expect(calls).toContain('exchange');
      expect(
        calls.some((c) =>
          c.endsWith(flow === 'signup' ? 'accounts:signUp' : 'accounts:signInWithPassword'),
        ),
      ).toBe(true);
    }
  });
