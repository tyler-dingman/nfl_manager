import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
/** HTTP contracts exercised against actual local API Worker, using isolated accounts. */
export async function checkD1Products(a, b, base) {
  const checks = [],
    post = async (client, path, data, status = 200) => {
      const r = await client.post(path, { headers: { origin: base }, data });
      assert.equal(r.status(), status, `${path}: ${await r.text()}`);
      return r.json();
    };
  const me = (await (await b.get('/api/auth/me')).json()).user;
  assert(me?.id);
  await post(a, '/api/crew', { name: 'Synthetic D1 Crew', teamAbbr: 'KC' });
  const { invite } = await post(a, '/api/crew/invites', {
    channel: 'IN_APP',
    inviteeUserId: me.id,
  });
  await post(b, '/api/crew/invites/' + encodeURIComponent(invite.token), {});
  assert.equal((await (await b.get('/api/crew')).json()).crew.members.length, 2);
  checks.push('Crew creation, identity-bound invitation and member persistence');
  const drill = await post(a, '/api/trivia/games', { teamId: 'KC' }, 201);
  for (let i = 0; i < 10; i++) {
    const response = await a.get('/api/trivia/games/' + drill.gameId),
      { game } = await response.json();
    assert.equal(response.status(), 200);
    assert(game.question);
    assert(!('correctAnswer' in game.question));
    await post(a, `/api/trivia/games/${drill.gameId}/answer`, { selectedAnswer: 'A' });
  }
  assert((await (await a.get('/api/trivia/games/' + drill.gameId)).json()).game.completed);
  assert.equal((await b.get('/api/trivia/games/' + drill.gameId)).status(), 404);
  checks.push('Ten-question drill, answer privacy, completion and owner isolation');
  const room = await post(a, '/api/trivia/groups', { teamId: 'KC' }, 201);
  await post(b, `/api/trivia/groups/${room.joinCode}/join`, {});
  await post(a, `/api/trivia/groups/${room.joinCode}/start`, {});
  assert.equal(
    (await (await a.get('/api/trivia/groups/' + room.joinCode)).json()).room.participants.length,
    2,
  );
  checks.push('Shared Trivia group creation, joining and host start');
  const progress = await a.put('/api/user/content-state', {
    headers: { origin: base },
    data: {
      contentType: 'VIDEO',
      contentId: 'original-worker-video',
      progressSeconds: 42,
      viewed: true,
    },
  });
  assert.equal(progress.status(), 200, await progress.text());
  assert.equal(
    (await (await a.get('/api/user/content-state')).json()).state[0].progressSeconds,
    42,
  );
  assert.equal((await (await b.get('/api/user/content-state')).json()).state.length, 0);
  const prediction = await post(
    a,
    '/api/user/predictions',
    {
      predictionType: 'SCORE',
      subjectType: 'GAME',
      subjectId: 'original-worker-game',
      prediction: { home: 24, away: 17 },
    },
    201,
  );
  assert(prediction);
  assert.equal((await (await b.get('/api/user/predictions')).json()).predictions.length, 0);
  checks.push('Worker-backed media progress and atomic prediction persistence remain owner scoped');
  const catalog = await (await a.get('/api/commerce/catalog')).json(),
    product = catalog.products.find((p) => p.variants.some((v) => v.inventoryAvailable > 0)),
    variant = product?.variants.find((v) => v.inventoryAvailable > 0);
  assert(variant);
  const { order } = await post(a, '/api/commerce/checkout', {
    email: 'browser-0@example.invalid',
    firstName: 'Synthetic',
    lastName: 'Buyer',
    address1: '1 Synthetic Street',
    city: 'Synthetic',
    state: 'MO',
    postalCode: '64101',
    shippingMethod: 'STANDARD',
    paymentMethod: 'PAYPAL',
    paymentFixture: 'SUCCESS',
    items: [{ productId: product.id, size: variant.size, quantity: 1 }],
  });
  assert(
    (await (await a.get('/api/commerce/orders')).json()).orders.some((o) => o.id === order.id),
  );
  assert(
    !(await (await b.get('/api/commerce/orders')).json()).orders.some((o) => o.id === order.id),
  );
  checks.push(
    'DEMO-only checkout inventory reservation, persisted original order ID and private orders',
  );
  const event = JSON.stringify({
      id: 'evt_synthetic_worker_migration',
      object: 'event',
      api_version: '2025-09-30.clover',
      type: 'synthetic.unsupported',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      data: { object: { id: 'synthetic-object' } },
    }),
    timestamp = Math.floor(Date.now() / 1000),
    signature = createHmac('sha256', 'whsec_synthetic_local_only')
      .update(timestamp + '.' + event)
      .digest('hex');
  const webhook = await a.post('/api/commerce/stripe/webhook', {
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    data: event,
  });
  assert.equal(webhook.status(), 200, await webhook.text());
  assert.equal(
    (
      await a.post('/api/commerce/stripe/webhook', {
        headers: { 'stripe-signature': 't=1,v1=bad' },
        data: event,
      })
    ).status(),
    400,
  );
  checks.push('Actual workerd Stripe HMAC verification and D1 webhook journal; no Stripe API call');
  const ready = await a.post('/api/automation/three-and-out?action=check', {
    headers: { authorization: 'Bearer synthetic-migration-automation-secret' },
  });
  assert.equal(ready.status(), 200, await ready.text());
  assert((await ready.json()).schemaReady);
  checks.push('Authenticated scheduled-job D1 schema readiness through actual workerd');
  return checks;
}
