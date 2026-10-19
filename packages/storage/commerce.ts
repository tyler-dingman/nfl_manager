import { Storage, digest, utf8, type Statement } from './core';
import { guardedBatch } from './atomic';
import { D1ApplicationSettings } from './lifecycle';
import { socialNotification, drainSocialNotifications } from './social-outbox';
import {
  MERCH_PRODUCTS,
  RETIRED_MERCH_PRODUCT_IDS,
  FIXED_PRICE_MERCH_PRODUCTS,
} from '../../src/features/merch/catalog';
import {
  demoPaymentProvider,
  demoTaxProvider,
  manualShippingProvider,
} from '../../src/server/commerce/providers';
import { createStripePaymentIntentForOrder } from '../../src/server/commerce/stripe';
import type { CheckoutInput, StripeCheckoutInput } from '../../src/server/commerce/orders';
export class D1Commerce {
  constructor(
    readonly s: Storage,
    readonly intentProvider = createStripePaymentIntentForOrder,
  ) {}
  async syncCommerceCatalog() {
    // Keep migrations schema-only so a fresh disaster-recovery target is empty.
    await this.s.batch([
      this.s.statement(
        "INSERT INTO app_commerce_counters(name,next_value) VALUES('order_number',1042) ON CONFLICT DO NOTHING",
      ),
      this.s.statement(
        "INSERT INTO app_commerce_promo_codes(code,type,value,active,minimum_subtotal_cents) VALUES('WELCOME10','PERCENT',10,1,1000),('CREW10','PERCENT',10,1,1000),('GAMEDAY','FIXED',500,1,2500) ON CONFLICT DO NOTHING",
      ),
    ]);

    const settings = new D1ApplicationSettings(this.s),
      version = await digest(
        utf8.encode(
          JSON.stringify([MERCH_PRODUCTS, RETIRED_MERCH_PRODUCT_IDS, FIXED_PRICE_MERCH_PRODUCTS]),
        ),
      ),
      prior = await settings.read('commerce-catalog-version'),
      now = Date.now();
    if ((prior?.value as any)?.hash !== version) {
      const products = MERCH_PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        description:
          p.type === 'Koozie'
            ? 'Keep it cold. Rep your city. All season long.'
            : 'Built for Sundays, Saturdays, and everything in between.',
        category: p.category,
        price: Math.round(p.price * 100),
        featured: p.badge ? 1 : 0,
      }));
      await this.s
        .statement(
          "INSERT INTO app_commerce_products(id,slug,name,description,category,base_price_cents,active,featured,created_at,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.description'),json_extract(value,'$.category'),json_extract(value,'$.price'),1,json_extract(value,'$.featured'),?,? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO NOTHING",
          [now, now, JSON.stringify(products)],
        )
        .run();
      const variants = MERCH_PRODUCTS.flatMap((p) =>
        p.sizes.map((size) => ({
          id: `${p.id}:${size}`,
          product: p.id,
          sku: `${p.type === 'Koozie' && p.cityCode ? 'KOOZIE-' + p.cityCode : p.id}-${size}`
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '-'),
          cityCode: p.cityCode ?? null,
          cityName: p.cityName ?? null,
          size,
          color: p.cityName ? `${p.cityName} Colorway` : null,
          image: p.imageUrl ?? null,
        })),
      );
      for (let offset = 0; offset < variants.length; offset += 200)
        await this.s
          .statement(
            "INSERT INTO app_commerce_product_variants(id,product_id,sku,city_code,city_name,size,color_label,image_url,inventory_on_hand,active,created_at,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.product'),json_extract(value,'$.sku'),json_extract(value,'$.cityCode'),json_extract(value,'$.cityName'),json_extract(value,'$.size'),json_extract(value,'$.color'),json_extract(value,'$.image'),50,1,?,? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO NOTHING",
            [now, now, JSON.stringify(variants.slice(offset, offset + 200))],
          )
          .run();
      try{await settings.compareAndSet('commerce-catalog-version', prior?.version ?? 0, {hash:version});}catch(error){if((await settings.read('commerce-catalog-version'))?.value?.hash!==version)throw error;}
    }
    const fixed = JSON.stringify(
      FIXED_PRICE_MERCH_PRODUCTS.map((p) => ({ id: p.id, price: Math.round(p.price * 100) })),
    );
    await this.s.batch([
      this.s.statement(
        'UPDATE app_commerce_products SET active=0,updated_at=? WHERE id IN(SELECT value FROM json_each(?)) AND active=1',
        [now, JSON.stringify(RETIRED_MERCH_PRODUCT_IDS)],
      ),
      this.s.statement(
        "UPDATE app_commerce_products SET base_price_cents=(SELECT json_extract(value,'$.price') FROM json_each(?) WHERE json_extract(value,'$.id')=app_commerce_products.id),updated_at=? WHERE EXISTS(SELECT 1 FROM json_each(?) WHERE json_extract(value,'$.id')=app_commerce_products.id AND json_extract(value,'$.price') IS NOT app_commerce_products.base_price_cents)",
        [fixed, now, fixed],
      ),
      this.s.statement(
        "UPDATE app_commerce_product_variants SET price_cents=NULL WHERE product_id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND price_cents IS NOT NULL",
        [fixed],
      ),
    ]);
  }
  async commerceCatalog() {
    await this.syncCommerceCatalog();
    const [products, variants] = await Promise.all([
      this.s.rows<any>(
        'SELECT id,slug,name,description,category,base_price_cents AS basePriceCents,active,featured FROM app_commerce_products WHERE active=1 ORDER BY featured DESC,created_at,name',
      ),
      this.s.rows<any>(
        'SELECT v.product_id,v.id,v.sku,v.city_code AS cityCode,v.city_name AS cityName,v.size,v.color_label AS colorLabel,coalesce(v.price_cents,p.base_price_cents) AS priceCents,v.image_url AS imageUrl,v.inventory_on_hand AS inventoryOnHand,v.inventory_reserved AS inventoryReserved,v.inventory_on_hand-v.inventory_reserved AS inventoryAvailable FROM app_commerce_product_variants v JOIN app_commerce_products p ON p.id=v.product_id WHERE v.active=1 AND p.active=1 ORDER BY v.city_name,v.size',
      ),
    ]);
    return products.map((p) => ({
      ...p,
      active: Boolean(p.active),
      featured: Boolean(p.featured),
      variants: variants.filter((v) => v.product_id === p.id).map(({ product_id, ...v }) => v),
    }));
  }
  async commerceProduct(id: string) {
    return (await this.commerceCatalog()).find((p) => p.id === id || p.slug === id) ?? null;
  }
  async cart(items: CheckoutInput['items'], promo?: string) {
    await this.syncCommerceCatalog();
    const unique = new Map<string, number>();
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) throw Error('Invalid quantity');
      const id = `${item.productId}:${item.size}`;
      unique.set(id, (unique.get(id) ?? 0) + item.quantity);
    }
    if (!unique.size || unique.size > 100) throw Error('Invalid cart');
    const variants = await this.s.rows<any>(
      'SELECT v.*,p.name AS product_name,p.base_price_cents,coalesce(v.price_cents,p.base_price_cents) AS unit_price_cents FROM app_commerce_product_variants v JOIN app_commerce_products p ON p.id=v.product_id WHERE v.id IN(SELECT value FROM json_each(?)) AND v.active=1 AND p.active=1',
      [JSON.stringify([...unique.keys()])],
    );
    if (variants.length !== unique.size) throw Error('One cart item is no longer available.');
    for (const v of variants)
      if (v.inventory_on_hand - v.inventory_reserved < unique.get(v.id)!)
        throw Error(`${v.product_name} does not have enough inventory.`);
    const subtotalCents = variants.reduce((n, v) => n + v.unit_price_cents * unique.get(v.id)!, 0);
    let discount = { code: null as string | null, cents: 0, promo: null as any };
    if (promo) {
      const now = Date.now(),
        [p] = await this.s.rows<any>(
          'SELECT * FROM app_commerce_promo_codes WHERE code=? AND active=1 AND(starts_at IS NULL OR starts_at<=?) AND(ends_at IS NULL OR ends_at>=?) AND(usage_limit IS NULL OR usage_count<usage_limit)',
          [promo.toUpperCase(), now, now],
        );
      if (!p || (p.minimum_subtotal_cents && subtotalCents < p.minimum_subtotal_cents))
        throw Error('Promo code is not valid or minimum is not met.');
      discount = {
        code: p.code,
        cents:
          p.type === 'PERCENT'
            ? Math.round((subtotalCents * p.value) / 100)
            : Math.min(subtotalCents, p.value),
        promo: p,
      };
    }
    return { variants, unique, subtotalCents, discount };
  }
  async quoteCommerceOrder(
    items: CheckoutInput['items'],
    promo?: string,
    shippingMethod?: CheckoutInput['shippingMethod'],
  ) {
    const c = await this.cart(items, promo),
      shipping = shippingMethod ? manualShippingProvider.quote(shippingMethod).amountCents : null,
      tax = shippingMethod
        ? demoTaxProvider.calculate({
            subtotalCents: c.subtotalCents,
            discountCents: c.discount.cents,
          }).amountCents
        : null;
    return {
      subtotalCents: c.subtotalCents,
      discountCents: c.discount.cents,
      promoCode: c.discount.code,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: c.subtotalCents - c.discount.cents + (shipping ?? 0) + (tax ?? 0),
    };
  }
  async prepare(
    user: string | null,
    input: CheckoutInput | StripeCheckoutInput,
    provider: 'DEMO' | 'STRIPE',
    paymentReference: string | null = null,
  ) {
    const attempt = 'checkoutAttemptId' in input ? input.checkoutAttemptId : null,
      requestHash = await digest(utf8.encode(JSON.stringify({ user, input })));
    if (attempt) {
      const [old] = await this.s.rows<any>(
        'SELECT * FROM app_commerce_orders WHERE checkout_attempt_id=?',
        [attempt],
      );
      if (old) {
        if (old.user_id !== user || old.checkout_request_hash !== requestHash)
          throw Error('Checkout attempt belongs to a different request.');
        return old;
      }
    }
    const c = await this.cart(input.items, input.promoCode),
      shipping = manualShippingProvider.quote(input.shippingMethod),
      tax = demoTaxProvider.calculate({
        subtotalCents: c.subtotalCents,
        discountCents: c.discount.cents,
      }),
      total = c.subtotalCents - c.discount.cents + shipping.amountCents + tax.amountCents,
      id = crypto.randomUUID(),
      now = Date.now(),
      cart = JSON.stringify(
        c.variants.map((v) => ({
          id: v.id,
          quantity: c.unique.get(v.id),
          price: v.unit_price_cents,
        })),
      ),
      address = JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        address1: input.address1,
        address2: input.address2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: 'US',
      });
    const guards = [
      {
        sql: "NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN app_commerce_product_variants v ON v.id=json_extract(j.value,'$.id') LEFT JOIN app_commerce_products p ON p.id=v.product_id WHERE v.id IS NULL OR v.active<>1 OR p.active<>1 OR v.inventory_on_hand-v.inventory_reserved<json_extract(j.value,'$.quantity') OR coalesce(v.price_cents,p.base_price_cents)<>json_extract(j.value,'$.price'))",
        values: [cart] as unknown[],
      },
    ];
    if (c.discount.promo)
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_commerce_promo_codes WHERE code=? AND active=1 AND type=? AND value=? AND(starts_at IS NULL OR starts_at<=?) AND(ends_at IS NULL OR ends_at>=?) AND(usage_limit IS NULL OR usage_count<usage_limit))',
        values: [c.discount.code, c.discount.promo.type, c.discount.promo.value, now, now],
      });
    if (attempt)
      guards.push({
        sql: 'NOT EXISTS(SELECT 1 FROM app_commerce_orders WHERE checkout_attempt_id=?)',
        values: [attempt],
      });
    const items = JSON.stringify(
      c.variants.map((v) => ({
        id: crypto.randomUUID(),
        product: v.product_id,
        variant: v.id,
        sku: v.sku,
        name: v.product_name,
        label: v.color_label ?? v.size ?? 'Standard',
        image: v.image_url,
        quantity: c.unique.get(v.id),
        price: v.unit_price_cents,
        line: v.unit_price_cents * c.unique.get(v.id)!,
      })),
    );
    const writes = [
      this.s.statement(
        "UPDATE app_commerce_counters SET next_value=next_value+1 WHERE name='order_number'",
      ),
      this.s.statement(
        "UPDATE app_commerce_product_variants SET inventory_reserved=inventory_reserved+(SELECT json_extract(value,'$.quantity') FROM json_each(?) WHERE json_extract(value,'$.id')=app_commerce_product_variants.id),updated_at=? WHERE id IN(SELECT json_extract(value,'$.id') FROM json_each(?))",
        [cart, now, cart],
      ),
      this.s.statement(
        "INSERT INTO app_commerce_orders(id,order_number,user_id,email,phone,customer_first_name,customer_last_name,status,payment_status,fulfillment_status,payment_provider,payment_reference,subtotal_cents,discount_total_cents,shipping_total_cents,tax_total_cents,total_cents,promo_code,shipping_address,shipping_method,currency,checkout_attempt_id,checkout_request_hash,inventory_reservation_status,payment_attempt_started_at,created_at,updated_at) SELECT ?,'DND-'||(next_value-1),?,?,?,?,?,?,?,'NEW',?,?,?,?,?,?,?,?,?,?,'usd',?,?,'HELD',?,?,? FROM app_commerce_counters WHERE name='order_number'",
        [
          id,
          user,
          input.email.toLowerCase(),
          input.phone ?? null,
          input.firstName,
          input.lastName,
          provider === 'DEMO' ? 'PAID' : 'NEW',
          provider === 'DEMO' ? 'PAID' : 'PENDING',
          provider,
          paymentReference,
          c.subtotalCents,
          c.discount.cents,
          shipping.amountCents,
          tax.amountCents,
          total,
          c.discount.code,
          address,
          input.shippingMethod,
          attempt,
          requestHash,
          now,
          now,
          now,
        ],
      ),
      this.s.statement(
        "INSERT INTO app_commerce_order_items(id,order_id,product_id,variant_id,sku,product_name,variant_label,image_url,quantity,unit_price_cents,line_total_cents,created_at) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.product'),json_extract(value,'$.variant'),json_extract(value,'$.sku'),json_extract(value,'$.name'),json_extract(value,'$.label'),json_extract(value,'$.image'),json_extract(value,'$.quantity'),json_extract(value,'$.price'),json_extract(value,'$.line'),? FROM json_each(?)",
        [id, now, items],
      ),
    ];
    if (c.discount.code)
      writes.push(
        this.s.statement(
          'UPDATE app_commerce_promo_codes SET usage_count=usage_count+1,updated_at=? WHERE code=?',
          [now, c.discount.code],
        ),
      );
    if (user && provider === 'DEMO')
      writes.push(
        await socialNotification(this.s, user, `commerce-order:${id}:confirmed`, {
          eventId: `commerce-order:${id}:confirmed`,
          dedupeKey: `commerce-order:${id}:confirmed`,
          title: 'Order confirmed',
          body: 'Your D&D order is confirmed.',
          deepLink: `/orders/${id}`,
          contentId: id,
          contentType: 'ORDER',
          category: 'SYSTEM',
          type: 'SYSTEM',
          priority: 'NORMAL',
        }),
      );
    try {
      await guardedBatch(
        this.s,
        guards,
        writes,
        'Cart stock, price, promo or checkout attempt changed.',
      );
    } catch (error) {
      if (attempt) {
        const [old] = await this.s.rows<any>(
          'SELECT * FROM app_commerce_orders WHERE checkout_attempt_id=?',
          [attempt],
        );
        if (old && old.user_id === user && old.checkout_request_hash === requestHash) return old;
      }
      throw error;
    }
    return (await this.s.rows<any>('SELECT * FROM app_commerce_orders WHERE id=?', [id]))[0];
  }
  async createCommerceOrder(user: string | null, input: CheckoutInput) {
    const quote = await this.quoteCommerceOrder(input.items, input.promoCode, input.shippingMethod),
      payment = await demoPaymentProvider.createPayment({
        amountCents: quote.totalCents,
        fixture: input.paymentFixture,
      });
    if (payment.status !== 'PAID') throw Error('Demo payment was declined.');
    const order = await this.prepare(user, input, 'DEMO', payment.reference);
    if (user) await drainSocialNotifications(this.s);
    return {
      id: order.id as string,
      orderNumber: order.order_number as string,
      totalCents: order.total_cents as number,
    };
  }
  async createStripeCheckout(user: string | null, input: StripeCheckoutInput) {
    const order = await this.prepare(user, input, 'STRIPE');
    if (order.payment_status === 'CANCELED')
      throw Error('This payment was canceled. Start a new checkout attempt.');
    const intent = await this.intentProvider({
      id: order.id,
      orderNumber: order.order_number,
      totalCents: order.total_cents,
      currency: order.currency,
    });
    if (!intent.client_secret) throw Error('Stripe did not return a payment client secret.');
    await this.s
      .statement(
        "UPDATE app_commerce_orders SET stripe_payment_intent_id=?,payment_reference=?,updated_at=?,version=version+1 WHERE id=? AND payment_status<>'PAID'",
        [intent.id, intent.id, Date.now(), order.id],
      )
      .run();
    return {
      order: { id: order.id, orderNumber: order.order_number, totalCents: order.total_cents },
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    };
  }
  stockChange(order: string, kind: 'RESERVE' | 'RELEASE' | 'CONSUME') {
    const quantity =
      'coalesce((SELECT sum(quantity) FROM app_commerce_order_items i WHERE i.order_id=? AND i.variant_id=app_commerce_product_variants.id),0)';
    return this.s.statement(
      `UPDATE app_commerce_product_variants SET ${kind === 'CONSUME' ? `inventory_on_hand=inventory_on_hand-${quantity},` : ''}inventory_reserved=${kind === 'RESERVE' ? `inventory_reserved+${quantity}` : `max(0,inventory_reserved-${quantity})`},updated_at=? WHERE id IN(SELECT variant_id FROM app_commerce_order_items WHERE order_id=?)`,
      kind === 'CONSUME' ? [order, order, Date.now(), order] : [order, Date.now(), order],
    );
  }
  shortage(order: string) {
    return {
      sql: 'NOT EXISTS(SELECT 1 FROM app_commerce_order_items i JOIN app_commerce_product_variants v ON v.id=i.variant_id WHERE i.order_id=? AND v.inventory_on_hand-v.inventory_reserved<i.quantity)',
      values: [order],
    };
  }
  async prepareStripePaymentRetry(id: string, intent: string) {
    const [o] = await this.s.rows<any>(
      "SELECT * FROM app_commerce_orders WHERE id=? AND stripe_payment_intent_id=? AND payment_provider='STRIPE'",
      [id, intent],
    );
    if (!o) throw Error('Stripe checkout was not found.');
    if (['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.payment_status))
      return { paymentStatus: o.payment_status, reservationStatus: o.inventory_reservation_status };
    if (o.payment_status === 'CANCELED')
      throw Error('This payment was canceled. Start a new checkout attempt.');
    await guardedBatch(
      this.s,
      [
        {
          sql: 'EXISTS(SELECT 1 FROM app_commerce_orders WHERE id=? AND version=?)',
          values: [id, o.version],
        },
        ...(o.inventory_reservation_status === 'RELEASED' ? [this.shortage(id)] : []),
      ],
      [
        ...(o.inventory_reservation_status === 'RELEASED' ? [this.stockChange(id, 'RESERVE')] : []),
        this.s.statement(
          "UPDATE app_commerce_orders SET payment_status='PENDING',inventory_reservation_status='HELD',payment_attempt_started_at=?,updated_at=?,version=version+1 WHERE id=?",
          [Date.now(), Date.now(), id],
        ),
      ],
    );
    return { paymentStatus: 'PENDING', reservationStatus: 'HELD' };
  }
  async stripeCheckoutStatus(id: string, intent: string) {
    const [o] = await this.s.rows<any>(
      "SELECT id,order_number,total_cents,payment_status FROM app_commerce_orders WHERE id=? AND stripe_payment_intent_id=? AND payment_provider='STRIPE'",
      [id, intent],
    );
    if (!o) throw Error('Stripe checkout was not found.');
    return {
      id: o.id,
      orderNumber: o.order_number,
      totalCents: o.total_cents,
      paymentStatus: o.payment_status,
    };
  }
  async hydrate(rows: any[], customer = false) {
    if (!rows.length) return [];
    const ids = JSON.stringify(rows.map((o) => o.id)),
      [items, refunds] = await Promise.all([
        this.s.rows<any>(
          'SELECT id,order_id,product_id AS productId,variant_id AS variantId,sku,product_name AS productName,variant_label AS variantLabel,image_url AS imageUrl,quantity,unit_price_cents AS unitPriceCents,line_total_cents AS lineTotalCents FROM app_commerce_order_items WHERE order_id IN(SELECT value FROM json_each(?)) ORDER BY created_at,id',
          [ids],
        ),
        this.s.rows<any>(
          'SELECT id,order_id,stripe_refund_id AS stripeRefundId,amount_cents AS amountCents,currency,status,reason,created_at AS createdAt FROM app_commerce_refunds WHERE order_id IN(SELECT value FROM json_each(?)) ORDER BY created_at DESC,id',
          [ids],
        ),
      ]);
    return rows.map((o) => {
      const result = {
        ...o,
        shipping_address: JSON.parse(o.shipping_address),
        items: items.filter((i) => i.order_id === o.id).map(({ order_id, ...i }) => i),
        refunds: refunds
          .filter((r) => r.order_id === o.id)
          .map(({ order_id, ...r }) => ({ ...r, createdAt: new Date(r.createdAt) })),
      };
      for (const key of [
        'created_at',
        'updated_at',
        'paid_at',
        'shipped_at',
        'delivered_at',
        'canceled_at',
        'payment_attempt_started_at',
      ])
        result[key] = o[key] == null ? null : new Date(o[key]);
      if (customer) {
        for (const key of [
          'internal_note',
          'checkout_attempt_id',
          'checkout_request_hash',
          'payment_reference',
          'stripe_payment_intent_id',
          'stripe_payment_event_created_at',
          'payment_attempt_started_at',
        ])
          delete result[key];
        result.refunds = result.refunds.map(({ reason, ...r }: any) => r);
      }
      return result;
    });
  }
  async customerOrders(user: string) {
    return this.hydrate(
      await this.s.rows<any>(
        'SELECT * FROM app_commerce_orders WHERE user_id=? ORDER BY created_at DESC,id',
        [user],
      ),
      true,
    );
  }
  async customerOrder(user: string, id: string) {
    return (
      (
        await this.hydrate(
          await this.s.rows<any>('SELECT * FROM app_commerce_orders WHERE user_id=? AND id=?', [
            user,
            id,
          ]),
          true,
        )
      )[0] ?? null
    );
  }
  async adminOrder(id: string) {
    return (
      (
        await this.hydrate(
          await this.s.rows<any>('SELECT * FROM app_commerce_orders WHERE id=?', [id]),
        )
      )[0] ?? null
    );
  }
  async adminOrders(search = '', status = 'ALL') {
    return this.s.rows<any>(
      "SELECT o.*,(SELECT coalesce(sum(quantity),0) FROM app_commerce_order_items i WHERE i.order_id=o.id) AS item_count FROM app_commerce_orders o WHERE (?='ALL' OR o.fulfillment_status=?) AND (?='' OR o.order_number LIKE ? OR o.email LIKE ? OR o.customer_first_name||' '||o.customer_last_name LIKE ?) ORDER BY o.created_at DESC LIMIT 200",
      [status, status, search, '%' + search + '%', '%' + search + '%', '%' + search + '%'],
    );
  }
  async transitionOrder(
    admin: string,
    id: string,
    input: {
      action: 'START_PICKING' | 'MARK_PACKED' | 'MARK_SHIPPED' | 'MARK_DELIVERED' | 'CANCEL';
      carrier?: string;
      trackingNumber?: string;
      internalNote?: string;
    },
  ) {
    const o = await this.adminOrder(id);
    if (!o) throw Error('Order not found.');
    if (input.action !== 'CANCEL' && !['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status))
      throw Error('Payment must be PAID before fulfillment can begin.');
    if (
      ['START_PICKING', 'MARK_PACKED', 'MARK_SHIPPED'].includes(input.action) &&
      o.inventory_reservation_status !== 'HELD'
    )
      throw Error('Inventory must be reserved before fulfillment can begin.');
    if (input.action === 'CANCEL' && !['NEW', 'PICKING', 'PACKED'].includes(o.fulfillment_status))
      throw Error('Only unshipped orders can be canceled.');
    const map = {
        START_PICKING: ['NEW', 'PICKING'],
        MARK_PACKED: ['PICKING', 'PACKED'],
        MARK_SHIPPED: ['PACKED', 'SHIPPED'],
        MARK_DELIVERED: ['SHIPPED', 'DELIVERED'],
        CANCEL: [o.fulfillment_status, 'CANCELED'],
      },
      [from, to] = map[input.action];
    if (o.fulfillment_status !== from) throw Error(`Order must be ${from} first.`);
    if (to === 'SHIPPED' && (!input.carrier || !input.trackingNumber))
      throw Error('Carrier and tracking number are required.');
    const now = Date.now(),
      writes: Statement[] = [];
    if (to === 'SHIPPED') writes.push(this.stockChange(id, 'CONSUME'));
    if (to === 'CANCELED' && o.inventory_reservation_status === 'HELD')
      writes.push(this.stockChange(id, 'RELEASE'));
    writes.push(
      this.s.statement(
        "UPDATE app_commerce_orders SET status=?,fulfillment_status=?,carrier=coalesce(?,carrier),tracking_number=coalesce(?,tracking_number),internal_note=coalesce(?,internal_note),shipped_at=CASE WHEN ?='SHIPPED' THEN ? ELSE shipped_at END,delivered_at=CASE WHEN ?='DELIVERED' THEN ? ELSE delivered_at END,canceled_at=CASE WHEN ?='CANCELED' THEN ? ELSE canceled_at END,inventory_reservation_status=CASE WHEN ?='SHIPPED' THEN 'CONSUMED' WHEN ?='CANCELED' AND inventory_reservation_status='HELD' THEN 'RELEASED' ELSE inventory_reservation_status END,version=version+1,updated_at=? WHERE id=?",
        [
          to,
          to,
          input.carrier ?? null,
          input.trackingNumber ?? null,
          input.internalNote ?? null,
          to,
          now,
          to,
          now,
          to,
          now,
          to,
          to,
          now,
          id,
        ],
      ),
    );
    if (o.user_id && ['SHIPPED', 'DELIVERED'].includes(to))
      writes.push(
        await socialNotification(this.s, o.user_id, `commerce-order:${id}:${to}`, {
          eventId: `commerce-order:${id}:${to}`,
          dedupeKey: `commerce-order:${id}:${to}`,
          title: to === 'SHIPPED' ? 'Order shipped' : 'Order delivered',
          body:
            to === 'SHIPPED'
              ? `Your order is on the way.${input.trackingNumber ? ' Tracking: ' + input.trackingNumber : ''}`
              : 'Your D&D order was delivered.',
          deepLink: `/orders/${id}`,
          contentId: id,
          contentType: 'ORDER',
          category: 'SYSTEM',
          type: 'SYSTEM',
          priority: 'NORMAL',
        }),
      );
    await guardedBatch(
      this.s,
      [
        {
          sql: 'EXISTS(SELECT 1 FROM app_commerce_orders WHERE id=? AND version=? AND fulfillment_status=?)',
          values: [id, o.version, from],
        },
      ],
      writes,
    );
    if (o.user_id) await drainSocialNotifications(this.s);
    return this.adminOrder(id);
  }
  async commerceAdminData(section: string, search = '', status = 'ALL'): Promise<any> {
    await this.syncCommerceCatalog();
    if (section === 'orders') return { orders: await this.adminOrders(search, status) };
    if (section === 'inventory')
      return {
        inventory: await this.s.rows<any>(
          'SELECT v.id,v.sku,v.city_name AS cityName,v.size,v.inventory_on_hand AS onHand,v.inventory_reserved AS reserved,v.inventory_on_hand-v.inventory_reserved AS available,v.active,p.name AS productName FROM app_commerce_product_variants v JOIN app_commerce_products p ON p.id=v.product_id ORDER BY available,v.sku',
        ),
      };
    if (section === 'products')
      return {
        products: await this.s.rows<any>(
          'SELECT p.*,(SELECT count(*) FROM app_commerce_product_variants WHERE product_id=p.id) AS variant_count FROM app_commerce_products p ORDER BY p.name',
        ),
      };
    if (section === 'promos')
      return {
        promos: await this.s.rows<any>('SELECT * FROM app_commerce_promo_codes ORDER BY code'),
      };
    if (section === 'customers')
      return {
        customers: await this.s.rows<any>(
          "SELECT customer_first_name||' '||customer_last_name AS name,email,count(*) AS orderCount,coalesce(sum(CASE WHEN payment_status IN('PAID','PARTIALLY_REFUNDED','REFUNDED') THEN total_cents-refunded_total_cents ELSE 0 END),0) AS lifetimeSpendCents,max(created_at) AS lastOrder FROM app_commerce_orders GROUP BY email,customer_first_name,customer_last_name ORDER BY lifetimeSpendCents DESC",
        ),
      };
    const day = new Date().setUTCHours(0, 0, 0, 0),
      [o] = await this.s.rows<any>(
        "SELECT count(*) FILTER(WHERE created_at>=?) AS newOrders,coalesce(sum(total_cents) FILTER(WHERE paid_at>=?),0) AS grossSales,coalesce((SELECT sum(amount_cents) FROM app_commerce_refunds WHERE status='SUCCEEDED' AND coalesce(stripe_created_at,created_at)>=?),0) AS refunds,count(*) FILTER(WHERE payment_status IN('PAID','PARTIALLY_REFUNDED') AND fulfillment_status IN('NEW','PICKING','PACKED')) AS needFulfillment,count(*) FILTER(WHERE fulfillment_status='SHIPPED' AND shipped_at>=?) AS shipped FROM app_commerce_orders",
        [day, day, day, day],
      );
    return {
      today: { ...o, netRevenue: o.grossSales - o.refunds },
      recentOrders: (await this.adminOrders()).slice(0, 10),
      lowInventory: await this.s.rows<any>(
        'SELECT v.id,v.sku,p.name,v.city_name AS cityName,v.inventory_on_hand-v.inventory_reserved AS available FROM app_commerce_product_variants v JOIN app_commerce_products p ON p.id=v.product_id WHERE v.active=1 ORDER BY available LIMIT 10',
      ),
    };
  }
  async adjustInventory(admin: string, id: string, delta: number, reason: string) {
    const now = Date.now();
    const result = await guardedBatch(
      this.s,
      [
        {
          sql: 'EXISTS(SELECT 1 FROM app_commerce_product_variants WHERE id=? AND inventory_on_hand+?>=inventory_reserved)',
          values: [id, delta],
        },
      ],
      [
        this.s.statement(
          'UPDATE app_commerce_product_variants SET inventory_on_hand=inventory_on_hand+?,updated_at=? WHERE id=? RETURNING *',
          [delta, now, id],
        ),
        this.s.statement(
          'INSERT INTO app_commerce_inventory_adjustments(id,variant_id,admin_user_id,quantity_delta,reason,created_at) VALUES(?,?,?,?,?,?)',
          [crypto.randomUUID(), id, admin, delta, reason, now],
        ),
      ],
      'Adjustment would reduce stock below reserved inventory.',
    );
    return result[1].results[0];
  }
  async updateCommerceProduct(
    id: string,
    input: { active?: boolean; name?: string; description?: string; basePriceCents?: number },
  ) {
    const rows = await this.s.rows<any>(
      'UPDATE app_commerce_products SET active=coalesce(?,active),name=coalesce(?,name),description=coalesce(?,description),base_price_cents=coalesce(?,base_price_cents),updated_at=? WHERE id=? RETURNING *',
      [
        input.active === undefined ? null : input.active ? 1 : 0,
        input.name ?? null,
        input.description ?? null,
        input.basePriceCents ?? null,
        Date.now(),
        id,
      ],
    );
    if (!rows.length) throw Error('Product not found.');
    return rows[0];
  }
  async createCommerceProduct(
    admin: string,
    input: {
      id: string;
      name: string;
      description: string;
      category: string;
      basePriceCents: number;
      sku: string;
      size?: string;
      imageUrl?: string;
      inventoryOnHand: number;
    },
  ) {
    const now = Date.now(),
      variant = `${input.id}:${input.size ?? 'One Size'}`;
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_commerce_products(id,slug,name,description,category,base_price_cents,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)',
        [
          input.id,
          input.id,
          input.name,
          input.description,
          input.category,
          input.basePriceCents,
          now,
          now,
        ],
      ),
      this.s.statement(
        'INSERT INTO app_commerce_product_variants(id,product_id,sku,size,image_url,inventory_on_hand,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)',
        [
          variant,
          input.id,
          input.sku,
          input.size ?? 'One Size',
          input.imageUrl ?? null,
          input.inventoryOnHand,
          now,
          now,
        ],
      ),
      this.s.statement(
        "INSERT INTO app_commerce_inventory_adjustments(id,variant_id,admin_user_id,quantity_delta,reason,created_at) VALUES(?,?,?,?,'New stock',?)",
        [crypto.randomUUID(), variant, admin, input.inventoryOnHand, now],
      ),
    ]);
    return { id: input.id };
  }
}
