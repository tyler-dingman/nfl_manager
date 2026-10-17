import { test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createProposalService } from './transfer-proposals';
import { createTransferService } from './transfer-service';
import { UnabatedClient } from './client';
loadEnvConfig(process.cwd());
test(
  'durable reservations, quotas, concurrency, polling and timeout with isolated PostgreSQL fixtures',
  { skip: process.env.RUN_FANDUEL_DB_TESTS !== 'true' },
  async () => {
    const url = process.env.DATABASE_URL!;
    assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
    const schema = 'fd_test_' + randomUUID().replaceAll('-', '');
    const admin = postgres(url, { max: 1 });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    const db = postgres(url, { max: 10, connection: { search_path: schema } });
    const prior = {
      user: process.env.UNABATED_MAX_GENERATIONS_PER_USER_DAY,
      global: process.env.UNABATED_MAX_GENERATIONS_GLOBAL_DAY,
      concurrent: process.env.UNABATED_MAX_CONCURRENT_GENERATIONS,
      partner: process.env.UNABATED_PARTNER_CODE,
    };
    process.env.UNABATED_PARTNER_CODE = 'downanddistance';
    try {
      await db.unsafe(readFileSync('db/migrations/051_fanduel_transfer_jobs.sql', 'utf8'));
      await db.unsafe(readFileSync('db/migrations/052_sportsbook_transfer_jobs.sql', 'utf8'));
      await db.unsafe(
        `CREATE TABLE sportsbook_events(id uuid,provider text,markets_locked boolean,kickoff_at timestamptz,home_team_id text,away_team_id text); CREATE TABLE bet_markets(id uuid,event_id uuid,player_id text,entity_id text,team_id text,market_type text,period text,side text,line numeric,is_alt_line boolean,raw_provider_metadata jsonb); CREATE TABLE sportsbook_prices(market_id uuid,odds integer,sportsbook text,available boolean,updated_at timestamptz); CREATE TABLE provider_player_mappings(provider text,provider_player_id text,provider_name text,player_id text);`,
      );
      const audit = JSON.parse(
        readFileSync('src/server/providers/unabated/fixtures/transfer.json', 'utf8'),
      );
      const legs = audit.tests[0].pick.legs.map((l: any, i: number) => ({
        ...l,
        kickoffAt: `2099-10-${11 + i}T17:00:00.000Z`,
      }));
      const result = structuredClone(audit.tests[0].result);
      for (const s of result.betSlips)
        for (const b of s.betslipBets)
          b.metadata.timestamp = legs.find((l: any) => l.playerName === b.player)?.kickoffAt;
      for (const l of legs) {
        await db`INSERT INTO sportsbook_events VALUES(${l.eventId},'SPORTSGAMEODDS',false,${l.kickoffAt},${l.homeTeamId},${l.awayTeamId})`;
        await db`INSERT INTO bet_markets VALUES(${l.id},${l.eventId},${l.playerId},${l.playerId},NULL,${l.marketType},'game',${l.side},${l.line},true,'{}')`;
        await db`INSERT INTO sportsbook_prices VALUES(${l.id},${l.odds},'FANDUEL',true,now()),(${l.id},${l.odds},'DRAFTKINGS',true,now()),(${l.id},${l.odds},'BETMGM',true,now()),(${l.id},${l.odds},'CAESARS',true,now())`;
        await db`INSERT INTO provider_player_mappings VALUES('SPORTSGAMEODDS',${l.playerId},${l.playerName},${l.playerId})`;
      }
      const proposals = createProposalService(db);
      const originalIds = legs.map((l: any) => l.id);
      for (const book of ['betmgm', 'caesars'] as const) {
        const proposal = await proposals.propose('test-user', originalIds, book);
        assert(proposal);
        assert.equal(proposal.adjustments, 0);
        await proposals.approve('test-user', book, proposal.token, false);
        await assert.rejects(proposals.approve('other-user', book, proposal.token, true));
      }
      await db`DELETE FROM sportsbook_prices WHERE sportsbook='BETMGM'`;
      const unpriced = await proposals.propose('test-user', originalIds, 'betmgm');
      assert.equal(unpriced, null);
      const disabled = await proposals.inspect('test-user', originalIds, 'draftkings', false);
      assert.equal(disabled.proposal, null);
      assert.equal(disabled.compatibility.storedExactLegs, originalIds.length);
      await db`UPDATE sportsbook_events SET markets_locked=true WHERE id=${legs[0].eventId}`;
      assert.equal(await proposals.propose('test-user', originalIds, 'fanduel'), null);
      await db`UPDATE sportsbook_events SET markets_locked=false`;
      await db`UPDATE provider_player_mappings SET player_id='unmapped' WHERE provider_player_id=${legs[0].playerId}`;
      assert.equal(await proposals.propose('test-user', originalIds, 'fanduel'), null);
      await db`UPDATE provider_player_mappings SET player_id=provider_player_id`;
      await db`UPDATE sportsbook_events SET kickoff_at='2000-01-01' WHERE id=${legs[0].eventId}`;
      assert.equal(await proposals.propose('test-user', originalIds, 'fanduel'), null);
      await db`UPDATE sportsbook_events SET kickoff_at=${legs[0].kickoffAt} WHERE id=${legs[0].eventId}`;
      const exact = await proposals.propose('test-user', originalIds, 'draftkings');
      assert(exact);
      assert.equal(exact.adjustments, 0);
      await proposals.approve('test-user', 'draftkings', exact.token, false);
      await assert.rejects(
        proposals.approve('wrong-user', 'draftkings', exact.token, true),
        /expired or changed/,
      );
      await assert.rejects(
        proposals.approve('test-user', 'fanduel', exact.token, true),
        /expired or changed/,
      );
      const altId = randomUUID(),
        first = legs[0];
      await db`INSERT INTO bet_markets SELECT ${altId}::uuid,event_id,player_id,entity_id,team_id,market_type,period,side,line+1,true,'{}'::jsonb FROM bet_markets WHERE id=${first.id}`;
      await db`INSERT INTO sportsbook_prices VALUES(${altId},-150,'DRAFTKINGS',true,now())`;
      await db`UPDATE sportsbook_prices SET available=false WHERE market_id=${first.id} AND sportsbook='DRAFTKINGS'`;
      const adjusted = await proposals.propose('test-user', originalIds, 'draftkings');
      assert(adjusted);
      assert.equal(adjusted.adjustments, 1);
      await assert.rejects(
        proposals.approve('test-user', 'draftkings', adjusted.token, false),
        /Approve/,
      );
      assert.equal(
        (await proposals.approve('test-user', 'draftkings', adjusted.token, true))[0].id,
        altId,
      );
      await db`UPDATE sportsbook_prices SET odds=-160 WHERE market_id=${altId}`;
      await assert.rejects(
        proposals.approve('test-user', 'draftkings', adjusted.token, true),
        /changed/,
      );
      await db`UPDATE sportsbook_prices SET available=true WHERE market_id=${first.id}`;
      let posts = 0,
        polls = 0,
        mode = 'complete';
      const generatedBooks = new Map<string, string>();
      const client = new UnabatedClient({
        apiKey: 'fixture',
        maxRequests: 100,
        fetcher: async (_url, init) => {
          if (init?.method === 'POST') {
            const prompt = JSON.parse(String(init.body)).content.text;
            assert.doesNotMatch(prompt, /Iowa|Region:/);
            for (const leg of legs) assert(prompt.includes(`${leg.side} ${leg.line}`));
            posts++;
            await new Promise((r) => setTimeout(r, 15));
            const requestId = randomUUID();
            generatedBooks.set(
              requestId,
              ['BetMGM', 'Caesars', 'DraftKings', 'FanDuel'].find((book) =>
                prompt.includes('ONE ' + book),
              )!,
            );
            return Response.json({ status: 'pending', requestId });
          }
          polls++;
          const matched = structuredClone(result);
          const book = generatedBooks.get(String(_url).split('/').at(-1)!);
          for (const slip of matched.betSlips) {
            slip.book = book;
            for (const b of slip.betslipBets) b.deepLink.sportsbook = book;
          }
          return Response.json(mode === 'complete' ? matched : { status: 'Processing' });
        },
      });
      const svc = createTransferService(db, client),
        ids = legs.map((l: any) => l.id);
      process.env.UNABATED_MAX_GENERATIONS_PER_USER_DAY = '5';
      process.env.UNABATED_MAX_GENERATIONS_GLOBAL_DAY = '50';
      process.env.UNABATED_MAX_CONCURRENT_GENERATIONS = '3';
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => svc.start('test-user', ids)),
      );
      assert.equal(new Set(concurrent.map((j) => j.id)).size, 1);
      assert.equal(posts, 1);
      await assert.rejects(svc.start('test-user', [ids[0]]), /already/);
      await assert.rejects(svc.start('test-user', ids, 'UNSPECIFIED', 'draftkings'), /already/);
      const id = concurrent[0].id;
      await assert.rejects(svc.poll('other-user', id), /not found/);
      await assert.rejects(svc.poll('test-user', id, 'draftkings'), /not found/);
      await db`UPDATE fanduel_transfer_jobs SET next_poll_at=now()-interval '1 second' WHERE id=${id}`;
      const completed = await Promise.all(
        Array.from({ length: 4 }, () => svc.poll('test-user', id)),
      );
      assert(completed.every((j) => j.status === 'complete' && j.url));
      assert.equal(polls, 1);
      await svc.start('test-user', [...ids].reverse());
      assert.equal(posts, 1);
      const dkJob = await svc.start('test-user', ids, 'UNSPECIFIED', 'draftkings');
      assert.notEqual(dkJob.id, id);
      await db`UPDATE fanduel_transfer_jobs SET next_poll_at=now()-interval '1 second' WHERE id=${dkJob.id}`;
      const dkComplete = await svc.poll('test-user', dkJob.id, 'draftkings');
      assert.equal(dkComplete.status, 'complete');
      assert(dkComplete.url);
      assert.equal(posts, 2);
      await svc.start('test-user', ids, 'UNSPECIFIED', 'draftkings');
      assert.equal(posts, 2);
      await assert.rejects(svc.start('test-user', ids, 'UNSPECIFIED', 'betmgm'), /missing|locked/);
      assert.equal(posts, 2);
      await db`UPDATE sportsbook_prices SET available=false WHERE market_id=${ids[0]}`;
      // Cached links are withdrawn when the stored complete slip is no longer available.
      assert.equal((await svc.poll('test-user', id)).status, 'failed');
      await db`UPDATE sportsbook_prices SET available=true`;
      await db`UPDATE bet_markets SET line=line+1 WHERE id=${ids[0]}`;
      assert.equal((await svc.poll('test-user', id)).status, 'failed');
      await db`UPDATE bet_markets SET line=line-1 WHERE id=${ids[0]}`;
      await db`UPDATE fanduel_transfer_jobs SET expires_at=now()-interval '1 second'`;
      assert.equal((await svc.poll('test-user', id)).status, 'failed');
      process.env.UNABATED_MAX_GENERATIONS_PER_USER_DAY = '1';
      await assert.rejects(svc.start('test-user', ids), /budget/);
      await assert.rejects(svc.start('test-user', ids, 'UNSPECIFIED', 'draftkings'), /budget/);
      process.env.UNABATED_MAX_GENERATIONS_PER_USER_DAY = '5';
      process.env.UNABATED_MAX_GENERATIONS_GLOBAL_DAY = '1';
      await assert.rejects(svc.start('another', ids), /budget/);
      process.env.UNABATED_MAX_GENERATIONS_GLOBAL_DAY = '50';
      process.env.UNABATED_MAX_CONCURRENT_GENERATIONS = '1';
      mode = 'processing';
      const next = await svc.start('another', ids);
      await assert.rejects(svc.start('third', ids), /busy/);
      await db`UPDATE fanduel_transfer_jobs SET next_poll_at=now()+interval '1 hour' WHERE id=${next.id}`;
      const before = polls;
      await svc.poll('another', next.id);
      assert.equal(polls, before);
      await db`UPDATE fanduel_transfer_jobs SET poll_count=25 WHERE id=${next.id}`;
      assert.equal((await svc.poll('another', next.id)).status, 'failed');
      await db`TRUNCATE fanduel_transfer_jobs`;
      process.env.UNABATED_MAX_GENERATIONS_GLOBAL_DAY = '1';
      process.env.UNABATED_MAX_CONCURRENT_GENERATIONS = '3';
      const race = await Promise.allSettled(
        (['betmgm', 'caesars', 'draftkings', 'fanduel'] as const).map((book) =>
          svc.start('race-' + book, ids, 'UNSPECIFIED', book),
        ),
      );
      assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
      const [count] = await db`SELECT count(*)::int AS n FROM fanduel_transfer_jobs`;
      assert.equal(count.n, 1);
    } finally {
      for (const [key, value] of Object.entries({
        UNABATED_MAX_GENERATIONS_PER_USER_DAY: prior.user,
        UNABATED_MAX_GENERATIONS_GLOBAL_DAY: prior.global,
        UNABATED_MAX_CONCURRENT_GENERATIONS: prior.concurrent,
        UNABATED_PARTNER_CODE: prior.partner,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await db.end();
      await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
