import test from 'node:test';
import assert from 'node:assert/strict';
import { isAnytimeTD, researchThreshold, researchSide, propPick } from './anytime-td';
import { selectDiscoveryMarkets } from './discovery-selection';
import { slipPick } from './slip';
const td = {
  id: 'td',
  eventId: 'game',
  playerId: 'p',
  marketType: 'TOUCHDOWNS',
  period: 'game',
  side: 'YES',
  line: null,
  odds: 150,
  sportsbook: 'FANDUEL' as const,
  available: true,
  lineType: 'unknown' as const,
};
test('binary anytime TD discovery preserves original selection and excludes alternate/partial-game markets', () => {
  const standard = { altLines: false, maxOdds: -800 };
  const result = selectDiscoveryMarkets([td], standard, { includeUnqualified: true });
  assert.equal(result.length, 1);
  assert.equal(result[0], td);
  assert.equal(result[0].line, null);
  assert.equal(result[0].side, 'YES');
  assert.equal(researchThreshold(td), 0.5);
  assert.equal(researchSide(td.side), 'OVER');
  assert.equal(slipPick(td), 'Anytime TD — Yes');
  assert.equal(propPick({ ...td, side: 'NO' }), 'No');
  assert.equal(isAnytimeTD({ ...td, period: '1q' }), false);
  assert.equal(isAnytimeTD({ ...td, line: 1.5, side: 'OVER' }), false);
  assert.equal(
    selectDiscoveryMarkets([td], { ...standard, altLines: true }, { includeUnqualified: true })
      .length,
    1,
  );
  assert.equal(
    selectDiscoveryMarkets([{ ...td, available: false }], standard, { includeUnqualified: true })
      .length,
    0,
  );
});
