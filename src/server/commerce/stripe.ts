import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { authDb } from '@/server/auth/database';
import { recordSecurityEvent } from '@/server/security/audit';

export const STRIPE_WEBHOOK_EVENT_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'refund.created',
  'refund.updated',
] as const;

export function stripePaymentResult(type: string) {
  if (type === 'payment_intent.succeeded') return 'PAID' as const;
  if (type === 'payment_intent.payment_failed') return 'FAILED' as const;
  if (type === 'payment_intent.canceled') return 'CANCELED' as const;
  return null;
}

export function stripeRefundStatus(status: string | null) {
  if (status === 'succeeded') return 'SUCCEEDED' as const;
  if (status === 'failed') return 'FAILED' as const;
  if (status === 'canceled') return 'CANCELED' as const;
  if (status === 'requires_action') return 'REQUIRES_ACTION' as const;
  return 'PENDING' as const;
}

export function refundedPaymentStatus(totalCents: number, refundedCents: number) {
  if (refundedCents <= 0) return 'PAID' as const;
  return refundedCents >= totalCents ? ('REFUNDED' as const) : ('PARTIALLY_REFUNDED' as const);
}

export function stripePaymentEventIsStale(
  eventCreated: number,
  lastEventCreated?: number | null,
  paymentAttemptStartedAt?: Date | string | null,
) {
  const attemptStarted = paymentAttemptStartedAt
    ? Math.floor(new Date(paymentAttemptStartedAt).getTime() / 1000)
    : 0;
  return eventCreated < Math.max(lastEventCreated ?? 0, attemptStarted);
}

export function validateStripePaymentIntent(
  intent: Pick<Stripe.PaymentIntent, 'id' | 'amount' | 'currency' | 'metadata'>,
  order: {
    id: string;
    totalCents: number;
    currency: string;
    paymentProvider?: string;
    stripePaymentIntentId?: string | null;
  } | null,
) {
  const orderId = intent.metadata?.orderId;
  if (!orderId) throw new Error('Stripe PaymentIntent is missing orderId metadata.');
  if (!order || order.id !== orderId) throw new Error('D&D order was not found.');
  if (order.paymentProvider && order.paymentProvider !== 'STRIPE')
    throw new Error('D&D order is not assigned to Stripe.');
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== intent.id)
    throw new Error('Stripe PaymentIntent does not match the D&D order.');
  if (intent.amount !== order.totalCents)
    throw new Error('Stripe amount does not match order total.');
  if (intent.currency.toLowerCase() !== order.currency.toLowerCase())
    throw new Error('Stripe currency does not match order currency.');
  return orderId;
}

export function stripePaymentIntentParams(order: {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency?: string;
}): Stripe.PaymentIntentCreateParams {
  return {
    amount: order.totalCents,
    currency: order.currency ?? 'usd',
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    payment_method_types: ['card'],
  };
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
  return stripeClient().paymentIntents.create(stripePaymentIntentParams(order), {
    idempotencyKey: `dnd-checkout-${order.id}`,
  });
}

function paymentIntentId(refund: Stripe.Refund) {
  return typeof refund.payment_intent === 'string'
    ? refund.payment_intent
    : refund.payment_intent?.id;
}

async function reconcileRefundedTotal(sql: any, orderId: string) {
  const [order] = await sql<any[]>`
    SELECT total_cents FROM commerce_orders WHERE id=${orderId} FOR UPDATE`;
  if (!order) throw new Error('D&D order was not found.');
  const [refunds] = await sql<any[]>`
    SELECT COALESCE(sum(amount_cents) FILTER(WHERE status='SUCCEEDED'),0)::int refunded_cents
    FROM commerce_refunds WHERE order_id=${orderId}`;
  const refundedCents = refunds?.refunded_cents ?? 0;
  const paymentStatus = refundedPaymentStatus(order.total_cents, refundedCents);
  await sql`UPDATE commerce_orders
    SET refunded_total_cents=${refundedCents},payment_status=${paymentStatus},updated_at=now()
    WHERE id=${orderId}`;
  return { paymentStatus, refundedCents: refundedCents as number };
}

async function processStripeRefundEvent(event: Stripe.Event) {
  const refund = event.data.object as Stripe.Refund;
  const intentId = paymentIntentId(refund);
  if (!intentId) throw new Error('Stripe refund is missing a PaymentIntent.');
  const sql = authDb();
  return sql.begin(async (tx) => {
    const claimed = await tx`
      INSERT INTO commerce_stripe_webhook_events(stripe_event_id,event_type,status)
      VALUES(${event.id},${event.type},'RECEIVED')
      ON CONFLICT(stripe_event_id) DO NOTHING RETURNING stripe_event_id`;
    if (!claimed.length) return { result: 'DUPLICATE', orderNumber: null } as const;
    const [order] = await tx<any[]>`
      SELECT id,order_number,total_cents,currency,payment_provider,stripe_payment_intent_id
      FROM commerce_orders WHERE stripe_payment_intent_id=${intentId} FOR UPDATE`;
    if (!order) throw new Error('Refunded D&D order was not found.');
    if (order.payment_provider !== 'STRIPE' || order.stripe_payment_intent_id !== intentId)
      throw new Error('Stripe refund does not match the D&D payment relationship.');
    if (refund.currency.toLowerCase() !== order.currency.toLowerCase())
      throw new Error('Stripe refund currency does not match order currency.');
    if (refund.amount > order.total_cents)
      throw new Error('Stripe refund amount exceeds order total.');

    const status = stripeRefundStatus(refund.status);
    const requestId = refund.metadata?.refundRequestId;
    const validRequestId =
      requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
        ? requestId
        : null;
    const adminId = refund.metadata?.adminUserId;
    const validAdminId =
      adminId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adminId)
        ? adminId
        : null;
    if (validRequestId)
      await tx`UPDATE commerce_refunds SET stripe_refund_id=${refund.id},amount_cents=${refund.amount},
        currency=${refund.currency},status=${status},reason=COALESCE(${refund.metadata?.reason ?? refund.reason ?? null},reason),
        failure_reason=${refund.failure_reason ?? null},stripe_created_at=to_timestamp(${refund.created}),
        stripe_event_created_at=${event.created},updated_at=now() WHERE request_id=${validRequestId}
        AND (stripe_event_created_at IS NULL OR stripe_event_created_at<=${event.created})`;
    await tx`INSERT INTO commerce_refunds(
      id,request_id,order_id,stripe_refund_id,stripe_payment_intent_id,amount_cents,currency,status,
      reason,failure_reason,created_by_user_id,stripe_created_at,stripe_event_created_at
    ) VALUES(
      ${randomUUID()},${validRequestId},${order.id},${refund.id},${intentId},${refund.amount},
      ${refund.currency},${status},${refund.metadata?.reason ?? refund.reason ?? null},
      ${refund.failure_reason ?? null},${validAdminId},to_timestamp(${refund.created}),${event.created}
    ) ON CONFLICT(stripe_refund_id) DO UPDATE SET
      amount_cents=EXCLUDED.amount_cents,currency=EXCLUDED.currency,status=EXCLUDED.status,
      failure_reason=EXCLUDED.failure_reason,stripe_event_created_at=EXCLUDED.stripe_event_created_at,
      updated_at=now()
      WHERE commerce_refunds.stripe_event_created_at IS NULL
        OR commerce_refunds.stripe_event_created_at<=EXCLUDED.stripe_event_created_at`;
    const totals = await reconcileRefundedTotal(tx, order.id);
    await tx`UPDATE commerce_stripe_webhook_events
      SET status='PROCESSED',order_id=${order.id},result=${totals.paymentStatus},processed_at=now()
      WHERE stripe_event_id=${event.id}`;
    console.info(
      JSON.stringify({
        service: 'stripe-webhook',
        eventId: event.id,
        eventType: event.type,
        orderNumber: order.order_number,
        refundId: refund.id,
        amountCents: refund.amount,
        result: status,
      }),
    );
    return { result: totals.paymentStatus, orderNumber: order.order_number } as const;
  });
}

export async function createStripeRefund(input: {
  orderId: string;
  adminUserId: string;
  requestId: string;
  amountCents?: number;
  reason?: string;
}) {
  const sql = authDb();
  const prepared = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${input.requestId}))`;
    const [existing] = await tx<any[]>`
      SELECT r.*,o.order_number,o.total_cents FROM commerce_refunds r
      JOIN commerce_orders o ON o.id=r.order_id WHERE r.request_id=${input.requestId}`;
    if (existing) return existing;
    const [order] = await tx<any[]>`
      SELECT id,order_number,total_cents,currency,payment_status,payment_provider,
        stripe_payment_intent_id,refunded_total_cents
      FROM commerce_orders WHERE id=${input.orderId} FOR UPDATE`;
    if (!order) throw new Error('Order not found.');
    if (order.payment_provider !== 'STRIPE' || !order.stripe_payment_intent_id)
      throw new Error('Only Stripe orders can be refunded.');
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.payment_status))
      throw new Error('Only paid Stripe orders can be refunded.');
    const [reserved] = await tx<any[]>`
      SELECT COALESCE(sum(amount_cents) FILTER(WHERE status IN ('PENDING','REQUIRES_ACTION','SUCCEEDED')),0)::int amount
      FROM commerce_refunds WHERE order_id=${order.id}`;
    const remaining = order.total_cents - (reserved?.amount ?? 0);
    const amount = input.amountCents ?? remaining;
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error('Refund amount must be greater than zero.');
    if (amount > remaining)
      throw new Error('Refund amount exceeds the remaining refundable total.');
    const [refund] = await tx<any[]>`
      INSERT INTO commerce_refunds(
        id,request_id,order_id,stripe_payment_intent_id,amount_cents,currency,status,reason,
        created_by_user_id
      ) VALUES(
        ${randomUUID()},${input.requestId},${order.id},${order.stripe_payment_intent_id},${amount},
        ${order.currency},'PENDING',${input.reason ?? null},${input.adminUserId}
      ) RETURNING *`;
    return { ...refund, order_number: order.order_number, total_cents: order.total_cents };
  });

  if (prepared.stripe_refund_id) return prepared;
  try {
    const refund = await stripeClient().refunds.create(
      {
        payment_intent: prepared.stripe_payment_intent_id,
        amount: prepared.amount_cents,
        reason: 'requested_by_customer',
        metadata: {
          orderId: prepared.order_id,
          orderNumber: prepared.order_number,
          refundRequestId: input.requestId,
          adminUserId: input.adminUserId,
          reason: input.reason ?? '',
        },
      },
      { idempotencyKey: `dnd-refund-${input.requestId}` },
    );
    await sql`UPDATE commerce_refunds SET stripe_refund_id=${refund.id},
      status=${stripeRefundStatus(refund.status)},failure_reason=${refund.failure_reason ?? null},
      stripe_created_at=to_timestamp(${refund.created}),updated_at=now()
      WHERE request_id=${input.requestId}`;
    await sql.begin((tx) => reconcileRefundedTotal(tx, prepared.order_id));
    await recordSecurityEvent(input.adminUserId, 'COMMERCE_REFUND_REQUESTED', {
      metadata: {
        orderId: prepared.order_id,
        refundId: refund.id,
        amountCents: prepared.amount_cents,
      },
    });
    console.info(
      JSON.stringify({
        service: 'commerce-refund',
        orderNumber: prepared.order_number,
        refundId: refund.id,
        amountCents: prepared.amount_cents,
        result: stripeRefundStatus(refund.status),
      }),
    );
    return {
      id: prepared.id,
      stripe_refund_id: refund.id,
      amount_cents: prepared.amount_cents,
      status: stripeRefundStatus(refund.status),
    };
  } catch (error) {
    await sql`UPDATE commerce_refunds SET status='FAILED',failure_reason=${
      error instanceof Error ? error.message.slice(0, 240) : 'Stripe refund request failed'
    },updated_at=now() WHERE request_id=${input.requestId} AND stripe_refund_id IS NULL`;
    throw error;
  }
}

export type StripeWebhookResult =
  | {
      result: 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
      orderNumber: string;
    }
  | { result: 'DUPLICATE' | 'IGNORED'; orderNumber: null };

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookResult> {
  if (event.type === 'refund.created' || event.type === 'refund.updated')
    return processStripeRefundEvent(event);
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
    const claimed = await tx`
      INSERT INTO commerce_stripe_webhook_events(stripe_event_id,event_type,status)
      VALUES(${event.id},${event.type},'RECEIVED')
      ON CONFLICT(stripe_event_id) DO NOTHING RETURNING stripe_event_id`;
    if (!claimed.length) return { result: 'DUPLICATE', orderNumber: null } as const;

    const [order] = await tx<any[]>`
      SELECT id,order_number,total_cents,currency,payment_status,payment_provider,
        stripe_payment_intent_id,fulfillment_status,inventory_reservation_status,
        stripe_payment_event_created_at,payment_attempt_started_at
      FROM commerce_orders WHERE id=${orderId} FOR UPDATE`;
    validateStripePaymentIntent(
      intent,
      order
        ? {
            id: order.id,
            totalCents: order.total_cents,
            currency: order.currency,
            paymentProvider: order.payment_provider,
            stripePaymentIntentId: order.stripe_payment_intent_id,
          }
        : null,
    );

    const stale = stripePaymentEventIsStale(
      event.created,
      order.stripe_payment_event_created_at,
      order.payment_attempt_started_at,
    );
    const settled = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.payment_status);
    let result: 'PAID' | 'FAILED' | 'CANCELED';
    if (event.type === 'payment_intent.succeeded') {
      result = 'PAID';
      if (!['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.payment_status)) {
        if (order.inventory_reservation_status === 'RELEASED') {
          const shortages = await tx<any[]>`
            SELECT i.variant_id FROM commerce_order_items i
            JOIN commerce_product_variants v ON v.id=i.variant_id
            WHERE i.order_id=${orderId} AND v.inventory_on_hand-v.inventory_reserved<i.quantity`;
          if (!shortages.length) {
            await tx`UPDATE commerce_product_variants v
              SET inventory_reserved=inventory_reserved+i.quantity,updated_at=now()
              FROM commerce_order_items i
              WHERE i.order_id=${orderId} AND i.variant_id=v.id`;
            order.inventory_reservation_status = 'HELD';
          }
        }
        await tx`UPDATE commerce_orders SET status='PAID',payment_status='PAID',
          payment_provider='STRIPE',payment_reference=${intent.id},stripe_payment_intent_id=${intent.id},
          paid_at=COALESCE(paid_at,now()),inventory_reservation_status=${order.inventory_reservation_status},
          stripe_payment_event_created_at=GREATEST(COALESCE(stripe_payment_event_created_at,0),${event.created}),
          updated_at=now() WHERE id=${orderId}`;
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      result = 'FAILED';
      if (!stale && !settled) {
        await tx`UPDATE commerce_orders SET payment_status='FAILED',payment_provider='STRIPE',
          payment_reference=${intent.id},stripe_payment_intent_id=${intent.id},
          stripe_payment_event_created_at=${event.created},inventory_reservation_status='RELEASED',
          updated_at=now() WHERE id=${orderId}`;
        if (order.inventory_reservation_status === 'HELD')
          await tx`UPDATE commerce_product_variants v
            SET inventory_reserved=GREATEST(0,v.inventory_reserved-i.quantity),updated_at=now()
            FROM commerce_order_items i WHERE i.order_id=${orderId} AND i.variant_id=v.id`;
      }
    } else {
      result = 'CANCELED';
      if (!stale && !settled) {
        await tx`UPDATE commerce_orders SET status='CANCELED',payment_status='CANCELED',
          fulfillment_status='CANCELED',payment_provider='STRIPE',payment_reference=${intent.id},
          stripe_payment_intent_id=${intent.id},canceled_at=COALESCE(canceled_at,now()),
          inventory_reservation_status='RELEASED',stripe_payment_event_created_at=${event.created},
          updated_at=now() WHERE id=${orderId}`;
        if (order.inventory_reservation_status === 'HELD')
          await tx`UPDATE commerce_product_variants v
            SET inventory_reserved=GREATEST(0,v.inventory_reserved-i.quantity),updated_at=now()
            FROM commerce_order_items i WHERE i.order_id=${orderId} AND i.variant_id=v.id`;
      }
    }
    await tx`UPDATE commerce_stripe_webhook_events
      SET status='PROCESSED',order_id=${orderId},result=${stale ? 'STALE_IGNORED' : result},processed_at=now()
      WHERE stripe_event_id=${event.id}`;
    console.info(
      JSON.stringify({
        service: 'stripe-webhook',
        eventId: event.id,
        eventType: event.type,
        paymentIntentId: intent.id,
        orderNumber: order.order_number,
        result: stale ? 'STALE_IGNORED' : result,
      }),
    );
    return { result, orderNumber: order.order_number };
  });
}
