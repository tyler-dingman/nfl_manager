import Stripe from 'stripe';
import { authDb } from '@/server/auth/database';

export const STRIPE_WEBHOOK_EVENT_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
] as const;

export function stripePaymentResult(type: string) {
  if (type === 'payment_intent.succeeded') return 'PAID' as const;
  if (type === 'payment_intent.payment_failed') return 'FAILED' as const;
  if (type === 'payment_intent.canceled') return 'CANCELED' as const;
  return null;
}

export function validateStripePaymentIntent(
  intent: Pick<Stripe.PaymentIntent, 'amount' | 'currency' | 'metadata'>,
  order: { id: string; totalCents: number; currency: string } | null,
) {
  const orderId = intent.metadata?.orderId;
  if (!orderId) throw new Error('Stripe PaymentIntent is missing orderId metadata.');
  if (!order || order.id !== orderId) throw new Error('D&D order was not found.');
  if (intent.amount !== order.totalCents)
    throw new Error('Stripe amount does not match order total.');
  if (intent.currency.toLowerCase() !== order.currency.toLowerCase())
    throw new Error('Stripe currency does not match order currency.');
  return orderId;
}

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  if ((process.env.STRIPE_MODE ?? 'test') !== 'test')
    throw new Error('Only Stripe test mode is enabled.');
  if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a test-mode key.');
  return new Stripe(key);
}

export function constructStripeWebhookEvent(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
}

export async function createStripePaymentIntentForOrder(order: {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency?: string;
}) {
  return stripeClient().paymentIntents.create({
    amount: order.totalCents,
    currency: order.currency ?? 'usd',
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    automatic_payment_methods: { enabled: true },
  });
}

export type StripeWebhookResult =
  | { result: 'PAID' | 'FAILED' | 'CANCELED'; orderNumber: string }
  | { result: 'DUPLICATE' | 'IGNORED'; orderNumber: null };

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookResult> {
  const sql = authDb();
  const paymentResult = stripePaymentResult(event.type);
  if (!paymentResult) {
    await sql`INSERT INTO commerce_stripe_webhook_events(stripe_event_id,event_type,status,result,processed_at)
      VALUES(${event.id},${event.type},'IGNORED','UNSUPPORTED',now()) ON CONFLICT(stripe_event_id) DO NOTHING`;
    return { result: 'IGNORED', orderNumber: null };
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const orderId = intent.metadata?.orderId;
  if (!orderId) throw new Error('Stripe PaymentIntent is missing orderId metadata.');

  return sql.begin(async (tx) => {
    const claimed =
      await tx`INSERT INTO commerce_stripe_webhook_events(stripe_event_id,event_type,status)
      VALUES(${event.id},${event.type},'RECEIVED') ON CONFLICT(stripe_event_id) DO NOTHING RETURNING stripe_event_id`;
    if (!claimed.length) return { result: 'DUPLICATE', orderNumber: null } as const;

    const [order] = await tx<
      any[]
    >`SELECT id,order_number,total_cents,currency,payment_status,fulfillment_status
      FROM commerce_orders WHERE id=${orderId} FOR UPDATE`;
    validateStripePaymentIntent(
      intent,
      order ? { id: order.id, totalCents: order.total_cents, currency: order.currency } : null,
    );

    let result: 'PAID' | 'FAILED' | 'CANCELED';
    if (event.type === 'payment_intent.succeeded') {
      result = 'PAID';
      await tx`UPDATE commerce_orders SET status='PAID',payment_status='PAID',payment_provider='STRIPE',
        payment_reference=${intent.id},stripe_payment_intent_id=${intent.id},paid_at=COALESCE(paid_at,now()),updated_at=now()
        WHERE id=${orderId}`;
    } else if (event.type === 'payment_intent.payment_failed') {
      result = 'FAILED';
      await tx`UPDATE commerce_orders SET payment_status='FAILED',payment_provider='STRIPE',
        payment_reference=${intent.id},stripe_payment_intent_id=${intent.id},updated_at=now()
        WHERE id=${orderId} AND payment_status<>'PAID'`;
    } else {
      result = 'CANCELED';
      const [canceled] = await tx<
        any[]
      >`UPDATE commerce_orders SET status='CANCELED',payment_status='CANCELED',
        fulfillment_status='CANCELED',payment_provider='STRIPE',payment_reference=${intent.id},
        stripe_payment_intent_id=${intent.id},canceled_at=COALESCE(canceled_at,now()),updated_at=now()
        WHERE id=${orderId} AND payment_status NOT IN ('PAID','CANCELED')
          AND fulfillment_status IN ('NEW','PICKING','PACKED') RETURNING id`;
      if (canceled)
        await tx`UPDATE commerce_product_variants v SET inventory_reserved=GREATEST(0,v.inventory_reserved-i.quantity),updated_at=now()
          FROM commerce_order_items i WHERE i.order_id=${orderId} AND i.variant_id=v.id`;
    }
    await tx`UPDATE commerce_stripe_webhook_events SET status='PROCESSED',order_id=${orderId},result=${result},processed_at=now()
      WHERE stripe_event_id=${event.id}`;
    console.info(
      JSON.stringify({
        service: 'stripe-webhook',
        eventId: event.id,
        eventType: event.type,
        orderNumber: order.order_number,
        result,
      }),
    );
    return { result, orderNumber: order.order_number };
  });
}
