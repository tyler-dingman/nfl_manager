import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { syncCommerceCatalog } from './catalog';
import { adminOrders } from './orders';
export async function commerceAdminData(section: string, search = '', status = 'ALL') {
  await syncCommerceCatalog();
  const sql = authDb();
  if (section === 'orders') return { orders: await adminOrders(search, status) };
  if (section === 'inventory')
    return {
      inventory: await sql<
        any[]
      >`SELECT v.id,v.sku,v.city_name AS "cityName",v.size,v.inventory_on_hand AS "onHand",v.inventory_reserved AS reserved,v.inventory_on_hand-v.inventory_reserved AS available,v.active,p.name AS "productName" FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id ORDER BY available,v.sku`,
    };
  if (section === 'products')
    return {
      products: await sql<
        any[]
      >`SELECT p.*,(SELECT count(*)::int FROM commerce_product_variants WHERE product_id=p.id) variant_count FROM commerce_products p ORDER BY p.name`,
    };
  if (section === 'customers')
    return {
      customers: await sql<
        any[]
      >`SELECT concat(customer_first_name,' ',customer_last_name) name,email,count(*)::int AS "orderCount",sum(total_cents)::int AS "lifetimeSpendCents",max(created_at) AS "lastOrder" FROM commerce_orders GROUP BY email,customer_first_name,customer_last_name ORDER BY "lifetimeSpendCents" DESC`,
    };
  if (section === 'promos')
    return { promos: await sql<any[]>`SELECT * FROM commerce_promo_codes ORDER BY code` };
  const [today, recent, low] = await Promise.all([
    sql<
      any[]
    >`SELECT count(*) FILTER(WHERE created_at>=current_date)::int AS "newOrders",COALESCE(sum(total_cents) FILTER(WHERE created_at>=current_date),0)::int revenue,count(*) FILTER(WHERE fulfillment_status IN('NEW','PICKING','PACKED'))::int AS "needFulfillment",count(*) FILTER(WHERE fulfillment_status='SHIPPED' AND shipped_at>=current_date)::int shipped FROM commerce_orders`,
    adminOrders('', 'ALL'),
    sql<
      any[]
    >`SELECT v.id,v.sku,p.name,v.city_name AS "cityName",v.inventory_on_hand-v.inventory_reserved AS available FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE v.active=true ORDER BY available LIMIT 10`,
  ]);
  return { today: today[0], recentOrders: recent.slice(0, 10), lowInventory: low };
}
export async function adjustInventory(
  adminUserId: string,
  variantId: string,
  delta: number,
  reason: string,
) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const rows = await tx<
      any[]
    >`UPDATE commerce_product_variants SET inventory_on_hand=inventory_on_hand+${delta},updated_at=now() WHERE id=${variantId} AND inventory_on_hand+${delta}>=inventory_reserved RETURNING *`;
    if (!rows.length) throw new Error('Adjustment would reduce stock below reserved inventory.');
    await tx`INSERT INTO commerce_inventory_adjustments(id,variant_id,admin_user_id,quantity_delta,reason)VALUES(${randomUUID()},${variantId},${adminUserId},${delta},${reason})`;
    return rows[0];
  });
}
export async function updateCommerceProduct(
  productId: string,
  input: { active?: boolean; name?: string; description?: string; basePriceCents?: number },
) {
  const rows = await authDb()<
    any[]
  >`UPDATE commerce_products SET active=COALESCE(${input.active ?? null},active),name=COALESCE(${input.name ?? null},name),description=COALESCE(${input.description ?? null},description),base_price_cents=COALESCE(${input.basePriceCents ?? null},base_price_cents),updated_at=now() WHERE id=${productId} RETURNING *`;
  if (!rows.length) throw new Error('Product not found.');
  return rows[0];
}

export async function createCommerceProduct(
  adminUserId: string,
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
  const sql = authDb();
  return sql.begin(async (tx) => {
    await tx`INSERT INTO commerce_products(id,slug,name,description,category,base_price_cents,active)VALUES(${input.id},${input.id},${input.name},${input.description},${input.category},${input.basePriceCents},true)`;
    const variantId = `${input.id}:${input.size ?? 'One Size'}`;
    await tx`INSERT INTO commerce_product_variants(id,product_id,sku,size,image_url,inventory_on_hand,active)VALUES(${variantId},${input.id},${input.sku},${input.size ?? 'One Size'},${input.imageUrl ?? null},${input.inventoryOnHand},true)`;
    await tx`INSERT INTO commerce_inventory_adjustments(id,variant_id,admin_user_id,quantity_delta,reason)VALUES(${randomUUID()},${variantId},${adminUserId},${input.inventoryOnHand},'New stock')`;
    return { id: input.id };
  });
}
