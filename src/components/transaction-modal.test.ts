import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { TRANSACTION_ASSETS } from './transaction-modal';

test('maps every transaction variant to the exact supplied phrase and icon', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(TRANSACTION_ASSETS).map(([key, value]) => [
        key,
        [value.icon, value.phraseText],
      ]),
    ),
    {
      're-sign': ['contract-512.png', 'Run it back'],
      'sign-free-agent': ['handshake-512.png', 'Bring him in'],
      'trade-outgoing': ['trade-arrows-512.png', 'Make the call'],
      'trade-received': ['trade-arrows-512.png', "They're calling"],
      counteroffer: ['contract-512.png', 'Back to the table'],
      cut: ['cut-x-512.png', 'Tough call'],
      'waiver-claim': ['target-512.png', 'Put in the claim'],
      'depth-replacement': ['helmet-silhouette-512.png', 'Next man up'],
    },
  );
});

test('uses runtime team tokens and accessible dialog semantics', () => {
  const component = readFileSync('src/components/transaction-modal.tsx', 'utf8');
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /var\(--team-primary\)/);
  assert.match(css, /var\(--team-secondary\)/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-labelledby=\{titleId\}/);
  assert.match(component, /aria-label="Close transaction dialog"/);
});

test('provides a representative mobile sheet layout and reduced motion mode', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /\.txn-layer--field \{\s*display: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('neutral kit contains no bundled NFL or team logo file', () => {
  const component = readFileSync('src/components/transaction-modal.tsx', 'utf8');
  assert.doesNotMatch(component, /assets\/transaction-modal\/(?:logos|teams|nfl)/i);
  assert.match(component, /team\.logo_url/);
});
