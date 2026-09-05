import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../../app/preview/page.tsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../../app/preview/preview-form.tsx', import.meta.url), 'utf8');

test('preview gate reuses the current generic merch logo treatment', () => {
  assert.match(page, /FiveWideLogo/);
  assert.match(page, /generic/);
  assert.doesNotMatch(page, /down_distance_logo\.svg/);
});

test('preview gate removes the legacy tagline', () => {
  assert.doesNotMatch(page, /All ball\. All the time\./i);
});

test('preview controls are substantial and safe at mobile widths', () => {
  assert.match(page, /w-full max-w-md/);
  assert.match(page, /overflow-x-hidden/);
  assert.match(form, /text-base/);
  assert.equal((form.match(/h-14/g) ?? []).length, 2);
  assert.match(form, /min-w-0/);
});
