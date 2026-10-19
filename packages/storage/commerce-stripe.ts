import type Stripe from 'stripe';
import { Storage, type Statement } from './core';
import { guardedBatch } from './atomic';
import { D1Commerce } from './commerce';
import {
  stripePaymentResult,
  stripePaymentEventIsStale,
  validateStripePaymentIntent,
  stripeRefundStatus,
  requestPreparedStripeRefund,
  type StripeWebhookResult,
} from '../../src/server/commerce/stripe';
/** Order version guards serialize payment, inventory and refund decisions together. */
export class D1StripeCommerce {
  constructor(
    readonly s: Storage,
    readonly refundProvider = requestPreparedStripeRefund,
  ) {}
  eventWrite(e: Stripe.Event, order: string | null, result: string, status = 'PROCESSED') {
    return this.s.statement(
      'INSERT INTO app_commerce_stripe_webhook_events(stripe_event_id,event_type,status,order_id,result,processed_at) VALUES(?,?,?,?,?,?)',
      [e.id, e.type, status, order, result, Date.now()],
    );
  }
  reconcile(order: string) {
    return this.s.statement(
      "UPDATE app_commerce_orders SET refunded_total_cents=(SELECT coalesce(sum(amount_cents),0) FROM app_commerce_refunds WHERE order_id=? AND status='SUCCEEDED'),payment_status=CASE WHEN (SELECT coalesce(sum(amount_cents),0) FROM app_commerce_refunds WHERE order_id=? AND status='SUCCEEDED')>=total_cents THEN 'REFUNDED' WHEN EXISTS(SELECT 1 FROM app_commerce_refunds WHERE order_id=? AND status='SUCCEEDED') THEN 'PARTIALLY_REFUNDED' ELSE 'PAID' END,updated_at=?,version=version+1 WHERE id=?",
      [order, order, order, Date.now(), order],
    );
  }
  async processStripeWebhookEvent(e: Stripe.Event): Promise<StripeWebhookResult> {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (
        (
          await this.s.rows(
            'SELECT 1 FROM app_commerce_stripe_webhook_events WHERE stripe_event_id=?',
            [e.id],
          )
        ).length
      )
        return { result: 'DUPLICATE', orderNumber: null };
      const payment = stripePaymentResult(e.type),
        isRefund = e.type === 'refund.created' || e.type === 'refund.updated';
      if (!payment && !isRefund) {
        await this.s
          .statement(
            "INSERT INTO app_commerce_stripe_webhook_events(stripe_event_id,event_type,status,result,processed_at) VALUES(?,?,'IGNORED','UNSUPPORTED',?) ON CONFLICT DO NOTHING",
            [e.id, e.type, Date.now()],
          )
          .run();
        return { result: 'IGNORED', orderNumber: null };
      }
      const object = e.data.object as any,
        intentId = isRefund
          ? typeof object.payment_intent === 'string'
            ? object.payment_intent
            : object.payment_intent?.id
          : object.id;
      const [o] = await this.s.rows<any>(
        isRefund
          ? 'SELECT * FROM app_commerce_orders WHERE stripe_payment_intent_id=?'
          : 'SELECT * FROM app_commerce_orders WHERE id=?',
        [isRefund ? intentId : (object.metadata?.orderId ?? null)],
      );
      if (!o) throw Error('D&D order was not found.');
      const guards = [
          {
            sql: 'EXISTS(SELECT 1 FROM app_commerce_orders WHERE id=? AND version=?)',
            values: [o.id, o.version] as unknown[],
          },
          {
            sql: 'NOT EXISTS(SELECT 1 FROM app_commerce_stripe_webhook_events WHERE stripe_event_id=?)',
            values: [e.id],
          },
        ],
        writes: Statement[] = [];
      let result = payment as StripeWebhookResult['result'];
      if (isRefund) {
        if (
          o.payment_provider !== 'STRIPE' ||
          o.stripe_payment_intent_id !== intentId ||
          object.currency.toLowerCase() !== o.currency.toLowerCase() ||
          !Number.isInteger(object.amount) ||
          object.amount <= 0 ||
          object.amount > o.total_cents
        )
          throw Error('Stripe refund does not match the D&D payment relationship.');
        const [old] = await this.s.rows<any>(
          'SELECT * FROM app_commerce_refunds WHERE stripe_refund_id=? OR(request_id IS NOT NULL AND request_id=?)',
          [object.id, object.metadata?.refundRequestId ?? null],
        );
        if (
          old &&
          (old.order_id !== o.id ||
            old.stripe_payment_intent_id !== intentId ||
            (old.stripe_refund_id && old.stripe_refund_id !== object.id))
        )
          throw Error('Refund request relationship mismatch.');
        if (
          !old ||
          old.stripe_event_created_at == null ||
          old.stripe_event_created_at <= e.created
        ) {
          const status = stripeRefundStatus(object.status);
          guards.push({
            sql: "(SELECT coalesce(sum(amount_cents),0) FROM app_commerce_refunds WHERE order_id=? AND status='SUCCEEDED' AND id<>?)+?<=?",
            values: [
              o.id,
              old?.id ?? '',
              status === 'SUCCEEDED' ? object.amount : 0,
              o.total_cents,
            ],
          });
          writes.push(
            this.s.statement(
              'INSERT INTO app_commerce_refunds(id,request_id,order_id,stripe_refund_id,stripe_payment_intent_id,amount_cents,currency,status,reason,failure_reason,stripe_created_at,stripe_event_created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET stripe_refund_id=excluded.stripe_refund_id,amount_cents=excluded.amount_cents,status=excluded.status,failure_reason=excluded.failure_reason,stripe_created_at=excluded.stripe_created_at,stripe_event_created_at=excluded.stripe_event_created_at,updated_at=excluded.updated_at',
              [
                old?.id ?? crypto.randomUUID(),
                old?.request_id ?? null,
                o.id,
                object.id,
                intentId,
                object.amount,
                object.currency,
                status,
                object.metadata?.reason ?? object.reason ?? null,
                object.failure_reason ?? null,
                object.created * 1000,
                e.created,
                Date.now(),
              ],
            ),
          );
        }
        writes.push(this.reconcile(o.id));
      } else {
        validateStripePaymentIntent(object, {
          id: o.id,
          totalCents: o.total_cents,
          currency: o.currency,
          paymentProvider: o.payment_provider,
          stripePaymentIntentId: o.stripe_payment_intent_id,
        });
        const stale = stripePaymentEventIsStale(
            e.created,
            o.stripe_payment_event_created_at,
            o.payment_attempt_started_at == null ? null : new Date(o.payment_attempt_started_at),
          ),
          settled = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.payment_status),
          commerce = new D1Commerce(this.s);
        let reservation = o.inventory_reservation_status;
        if (payment === 'PAID' && !['REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.payment_status)) {
          if (reservation === 'RELEASED') {
            const [short] = await this.s.rows<any>(
              'SELECT count(*) AS n FROM app_commerce_order_items i JOIN app_commerce_product_variants v ON v.id=i.variant_id WHERE i.order_id=? AND v.inventory_on_hand-v.inventory_reserved<i.quantity',
              [o.id],
            );
            if (!short.n) {
              guards.push(commerce.shortage(o.id));
              writes.push(commerce.stockChange(o.id, 'RESERVE'));
              reservation = 'HELD';
            }
          }
          writes.push(
            this.s.statement(
              "UPDATE app_commerce_orders SET status='PAID',payment_status='PAID',payment_reference=?,stripe_payment_intent_id=?,paid_at=coalesce(paid_at,?),inventory_reservation_status=?,stripe_payment_event_created_at=max(coalesce(stripe_payment_event_created_at,0),?),version=version+1,updated_at=? WHERE id=?",
              [intentId, intentId, Date.now(), reservation, e.created, Date.now(), o.id],
            ),
          );
        } else if (payment !== 'PAID' && !stale && !settled) {
          if (reservation === 'HELD') writes.push(commerce.stockChange(o.id, 'RELEASE'));
          writes.push(
            this.s.statement(
              "UPDATE app_commerce_orders SET status=CASE WHEN ?='CANCELED' THEN 'CANCELED' ELSE status END,fulfillment_status=CASE WHEN ?='CANCELED' THEN 'CANCELED' ELSE fulfillment_status END,canceled_at=CASE WHEN ?='CANCELED' THEN coalesce(canceled_at,?) ELSE canceled_at END,payment_status=?,inventory_reservation_status='RELEASED',stripe_payment_event_created_at=?,version=version+1,updated_at=? WHERE id=?",
              [payment, payment, payment, Date.now(), payment, e.created, Date.now(), o.id],
            ),
          );
        }
        writes.push(this.eventWrite(e, o.id, stale ? 'STALE_IGNORED' : payment!));
      }
      if (isRefund) writes.push(this.eventWrite(e, o.id, 'REFUND_RECONCILED'));
      try {
        await guardedBatch(this.s, guards, writes);
      } catch (error) {
        if (attempt < 4 && /State changed|UNIQUE constraint/.test(String(error))) continue;
        throw error;
      }
      if (isRefund) {
        const [updated] = await this.s.rows<any>(
          'SELECT payment_status FROM app_commerce_orders WHERE id=?',
          [o.id],
        );
        result = updated.payment_status;
      }
      return { result, orderNumber: o.order_number } as StripeWebhookResult;
    }
    throw Error('Concurrent payment updates; retry delivery.');
  }
  async createStripeRefund(input: {
    orderId: string;
    adminUserId: string;
    requestId: string;
    amountCents?: number;
    reason?: string;
  }) {
    let prepared: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      const [old] = await this.s.rows<any>(
        'SELECT r.*,o.order_number FROM app_commerce_refunds r JOIN app_commerce_orders o ON o.id=r.order_id WHERE r.request_id=?',
        [input.requestId],
      );
      if (old) {
        if (
          old.order_id !== input.orderId ||
          old.created_by_user_id !== input.adminUserId ||
          (input.amountCents != null && old.amount_cents !== input.amountCents)
        )
          throw Error('Refund request belongs to another request.');
        prepared = old;
        break;
      }
      const [o] = await this.s.rows<any>('SELECT * FROM app_commerce_orders WHERE id=?', [
        input.orderId,
      ]);
      if (
        !o ||
        o.payment_provider !== 'STRIPE' ||
        !o.stripe_payment_intent_id ||
        !['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status)
      )
        throw Error('Only paid Stripe orders can be refunded.');
      const [r] = await this.s.rows<any>(
          "SELECT coalesce(sum(amount_cents),0) AS amount FROM app_commerce_refunds WHERE order_id=? AND status IN('PENDING','REQUIRES_ACTION','SUCCEEDED')",
          [o.id],
        ),
        amount = input.amountCents ?? o.total_cents - r.amount;
      if (!Number.isInteger(amount) || amount <= 0 || amount > o.total_cents - r.amount)
        throw Error('Refund amount exceeds the remaining refundable total.');
      const id = crypto.randomUUID(),
        now = Date.now();
      try {
        await guardedBatch(
          this.s,
          [
            {
              sql: "EXISTS(SELECT 1 FROM app_commerce_orders WHERE id=? AND version=? AND payment_status IN('PAID','PARTIALLY_REFUNDED')) AND (SELECT coalesce(sum(amount_cents),0) FROM app_commerce_refunds WHERE order_id=? AND status IN('PENDING','REQUIRES_ACTION','SUCCEEDED'))+?<=?",
              values: [o.id, o.version, o.id, amount, o.total_cents],
            },
          ],
          [
            this.s.statement(
              "INSERT INTO app_commerce_refunds(id,request_id,order_id,stripe_payment_intent_id,amount_cents,currency,status,reason,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'PENDING',?,?,?,?)",
              [
                id,
                input.requestId,
                o.id,
                o.stripe_payment_intent_id,
                amount,
                o.currency,
                input.reason ?? null,
                input.adminUserId,
                now,
                now,
              ],
            ),
            this.s.statement('UPDATE app_commerce_orders SET version=version+1 WHERE id=?', [o.id]),
          ],
        );
        prepared = {
          id,
          request_id: input.requestId,
          order_id: o.id,
          order_number: o.order_number,
          stripe_payment_intent_id: o.stripe_payment_intent_id,
          amount_cents: amount,
          currency: o.currency,
        };
        break;
      } catch (error) {
        if (attempt < 4 && /State changed|UNIQUE constraint/.test(String(error))) continue;
        throw error;
      }
    }
    if (!prepared) throw Error('Concurrent refund update.');
    if (prepared.stripe_refund_id) return prepared;
    // Provider errors keep the reservation PENDING: a timeout may have charged/refunded.
    // Retrying the same request uses the provider idempotency key and reconciles safely.
    const refund = await this.refundProvider(prepared, input);
    await this.processStripeWebhookEvent({
      id: `dnd-refund-result:${refund.id}:${refund.status}`,
      type: 'refund.updated',
      created: Math.floor(Date.now() / 1000),
      data: { object: refund },
    } as unknown as Stripe.Event);
    return (
      await this.s.rows<any>('SELECT * FROM app_commerce_refunds WHERE request_id=?', [
        input.requestId,
      ])
    )[0];
  }
}
