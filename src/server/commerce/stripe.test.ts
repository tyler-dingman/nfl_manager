import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Stripe from 'stripe';
import {
  constructStripeWebhookEvent,
  stripePaymentIntentParams,
  stripePaymentResult,
  validateStripePaymentIntent,
} from './stripe';

test('PaymentIntent uses the authoritative order amount and canonical metadata', () => {
  assert.deepEqual(
    stripePaymentIntentParams({
      id: 'order-1',
      orderNumber: 'DND-1042',
      totalCents: 5273,
      currency: 'usd',
    }),
    {
      amount: 5273,
      currency: 'usd',
      metadata: { orderId: 'order-1', orderNumber: 'DND-1042' },
      payment_method_types: ['card'],
    },
  );
});

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

test('card checkout is server-created, idempotent, and cannot use the demo endpoint', () => {
  const orders = readFileSync('src/server/commerce/orders.ts', 'utf8');
  const checkoutRoute = readFileSync('src/app/api/commerce/checkout/route.ts', 'utf8');
  const stripeRoute = readFileSync('src/app/api/commerce/stripe/checkout/route.ts', 'utf8');
  const migration = readFileSync('db/migrations/025_stripe_checkout_attempts.sql', 'utf8');
  assert.match(orders, /'NEW','PENDING','NEW','STRIPE'/);
  assert.match(orders, /pg_advisory_xact_lock/);
  assert.match(orders, /checkout_attempt_id/);
  assert.match(migration, /UNIQUE INDEX[\s\S]+checkout_attempt_id/);
  assert.match(stripeRoute, /createStripeCheckout/);
  assert.doesNotMatch(checkoutRoute, /'CARD'/);
});

test('client confirms through Stripe Elements and waits for webhook PAID state', () => {
  const payment = readFileSync('src/components/merch/stripe-card-payment.tsx', 'utf8');
  const cart = readFileSync('src/components/merch/merch-cart.tsx', 'utf8');
  assert.match(payment, /PaymentElement/);
  assert.match(payment, /stripe\.confirmPayment/);
  assert.match(payment, /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(payment, /STRIPE_SECRET_KEY|sk_test_/);
  assert.match(cart, /paymentStatus === 'PAID'/);
  assert.ok(
    cart.indexOf("paymentStatus === 'PAID'") < cart.indexOf('setOrder(stripeCheckout.order)'),
  );
  assert.match(cart, /Payment didn't go through/);
});
