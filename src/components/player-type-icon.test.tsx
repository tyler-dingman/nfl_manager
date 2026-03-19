import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PlayerTable } from '@/components/player-table';
import type { PlayerRowDTO } from '@/types/player';

const makePlayer = (overrides: Partial<PlayerRowDTO> = {}): PlayerRowDTO => ({
  id: overrides.id ?? 'player-1',
  firstName: overrides.firstName ?? 'Trent',
  lastName: overrides.lastName ?? 'McDuffie',
  position: overrides.position ?? 'CB',
  age: overrides.age ?? 24,
  rating: overrides.rating ?? 84,
  contractYearsRemaining: overrides.contractYearsRemaining ?? 3,
  capHit: overrides.capHit ?? '$4.0M',
  status: overrides.status ?? 'Active',
  ...overrides,
});

test('non-draft player table renders player type icon', () => {
  const html = renderToStaticMarkup(
    <PlayerTable data={[makePlayer()]} variant="roster" />,
  );

  assert.match(html, /data-player-type="upcoming"/);
});

test('draft player table does not render player type icon', () => {
  const html = renderToStaticMarkup(
    <PlayerTable
      data={[makePlayer({ id: 'prospect-1', position: 'WR', status: 'Available', isDrafted: false })]}
      variant="draft"
      onTheClockForUserTeam={true}
    />,
  );

  assert.doesNotMatch(html, /data-player-type=/);
});
