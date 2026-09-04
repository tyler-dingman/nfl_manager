import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Stripe from 'stripe';
import {
  constructStripeWebhookEvent,
  stripePaymentResult,
  validateStripePaymentIntent,
} from './stripe';

test('valid Stripe signature is accepted and an invalid signature is rejected', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalMode = process.env.STRIPE_MODE;
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_only';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_only';
  process.env.STRIPE_MODE = 'test';
  const payload = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: { object: {} },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  assert.equal(constructStripeWebhookEvent(payload, signature).id, 'evt_test');
  assert.throws(() => constructStripeWebhookEvent(payload, 't=1,v1=invalid'));
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  if (originalMode === undefined) delete process.env.STRIPE_MODE;
  else process.env.STRIPE_MODE = originalMode;
});

test('only the three requested Stripe PaymentIntent events map to payment states', () => {
  assert.equal(stripePaymentResult('payment_intent.succeeded'), 'PAID');
  assert.equal(stripePaymentResult('payment_intent.payment_failed'), 'FAILED');
  assert.equal(stripePaymentResult('payment_intent.canceled'), 'CANCELED');
  assert.equal(stripePaymentResult('charge.refunded'), null);
});

test('PaymentIntent validation requires canonical metadata, amount, and currency', () => {
  const order = { id: 'order-1', totalCents: 4200, currency: 'usd' };
  assert.equal(
    validateStripePaymentIntent(
      { amount: 4200, currency: 'usd', metadata: { orderId: 'order-1', orderNumber: 'DND-1' } },
      order,
    ),
    'order-1',
  );
  assert.throws(
    () => validateStripePaymentIntent({ amount: 4200, currency: 'usd', metadata: {} }, order),
    /orderId/,
  );
  assert.throws(
    () =>
      validateStripePaymentIntent(
        { amount: 4200, currency: 'usd', metadata: { orderId: 'missing' } },
        null,
      ),
    /not found/,
  );
  assert.throws(
    () =>
      validateStripePaymentIntent(
        { amount: 4100, currency: 'usd', metadata: { orderId: 'order-1' } },
        order,
      ),
    /amount/,
  );
  assert.throws(
    () =>
      validateStripePaymentIntent(
        { amount: 4200, currency: 'eur', metadata: { orderId: 'order-1' } },
        order,
      ),
    /currency/,
  );
});

test('webhook persistence protects duplicate delivery and cancellation inventory release', () => {
  const source = readFileSync('src/server/commerce/stripe.ts', 'utf8');
  assert.match(source, /ON CONFLICT\(stripe_event_id\) DO NOTHING/);
  assert.match(source, /payment_status NOT IN \('PAID','CANCELED'\)/);
  assert.match(source, /inventory_reserved=GREATEST\(0,v\.inventory_reserved-i\.quantity\)/);
  assert.doesNotMatch(
    source.slice(
      source.indexOf("event.type === 'payment_intent.succeeded'"),
      source.indexOf("event.type === 'payment_intent.payment_failed'"),
    ),
    /inventory_/,
  );
});

test('public webhook route uses raw request text and no session authentication', () => {
  const source = readFileSync('src/app/api/commerce/stripe/webhook/route.ts', 'utf8');
  assert.match(source, /request\.text\(\)/);
  assert.match(source, /stripe-signature/);
  assert.doesNotMatch(source, /currentUser|isAllowedAdminUser|assertSameOrigin/);
});
