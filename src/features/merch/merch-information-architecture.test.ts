import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const shop = readFileSync('src/components/merch/merch-shop.tsx', 'utf8');
const catalog = readFileSync('src/features/merch/catalog.ts', 'utf8');

test('every merch department has a dedicated route with metadata', () => {
  for (const slug of ['men', 'women', 'kids', 'hats', 'accessories', 'sale']) {
    const route = `src/app/merch/${slug}/page.tsx`;
    assert.ok(existsSync(route), `${route} should exist`);
    const source = readFileSync(route, 'utf8');
    assert.match(source, /export const metadata/);
    assert.match(source, new RegExp(`canonical: '/merch/${slug}'`));
    assert.match(
      shop,
      new RegExp(`/merch/\\$\\{item\\.toLowerCase\\(\\)\\.replace\\(' ', '-'\\)\\}`),
    );
  }
});

test('catalog filters and sorting are URL-backed and category-driven', () => {
  assert.match(shop, /searchParams\?\.get\('city'\)/);
  assert.match(shop, /searchParams\?\.get\('type'\)/);
  assert.match(shop, /searchParams\?\.get\('sort'\)/);
  assert.match(shop, /product\.category === categoryPage/);
  assert.match(shop, /router\.push\(query \? `\$\{pathname\}\?\$\{query\}` : pathname\)/);
  assert.match(shop, /setMobileFilters\(true\)/);
});

test('homepage is merchandising-led and city discovery links to a shareable catalog URL', () => {
  assert.match(shop, /New &amp; Trending/i);
  assert.match(shop, /Shop by category/);
  assert.match(shop, /Featured drop/);
  assert.match(shop, /Featured gear/);
  assert.match(shop, /\/merch\/accessories\?city=\$\{colorway\.cityCode\}/);
});

test('sale products retain real compare-at pricing and product/cart behavior', () => {
  assert.match(catalog, /category: 'Sale'[\s\S]+compareAtPrice:/);
  assert.match(shop, /fallback\?\.compareAtPrice/);
  assert.match(shop, /href={`\/merch\/\$\{product\.id\}`}/);
  assert.match(shop, /onAdd\(product\.id, product\.sizes\[0\]/);
});
