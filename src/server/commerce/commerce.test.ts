import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { demoPaymentProvider, demoTaxProvider, manualShippingProvider } from './providers';
import { demoExpressProviders } from '../../features/merch/express-checkout';
test('demo payment succeeds or declines without accepting card data', async () => {
  assert.equal((await demoPaymentProvider.createPayment({ amountCents: 1000 })).status, 'PAID');
  assert.equal(
    (await demoPaymentProvider.createPayment({ amountCents: 1000, fixture: 'DECLINED' })).status,
    'DECLINED',
  );
});
test('demo shipping and tax calculations are deterministic', () => {
  assert.equal(manualShippingProvider.quote('STANDARD').amountCents, 699);
  assert.equal(manualShippingProvider.quote('EXPRESS').amountCents, 1299);
  assert.deepEqual(demoTaxProvider.calculate({ subtotalCents: 10000, discountCents: 1000 }), {
    amountCents: 743,
    estimated: true,
  });
});
test('commerce schema separates payment and fulfillment and normalizes inventory', () => {
  const sql = readFileSync('db/migrations/023_commerce.sql', 'utf8');
  assert.match(sql, /payment_status/);
  assert.match(sql, /fulfillment_status/);
  assert.match(sql, /inventory_on_hand/);
  assert.match(sql, /inventory_reserved/);
  assert.match(sql, /commerce_order_items/);
  assert.doesNotMatch(sql, /card_number|card_cvc/i);
});
test('commerce hardening schema adds refund lifecycle and reservation state', () => {
  const sql = readFileSync('db/migrations/026_commerce_payment_hardening.sql', 'utf8');
  for (const status of ['PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
    assert.match(sql, new RegExp(`'${status}'`));
  assert.match(sql, /CREATE TABLE IF NOT EXISTS commerce_refunds/);
  assert.match(sql, /request_id uuid UNIQUE/);
  assert.match(sql, /stripe_refund_id text UNIQUE/);
  assert.match(sql, /inventory_reservation_status/);
});
test('shipping reduces on-hand and reserved inventory while cancel releases reservation', () => {
  const source = readFileSync('src/server/commerce/orders.ts', 'utf8');
  assert.match(source, /inventory_on_hand=inventory_on_hand-/);
  assert.match(source, /inventory_reserved=inventory_reserved-/);
  assert.match(source, /if \(input\.action === 'CANCEL'\)/);
  assert.match(source, /\['PAID', 'PARTIALLY_REFUNDED'\]\.includes/);
});
test('admin commerce APIs use the canonical admin allowlist', () => {
  for (const file of [
    'src/app/api/admin/commerce/route.ts',
    'src/app/api/admin/commerce/orders/[orderId]/route.ts',
    'src/app/api/admin/commerce/orders/[orderId]/refunds/route.ts',
    'src/app/api/admin/commerce/inventory/[variantId]/route.ts',
    'src/app/api/admin/commerce/products/route.ts',
  ])
    assert.match(readFileSync(file, 'utf8'), /isAllowedAdminUser/);
});

test('all demo express providers return wallet contact and shipping details', async () => {
  for (const id of ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY'] as const) {
    const profile = await demoExpressProviders[id].startCheckout();
    assert.match(profile.email, /@/);
    assert.ok(profile.address1);
    assert.deepEqual(await demoExpressProviders[id].confirmOrder(), { authorized: true });
  }
});

test('checkout entry presents promo before wallets and keeps required address fields in standard checkout', () => {
  const source = readFileSync('src/components/merch/merch-cart.tsx', 'utf8');
  const entry = source.slice(
    source.indexOf('function CheckoutEntry'),
    source.indexOf('function ExpressReview'),
  );
  assert.ok(entry.indexOf('Have a promo code?') < entry.indexOf('Express checkout'));
  assert.doesNotMatch(entry, /name="address1"|name="email"/);
  assert.match(source, /checkoutStage === 'standard'/);
  assert.match(source, /<Field name="email"[^>]+required/);
  assert.match(source, /<Field name="address1"[^>]+required/);
  assert.match(source, /checkoutStage === 'express-review'/);
});

test('migration runner includes Stripe checkout attempts after webhook support', () => {
  const runner = readFileSync('scripts/migrate-auth.ts', 'utf8');
  assert.ok(
    runner.indexOf('024_stripe_webhooks.sql') < runner.indexOf('025_stripe_checkout_attempts.sql'),
  );
  assert.ok(
    runner.indexOf('025_stripe_checkout_attempts.sql') <
      runner.indexOf('026_commerce_payment_hardening.sql'),
  );
});

test('express checkout uses official payment marks with accessible labels and text fallbacks', () => {
  const cart = readFileSync('src/components/merch/merch-cart.tsx', 'utf8');
  const marks = readFileSync('src/components/merch/payment-brand-mark.tsx', 'utf8');
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(cart, /aria-label={`Checkout with/);
  assert.match(marks, /paypalobjects\.com/);
  assert.match(
    marks,
    /developers\.google\.com\/static\/pay\/api\/images\/brand-guidelines\/google-pay-mark\.png/,
  );
  assert.match(marks, /onError/);
  assert.match(css, /-webkit-appearance: -apple-pay-button/);
});
