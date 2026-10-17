/** Read-only proposal check by default. --generate requires a separately authorized live test,
 * an enabled local sportsbook flag and --user=<allowlisted authenticated user UUID>. */
import { loadEnvConfig } from '@next/env';
import { readFile, writeFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
import { isSportsbook, sportsbookConfig } from '../packages/parlay/sportsbook-transfer';
const selectedBook = process.argv.find((s) => s.startsWith('--book='))?.slice(7) ?? 'draftkings';
if (!isSportsbook(selectedBook)) throw Error('Unknown sportsbook');
const book = selectedBook;
const directory = `reports/${book}-transfer-test`;
async function main() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw Error('Local database required.');
  const { authDb } = await import('../src/server/auth/database');
  const { createProposalService } =
    await import('../src/server/providers/unabated/transfer-proposals');
  const { createTransferService, transferEnabled } =
    await import('../src/server/providers/unabated/transfer-service');
  const db = authDb();
  try {
    const { legs } = JSON.parse(await readFile(`${directory}/selections.json`, 'utf8'));
    const user =
      process.argv.find((s) => s.startsWith('--user='))?.slice(7) ?? 'local-read-only-preview';
    const proposal = await createProposalService(db).propose(
      user,
      legs.map((l: { id: string }) => l.id),
      book,
    );
    if (!proposal) throw Error('No complete current sportsbook proposal.');
    const { token, ...safe } = proposal;
    await writeFile(`${directory}/proposal.json`, JSON.stringify(safe, null, 2));
    console.log('Local sportsbook proposal prepared; ' + proposal.adjustments + ' adjustments.');
    if (!process.argv.includes('--generate')) return;
    if (!transferEnabled(user, process.env, book))
      throw Error('Controlled sportsbook test flag and allowlisted user required.');
    if (proposal.adjustments) throw Error('This exact-line pilot requires zero substitutions.');
    const approved = await createProposalService(db).approve(user, book, token, false);
    await writeFile(
      `${directory}/attempt.json`,
      JSON.stringify({ startedAt: new Date().toISOString(), ids: approved.map((l) => l.id) }),
      { flag: 'wx' },
    );
    const { UnabatedClient } = await import('../src/server/providers/unabated/client');
    const client = new UnabatedClient();
    let apiCalls = 0;
    let originalGamblyLink: string | undefined;
    const generate = client.generateSlip.bind(client),
      poll = client.slipStatus.bind(client);
    client.generateSlip = async (...args) => {
      apiCalls++;
      return generate(...args);
    };
    client.slipStatus = async (...args) => {
      apiCalls++;
      const result = await poll(...args);
      originalGamblyLink =
        result.betSlips?.find((s) => s.book === sportsbookConfig[book].unabatedName)?.deepLink ??
        originalGamblyLink;
      return result;
    };
    const started = Date.now();
    const service = createTransferService(db, client);
    let state = await service.start(
      user,
      approved.map((l) => l.id),
      'UNSPECIFIED',
      book,
      approved,
    );
    for (let i = 0; i < 25 && ['pending', 'submitting'].includes(state.status); i++) {
      await new Promise((r) => setTimeout(r, 2000));
      state = await service.poll(user, state.id, book);
    }
    await writeFile(
      `${directory}/result.json`,
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          ...state,
          sportsbook: book,
          elapsedMs: Date.now() - started,
          apiCalls,
          // Only publish the original candidate after shared validation succeeds.
          originalGamblyLink: state.status === 'complete' ? originalGamblyLink : undefined,
          manualVerification: 'Required; no wager placed by this script.',
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    console.log('sportsbook generation status: ' + state.status + '. See local result report.');
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'sportsbook test failed.');
  process.exitCode = 1;
});
