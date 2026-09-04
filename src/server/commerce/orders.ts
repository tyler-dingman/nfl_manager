import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { createNotification } from '@/server/notifications/repository';
import { demoPaymentProvider, demoTaxProvider, manualShippingProvider } from './providers';
import { syncCommerceCatalog } from './catalog';

export type CheckoutInput = {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  shippingMethod: 'STANDARD' | 'EXPRESS';
  paymentMethod: 'APPLE_PAY' | 'GOOGLE_PAY' | 'PAYPAL' | 'CARD';
  paymentFixture?: 'SUCCESS' | 'DECLINED';
  promoCode?: string;
  items: Array<{ productId: string; size: string; quantity: number }>;
};

async function discountFor(subtotalCents: number, code?: string) {
  if (!code) return { code: null, cents: 0 };
  const [promo] = await authDb()<
    any[]
  >`SELECT * FROM commerce_promo_codes WHERE code=${code.toUpperCase()} AND active=true
    AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now())
    AND (usage_limit IS NULL OR usage_count<usage_limit)`;
  if (!promo) throw new Error('Promo code is not valid.');
  if (promo.minimum_subtotal_cents && subtotalCents < promo.minimum_subtotal_cents)
    throw new Error('Order does not meet the promo minimum.');
  const cents =
    promo.type === 'PERCENT'
      ? Math.round((subtotalCents * promo.value) / 100)
      : Math.min(subtotalCents, promo.value);
  return { code: promo.code as string, cents };
}

export async function quoteCommerceOrder(
  items: CheckoutInput['items'],
  promoCode?: string,
  shippingMethod?: CheckoutInput['shippingMethod'],
) {
  await syncCommerceCatalog();
  const uniqueItems = new Map<string, number>();
  for (const item of items)
    uniqueItems.set(
      `${item.productId}:${item.size}`,
      (uniqueItems.get(`${item.productId}:${item.size}`) ?? 0) + item.quantity,
    );
  const variants = await authDb()<any[]>`SELECT v.*,p.name AS product_name,p.base_price_cents,
    COALESCE(v.price_cents,p.base_price_cents) unit_price_cents
    FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id
    WHERE v.id=ANY(${[...uniqueItems.keys()]}) AND v.active=true AND p.active=true`;
  if (variants.length !== uniqueItems.size)
    throw new Error('One cart item is no longer available.');
  for (const variant of variants)
    if (variant.inventory_on_hand - variant.inventory_reserved < uniqueItems.get(variant.id)!)
      throw new Error(`${variant.product_name} does not have enough inventory.`);
  const subtotalCents = variants.reduce(
    (sum, variant) => sum + variant.unit_price_cents * uniqueItems.get(variant.id)!,
    0,
  );
  const discount = await discountFor(subtotalCents, promoCode);
  const shipping = shippingMethod ? manualShippingProvider.quote(shippingMethod).amountCents : null;
  const tax = shippingMethod
    ? demoTaxProvider.calculate({ subtotalCents, discountCents: discount.cents }).amountCents
    : null;
  return {
    subtotalCents,
    discountCents: discount.cents,
    promoCode: discount.code,
    shippingCents: shipping,
    taxCents: tax,
    totalCents:
      shipping === null || tax === null
        ? subtotalCents - discount.cents
        : subtotalCents - discount.cents + shipping + tax,
  };
}

export async function createCommerceOrder(userId: string | null, input: CheckoutInput) {
  await syncCommerceCatalog();
  const sql = authDb();
  const uniqueItems = new Map<string, number>();
  for (const item of input.items)
    uniqueItems.set(
      `${item.productId}:${item.size}`,
      (uniqueItems.get(`${item.productId}:${item.size}`) ?? 0) + item.quantity,
    );
  const variantIds = [...uniqueItems.keys()];
  const variants = await sql<
    any[]
  >`SELECT v.*,p.name AS product_name,p.base_price_cents,COALESCE(v.price_cents,p.base_price_cents) unit_price_cents
    FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE v.id=ANY(${variantIds}) AND v.active=true AND p.active=true`;
  if (variants.length !== variantIds.length)
    throw new Error('One cart item is no longer available.');
  for (const variant of variants)
    if (variant.inventory_on_hand - variant.inventory_reserved < uniqueItems.get(variant.id)!)
      throw new Error(`${variant.product_name} does not have enough inventory.`);
  const subtotalCents = variants.reduce(
    (sum, variant) => sum + variant.unit_price_cents * uniqueItems.get(variant.id)!,
    0,
  );
  const discount = await discountFor(subtotalCents, input.promoCode);
  const shipping = manualShippingProvider.quote(input.shippingMethod);
  const tax = demoTaxProvider.calculate({ subtotalCents, discountCents: discount.cents });
  const totalCents = subtotalCents - discount.cents + shipping.amountCents + tax.amountCents;
  const payment = await demoPaymentProvider.createPayment({
    amountCents: totalCents,
    fixture: input.paymentFixture,
  });
  if (payment.status !== 'PAID') throw new Error('Demo payment was declined.');
  const id = randomUUID();
  const [{ number }] = await sql<
    { number: number }[]
  >`SELECT nextval('commerce_order_number_seq')::int number`;
  const orderNumber = `DND-${number}`;
  await sql.begin(async (tx) => {
    for (const variant of variants) {
      const quantity = uniqueItems.get(variant.id)!;
      const reserved =
        await tx`UPDATE commerce_product_variants SET inventory_reserved=inventory_reserved+${quantity},updated_at=now()
        WHERE id=${variant.id} AND inventory_on_hand-inventory_reserved>=${quantity} RETURNING id`;
      if (!reserved.length) throw new Error(`${variant.product_name} sold out during checkout.`);
    }
    await tx`INSERT INTO commerce_orders(id,order_number,user_id,email,phone,customer_first_name,customer_last_name,status,payment_status,fulfillment_status,payment_provider,payment_reference,subtotal_cents,discount_total_cents,shipping_total_cents,tax_total_cents,total_cents,promo_code,shipping_address,shipping_method)
      VALUES(${id},${orderNumber},${userId},${input.email.toLowerCase()},${input.phone ?? null},${input.firstName},${input.lastName},'PAID','PAID','NEW','DEMO',${payment.reference},${subtotalCents},${discount.cents},${shipping.amountCents},${tax.amountCents},${totalCents},${discount.code},${tx.json({ firstName: input.firstName, lastName: input.lastName, address1: input.address1, address2: input.address2 ?? null, city: input.city, state: input.state, postalCode: input.postalCode, country: 'US' })},${input.shippingMethod})`;
    for (const variant of variants) {
      const quantity = uniqueItems.get(variant.id)!;
      await tx`INSERT INTO commerce_order_items(id,order_id,product_id,variant_id,sku,product_name,variant_label,image_url,quantity,unit_price_cents,line_total_cents)
        VALUES(${randomUUID()},${id},${variant.product_id},${variant.id},${variant.sku},${variant.product_name},${variant.color_label ?? variant.size ?? 'Standard'},${variant.image_url},${quantity},${variant.unit_price_cents},${variant.unit_price_cents * quantity})`;
    }
    if (discount.code)
      await tx`UPDATE commerce_promo_codes SET usage_count=usage_count+1,updated_at=now() WHERE code=${discount.code}`;
  });
  if (userId)
    await createNotification(userId, {
      eventId: `commerce-order:${id}:confirmed`,
      dedupeKey: `commerce-order:${id}:confirmed`,
      title: 'Order confirmed',
      body: `Your D&D order #${orderNumber.replace('DND-', '')} is confirmed.`,
      deepLink: `/orders/${id}`,
      contentId: id,
      contentType: 'ORDER',
      category: 'SYSTEM',
      type: 'SYSTEM',
      priority: 'NORMAL',
    });
  console.info(
    JSON.stringify({
      metric: 'order_placed',
      orderId: id,
      paymentProvider: 'DEMO',
      itemCount: input.items.reduce((n, item) => n + item.quantity, 0),
      totalCents,
    }),
  );
  return { id, orderNumber, totalCents };
}

const orderSelect = `SELECT o.*,COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'productId',i.product_id,'variantId',i.variant_id,'sku',i.sku,'productName',i.product_name,'variantLabel',i.variant_label,'imageUrl',i.image_url,'quantity',i.quantity,'unitPriceCents',i.unit_price_cents,'lineTotalCents',i.line_total_cents) ORDER BY i.created_at) FILTER(WHERE i.id IS NOT NULL),'[]') items FROM commerce_orders o LEFT JOIN commerce_order_items i ON i.order_id=o.id`;
export async function customerOrders(userId: string) {
  return authDb().unsafe<any[]>(
    `${orderSelect} WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,
    [userId],
  );
}
export async function customerOrder(userId: string, orderId: string) {
  return (
    (
      await authDb().unsafe<any[]>(`${orderSelect} WHERE o.user_id=$1 AND o.id=$2 GROUP BY o.id`, [
        userId,
        orderId,
      ])
    )[0] ?? null
  );
}
export async function adminOrders(search = '', status = 'ALL') {
  const sql = authDb();
  return sql<
    any[]
  >`SELECT o.*,(SELECT COALESCE(sum(quantity),0)::int FROM commerce_order_items WHERE order_id=o.id) item_count FROM commerce_orders o
    WHERE (${status}='ALL' OR o.fulfillment_status=${status}) AND (${search}='' OR o.order_number ILIKE ${`%${search}%`} OR o.email ILIKE ${`%${search}%`} OR concat(o.customer_first_name,' ',o.customer_last_name) ILIKE ${`%${search}%`}) ORDER BY o.created_at DESC LIMIT 200`;
}
export async function adminOrder(orderId: string) {
  return (
    (await authDb().unsafe<any[]>(`${orderSelect} WHERE o.id=$1 GROUP BY o.id`, [orderId]))[0] ??
    null
  );
}

export async function transitionOrder(
  adminUserId: string,
  orderId: string,
  input: {
    action: 'START_PICKING' | 'MARK_PACKED' | 'MARK_SHIPPED' | 'MARK_DELIVERED' | 'CANCEL';
    carrier?: string;
    trackingNumber?: string;
    internalNote?: string;
  },
) {
  const sql = authDb();
  const order = await adminOrder(orderId);
  if (!order) throw new Error('Order not found.');
  if (input.action === 'CANCEL' && !['NEW', 'PICKING', 'PACKED'].includes(order.fulfillment_status))
    throw new Error('Only unshipped orders can be canceled.');
  const map = {
    START_PICKING: ['NEW', 'PICKING'],
    MARK_PACKED: ['PICKING', 'PACKED'],
    MARK_SHIPPED: ['PACKED', 'SHIPPED'],
    MARK_DELIVERED: ['SHIPPED', 'DELIVERED'],
    CANCEL: [order.fulfillment_status, 'CANCELED'],
  } as const;
  const [from, to] = map[input.action];
  if (order.fulfillment_status !== from) throw new Error(`Order must be ${from} first.`);
  if (input.action === 'MARK_SHIPPED' && (!input.carrier || !input.trackingNumber))
    throw new Error('Carrier and tracking number are required.');
  await sql.begin(async (tx) => {
    if (input.action === 'MARK_SHIPPED') {
      for (const item of order.items)
        await tx`UPDATE commerce_product_variants SET inventory_on_hand=inventory_on_hand-${item.quantity},inventory_reserved=inventory_reserved-${item.quantity},updated_at=now() WHERE id=${item.variantId}`;
    }
    if (input.action === 'CANCEL') {
      for (const item of order.items)
        await tx`UPDATE commerce_product_variants SET inventory_reserved=inventory_reserved-${item.quantity},updated_at=now() WHERE id=${item.variantId}`;
    }
    await tx`UPDATE commerce_orders SET status=${to},fulfillment_status=${to},carrier=COALESCE(${input.carrier ?? null},carrier),tracking_number=COALESCE(${input.trackingNumber ?? null},tracking_number),internal_note=COALESCE(${input.internalNote ?? null},internal_note),shipped_at=CASE WHEN ${to}='SHIPPED' THEN now() ELSE shipped_at END,delivered_at=CASE WHEN ${to}='DELIVERED' THEN now() ELSE delivered_at END,canceled_at=CASE WHEN ${to}='CANCELED' THEN now() ELSE canceled_at END,updated_at=now() WHERE id=${orderId}`;
  });
  if (order.user_id && (to === 'SHIPPED' || to === 'DELIVERED'))
    await createNotification(order.user_id, {
      eventId: `commerce-order:${orderId}:${to}`,
      dedupeKey: `commerce-order:${orderId}:${to}`,
      title: to === 'SHIPPED' ? 'Order shipped' : 'Order delivered',
      body:
        to === 'SHIPPED'
          ? `Your order is on the way.${input.trackingNumber ? ` Tracking: ${input.trackingNumber}` : ''}`
          : 'Your D&D order was delivered.',
      deepLink: `/orders/${orderId}`,
      contentId: orderId,
      contentType: 'ORDER',
      category: 'SYSTEM',
      type: 'SYSTEM',
      priority: 'NORMAL',
    });
  console.info(
    JSON.stringify({
      metric:
        to === 'PICKING'
          ? 'order_picking_started'
          : to === 'PACKED'
            ? 'order_packed'
            : to === 'SHIPPED'
              ? 'order_shipped'
              : 'order_status_changed',
      orderId,
      adminUserId,
      status: to,
    }),
  );
  return adminOrder(orderId);
}
