import test from 'node:test';
import assert from 'node:assert/strict';
import { sealDirectory, unsealDirectory } from './backup-codec';
import { seal } from './mail';
const secret = 'synthetic-final-directory-key-at-least-32-characters';
test('binary checkpoint codec preserves legacy reads, exact Unicode rows, randomness and authenticated corruption rejection', async () => {
  const values = [
    { small: 'value' },
    Array.from({ length: 5000 }, (_, i) => ({
      id: 'original-' + i,
      text: 'é🏈'.repeat(20),
      saved: i % 2 === 0,
    })),
    { entropy: Array.from(crypto.getRandomValues(new Uint8Array(60000))).join(',') },
  ];
  for (const value of values) {
    for (const envelope of [
      await seal(value, secret),
      await sealDirectory(value, secret),
      await sealDirectory(value, secret, 'binary-v2'),
    ])
      assert.deepEqual(await unsealDirectory(envelope, secret), value);
    const a = await sealDirectory(value, secret, 'binary-v2'),
      b = await sealDirectory(value, secret, 'binary-v2');
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.cipher, b.cipher);
    await assert.rejects(
      unsealDirectory(
        { ...a, cipher: (a.cipher[0] === 'A' ? 'B' : 'A') + a.cipher.slice(1) },
        secret,
      ),
    );
    await assert.rejects(unsealDirectory(a, 'different-synthetic-key-at-least-32-characters'));
  }
  const value = values[1],
    old = JSON.stringify(await sealDirectory(value, secret)).length,
    compact = JSON.stringify(await sealDirectory(value, secret, 'binary-v2')).length;
  assert(compact < old * 0.85, `Expected envelope savings: ${old} -> ${compact}`);
});
