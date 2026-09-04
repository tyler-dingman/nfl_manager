import { MERCH_PRODUCTS } from '@/features/merch/catalog';
import { authDb } from '@/server/auth/database';

const description = (type: string) =>
  type === 'Koozie'
    ? 'Keep it cold. Rep your city. All season long.'
    : 'Built for Sundays, Saturdays, and everything in between.';

export async function syncCommerceCatalog() {
  const sql = authDb();
  for (const product of MERCH_PRODUCTS) {
    await sql`INSERT INTO commerce_products(id,slug,name,description,category,base_price_cents,active,featured)
      VALUES(${product.id},${product.id},${product.name},${description(product.type)},${product.category},${Math.round(product.price * 100)},true,${Boolean(product.badge)})
      ON CONFLICT(id) DO NOTHING`;
    for (const size of product.sizes) {
      const variantId = `${product.id}:${size}`;
      const sku = `${product.cityCode ? `KOOZIE-${product.cityCode}` : product.id}-${size}`
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-');
      await sql`INSERT INTO commerce_product_variants(id,product_id,sku,city_code,city_name,size,color_label,image_url,inventory_on_hand,active)
        VALUES(${variantId},${product.id},${sku},${product.cityCode ?? null},${product.cityName ?? null},${size},${product.cityName ? `${product.cityName} Colorway` : null},${product.imageUrl ?? null},50,true)
        ON CONFLICT(id) DO NOTHING`;
    }
  }
}

export async function commerceCatalog() {
  await syncCommerceCatalog();
  const sql = authDb();
  return sql<
    any[]
  >`SELECT p.id,p.slug,p.name,p.description,p.category,p.base_price_cents AS "basePriceCents",p.active,p.featured,
    COALESCE(jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'cityCode',v.city_code,'cityName',v.city_name,'size',v.size,'colorLabel',v.color_label,'priceCents',COALESCE(v.price_cents,p.base_price_cents),'imageUrl',v.image_url,'inventoryOnHand',v.inventory_on_hand,'inventoryReserved',v.inventory_reserved,'inventoryAvailable',v.inventory_on_hand-v.inventory_reserved) ORDER BY v.city_name,v.size) FILTER(WHERE v.id IS NOT NULL),'[]') AS variants
    FROM commerce_products p LEFT JOIN commerce_product_variants v ON v.product_id=p.id AND v.active=true WHERE p.active=true
    GROUP BY p.id ORDER BY p.featured DESC,p.created_at,p.name`;
}

export async function commerceProduct(productId: string) {
  return (
    (await commerceCatalog()).find(
      (product) => product.id === productId || product.slug === productId,
    ) ?? null
  );
}
