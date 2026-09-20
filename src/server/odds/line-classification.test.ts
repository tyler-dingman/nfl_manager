import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyStoredLine } from './line-classification';
const rawProviderMetadata = {
  odd: {
    betTypeID: 'ou',
    byBookmaker: {
      fanduel: {
        overUnder: '235.5',
        odds: '-150',
        altLines: [{ overUnder: '179.5', odds: '-950' }],
      },
      draftkings: { overUnder: '179.5', odds: '-130' },
    },
  },
};
test('the same threshold is classified independently for each sportsbook', () => {
  assert.deepEqual(
    classifyStoredLine({
      sportsbook: 'FANDUEL',
      line: 179.5,
      isAltLine: false,
      rawProviderMetadata,
    }),
    { lineType: 'alternate', mainLine: 235.5 },
  );
  assert.deepEqual(
    classifyStoredLine({
      sportsbook: 'DRAFTKINGS',
      line: 179.5,
      isAltLine: false,
      rawProviderMetadata,
    }),
    { lineType: 'main', mainLine: 179.5 },
  );
});
test('no primary label or main-line number is invented for unverified legacy markets', () => {
  assert.deepEqual(classifyStoredLine({ sportsbook: 'FANDUEL', line: 179.5, isAltLine: false }), {
    lineType: 'unknown',
    mainLine: null,
  });
  assert.deepEqual(classifyStoredLine({ sportsbook: 'FANDUEL', line: 179.5, isAltLine: true }), {
    lineType: 'alternate',
    mainLine: null,
  });
});
test('primary line remains primary regardless of price and supports numeric strings', () => {
  assert.equal(
    classifyStoredLine({ sportsbook: 'FANDUEL', line: '235.5', rawProviderMetadata }).lineType,
    'main',
  );
});
