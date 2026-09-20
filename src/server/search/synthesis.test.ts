import assert from 'node:assert/strict';
import test from 'node:test';
import { synthesizeEvidence, classifyAmbiguousQuery } from './synthesis';
import { parseTransactions } from './transactions';

test('local synthesis requires valid evidence and an affirmative entailment review', async () => {
  const oldFetch = globalThis.fetch;
  const oldProvider = process.env.SEARCH_ANSWER_PROVIDER;
  const oldBase = process.env.SEARCH_LLM_BASE_URL;
  process.env.SEARCH_ANSWER_PROVIDER = 'ollama';
  process.env.SEARCH_LLM_BASE_URL = 'http://127.0.0.1:11434';
  let replies: unknown[] = [];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ response: JSON.stringify(replies.shift()) }));
  const evidence = [{ id: 'official', content: 'Patrick Mahomes threw for 250 yards.' }];
  const claims = [
    { text: evidence[0].content, evidenceIds: ['official'], quotes: [evidence[0].content] },
  ];
  try {
    replies = [{ claims }, { supported: true }];
    assert.deepEqual(await synthesizeEvidence('Passing yards?', 'KC', evidence, false), claims);
    replies = [{ claims }, { supported: false }];
    assert.equal(await synthesizeEvidence('Passing yards?', 'KC', evidence, false), null);
    replies = [{ claims: [{ ...claims[0], text: 'Patrick Mahomes threw for 900 yards.' }] }];
    assert.equal(await synthesizeEvidence('Passing yards?', 'KC', evidence, false), null);
    replies = [{ intent: 'INVENTED_INTENT' }];
    assert.equal(await classifyAmbiguousQuery('What is happening?'), null);
    replies = [{ intent: 'TEAM_BRIEFING' }];
    assert.equal(await classifyAmbiguousQuery('What is happening?'), 'TEAM_BRIEFING');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldProvider === undefined) delete process.env.SEARCH_ANSWER_PROVIDER;
    else process.env.SEARCH_ANSWER_PROVIDER = oldProvider;
    if (oldBase === undefined) delete process.env.SEARCH_LLM_BASE_URL;
    else process.env.SEARCH_LLM_BASE_URL = oldBase;
  }
});

test('official transaction parser preserves dates, team aliases, and source provenance', () => {
  const rows = parseTransactions(
    '<table><tbody><tr><td><img src="/clubs/logos/WSH.svg"></td><td><img src="/clubs/logos/KC.svg"></td><td>09/18</td><td>Player O&#39;Name</td><td>OT</td><td>Trade</td></tr></tbody></table>',
    2026,
    'https://www.nfl.com/transactions/league/trades/2026/9',
    '2026-09-19T12:00:00Z',
  );
  assert.equal(rows[0].name, "Player O'Name");
  assert.equal(rows[0].from, 'WAS');
  assert.equal(rows[0].to, 'KC');
  assert.equal(rows[0].date, '2026-09-18');
  assert.equal(rows[0].source.provider, 'NFL.com');
  assert.throws(
    () => parseTransactions('<html>Provider unavailable</html>', 2026, '', ''),
    /format unavailable/,
  );
});
