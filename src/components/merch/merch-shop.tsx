'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu, Search, Shirt, X } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import { MerchCartButton, useMerchCart } from '@/components/merch/merch-cart';
import TeamThemeProvider from '@/components/team-theme-provider';
import MoveTheChainsIndicator from '@/components/rewards/move-the-chains-indicator';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import { MERCH_CATEGORIES, MERCH_PRODUCTS, type MerchCategory } from '@/features/merch/catalog';
import type { MerchProduct } from '@/features/merch/catalog';
import { CITY_COLORWAYS } from '@/features/merch/city-colorways';

const CATEGORY_COPY: Record<MerchCategory, string> = {
  Men: 'Gear worth putting in the rotation.',
  Women: 'Football style without the costume.',
  Kids: 'Built for the next generation of fans.',
  Hats: 'Top it off.',
  Accessories: 'The details that finish the setup.',
  Sale: 'Last chance. Real markdowns.',
};

export default function MerchShop({ categoryPage }: { categoryPage?: MerchCategory }) {
  const pathname = usePathname() ?? '/merch';
  const router = useRouter();
  const searchParams = useSearchParams();
  const city = searchParams?.get('city')?.toUpperCase() ?? 'ALL';
  const type = searchParams?.get('type') ?? 'ALL';
  const sort = searchParams?.get('sort') ?? 'featured';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<MerchProduct[]>(MERCH_PRODUCTS);
  const { addItem } = useMerchCart();

  useEffect(() => {
    void fetch('/api/commerce/catalog')
      .then((response) => response.json())
      .then((body) =>
        setCatalogProducts(
          body.products.map((product: any) => {
            const fallback = MERCH_PRODUCTS.find((item) => item.id === product.id);
            return {
              id: product.id,
              name: product.name,
              category: product.category,
              type: fallback?.type ?? (product.variants[0]?.cityName ? 'Koozie' : product.category),
              price: product.basePriceCents / 100,
              compareAtPrice: fallback?.compareAtPrice,
              colors: fallback?.colors ?? ['#00172B'],
              sizes: [
                ...new Set<string>(
                  product.variants
                    .map((variant: any) => variant.size)
                    .filter((size: unknown): size is string => typeof size === 'string'),
                ),
              ],
              imageUrl: product.variants[0]?.imageUrl ?? fallback?.imageUrl,
              badge: fallback?.badge ?? (product.featured ? 'New' : undefined),
              cityCode: product.variants[0]?.cityCode,
              cityName: product.variants[0]?.cityName,
            } satisfies MerchProduct;
          }),
        ),
      );
  }, []);

  const categoryCities = useMemo(() => {
    const availableCodes = new Set(
      catalogProducts
        .filter((item) => item.category === categoryPage)
        .map((item) => item.cityCode)
        .filter(Boolean),
    );
    return CITY_COLORWAYS.filter((item) => availableCodes.has(item.cityCode));
  }, [catalogProducts, categoryPage]);
  const products = useMemo(() => {
    const filtered = catalogProducts.filter(
      (product) =>
        (!categoryPage || product.category === categoryPage) &&
        (city === 'ALL' || categoryCities.length === 0 || product.cityCode === city) &&
        (type === 'ALL' || product.type === type),
    );
    return [...filtered].sort((left, right) => {
      if (sort === 'price-low') return left.price - right.price;
      if (sort === 'price-high') return right.price - left.price;
      if (sort === 'new') return Number(right.badge === 'New') - Number(left.badge === 'New');
      return Number(Boolean(right.badge)) - Number(Boolean(left.badge));
    });
  }, [catalogProducts, categoryCities.length, categoryPage, city, sort, type]);
  const productTypes = useMemo(
    () =>
      [
        ...new Set(
          catalogProducts.filter((item) => item.category === categoryPage).map((item) => item.type),
        ),
      ].sort(),
    [catalogProducts, categoryPage],
  );
  const updateCatalogQuery = (key: 'city' | 'type' | 'sort', value: string) => {
    const next = new URLSearchParams(searchParams?.toString());
    if (value === 'ALL' || value === 'featured') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? catalogProducts.filter((product) =>
        `${product.name} ${product.type} ${product.category}`
          .toLowerCase()
          .includes(normalizedSearchQuery),
      )
    : catalogProducts.slice(0, 6);

  return (
    <TeamThemeProvider>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <SiteHeaderShell tone="merch">
          <SiteHeaderLogo generic />
          <PrimaryNavigation active="merch" tone="dark" />
          <div className="ml-auto flex items-center gap-2">
            <MoveTheChainsIndicator />
            <LoginButton dark={false} />
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00172B]/15 transition hover:bg-white/20"
              aria-label="Search shop"
            >
              <Search className="h-5 w-5" />
            </button>
            <MerchCartButton />
          </div>
        </SiteHeaderShell>
        <div className="bg-[#00172B] px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#F4D9B7]">
          Free shipping on orders $75+ · Shop preview
        </div>
        <div className="border-b border-[#00172B]/10 bg-[#F4D9B7] text-[#00172B]">
          <div className="mx-auto flex min-h-12 max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenu(true)}
              className="flex items-center gap-2 text-sm font-black lg:hidden"
              aria-label="Open shop departments"
            >
              <Menu className="h-4 w-4" /> Shop departments
            </button>
            <nav
              className="hidden items-center gap-6 text-sm font-black lg:flex"
              aria-label="Shop departments"
            >
              <Link href="/merch" aria-current={!categoryPage ? 'page' : undefined}>
                New &amp; Trending
              </Link>
              {MERCH_CATEGORIES.map((item) => (
                <Link
                  key={item}
                  href={`/merch/${item.toLowerCase().replace(' ', '-')}`}
                  aria-current={categoryPage === item ? 'page' : undefined}
                  className={
                    categoryPage === item ? 'underline decoration-2 underline-offset-8' : ''
                  }
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {mobileMenu ? (
          <div className="fixed inset-0 z-50 bg-[#00172B] p-6 text-white">
            <button
              type="button"
              onClick={() => setMobileMenu(false)}
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
              aria-label="Close shop navigation"
            >
              <X />
            </button>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-[#F4D9B7]">
              Shop departments
            </p>
            <div className="mt-5 grid text-3xl font-black">
              <Link
                href="/merch"
                onClick={() => setMobileMenu(false)}
                className="border-b border-white/10 py-4 text-left"
              >
                New &amp; Trending
              </Link>
              {MERCH_CATEGORIES.map((item) => (
                <Link
                  key={item}
                  href={`/merch/${item.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setMobileMenu(false)}
                  className="border-b border-white/10 py-4 text-left"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {isSearchOpen ? (
          <div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-[#00172B]/75 px-4 pt-[8vh] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Search Down & Distance shop"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setIsSearchOpen(false);
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#00172B]/10 px-5">
                <Search className="h-5 w-5 shrink-0 text-[#00172B]/35" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setIsSearchOpen(false);
                  }}
                  placeholder="Search shirts, hats, accessories..."
                  className="h-16 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-[#00172B]/35"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00172B]/5 text-[#00172B]/55 hover:bg-[#00172B]/10"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto p-3">
                <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#00172B]/40">
                  {normalizedSearchQuery ? `${searchResults.length} results` : 'Popular gear'}
                </p>
                {searchResults.length ? (
                  searchResults.map((product) => (
                    <Link
                      key={product.id}
                      href={`/merch/${product.id}`}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-[#f7f4ee]"
                    >
                      <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f1ece4]">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-contain"
                          />
                        ) : (
                          <Shirt className="absolute inset-0 m-auto h-7 w-7 text-[#00172B]/35" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#FF3D38]">
                          {product.category} · {product.type}
                        </span>
                        <span className="mt-1 block font-black leading-5 text-[#00172B]">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-sm font-bold text-[#00172B]/50">
                          ${product.price.toFixed(2)}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#00172B]/20 transition group-hover:translate-x-1 group-hover:text-[#00172B]" />
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <Search className="mx-auto h-8 w-8 text-[#00172B]/20" />
                    <p className="mt-3 font-black text-[#00172B]">
                      No products for “{searchQuery}”
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#00172B]/45">
                      Try a product, department, or style.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <main>
          {!categoryPage ? (
            <>
              <section className="overflow-hidden bg-white text-[#00172B]">
                <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-16">
                  <div className="py-4 lg:py-8">
                    <p className="inline-flex rounded-full bg-[#FF3D38] px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-white">
                      Down &amp; Distance originals
                    </p>
                    <h1 className="mt-5 max-w-3xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#00172B] sm:text-7xl">
                      Get you&apos;re head in the game.
                    </h1>
                    <p className="mt-6 max-w-xl text-lg font-semibold leading-7 text-[#00172B]/70">
                      D&amp;D originals in city-inspired colorways. No logos. Just football.
                    </p>
                    <Link
                      href="/merch/men"
                      className="mt-8 inline-flex h-14 items-center gap-3 rounded-full bg-[#00172B] px-7 font-black text-white"
                    >
                      Shop new arrivals <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] bg-[#ebe9e5] shadow-[0_24px_60px_rgba(0,23,43,0.18)] sm:aspect-[4/3] lg:aspect-square">
                    <Image
                      src="/images/store/hats/camo_hat.png"
                      alt="Down & Distance camo rope hat"
                      fill
                      priority
                      sizes="(min-width: 1024px) 520px, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute left-5 top-5 rounded-full bg-[#00172B] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white sm:left-6 sm:top-6">
                      New arrival
                    </div>
                  </div>
                </div>
              </section>
              <StoreCollection title="New & trending" href="/merch/men">
                <MerchProductGrid
                  products={catalogProducts.filter((item) => item.badge === 'New').slice(0, 4)}
                  onAdd={addItem}
                />
              </StoreCollection>
              <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
                <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
                  Shop by category
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {(['Men', 'Women', 'Hats', 'Accessories'] as MerchCategory[]).map(
                    (item, index) => (
                      <Link
                        key={item}
                        href={`/merch/${item.toLowerCase()}`}
                        className={`group min-h-64 rounded-[2rem] p-8 text-white transition hover:-translate-y-1 ${index % 2 ? 'bg-[#FF3D38]' : 'bg-[#00172B]'}`}
                      >
                        <span className="text-4xl font-black uppercase">{item}</span>
                        <span className="mt-3 block max-w-sm text-lg font-semibold opacity-80">
                          {CATEGORY_COPY[item]}
                        </span>
                        <span className="mt-16 inline-flex items-center gap-2 text-sm font-black uppercase">
                          Shop {item} <ArrowRight className="h-4 w-4" />
                        </span>
                      </Link>
                    ),
                  )}
                </div>
              </section>
              <section className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
                <div className="relative min-h-80 overflow-hidden rounded-[2rem] bg-[#ece4d8]">
                  <Image
                    src="/images/store/koozies/cincinnati-bengals-down-and-distance-koozie.png"
                    alt="Cincinnati city colorway koozie"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col justify-center rounded-[2rem] bg-[#F4D9B7] p-8 lg:p-12">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
                    Featured drop
                  </p>
                  <h2 className="mt-3 text-4xl font-black uppercase">City colorways</h2>
                  <p className="mt-4 text-lg font-semibold text-[#00172B]/65">
                    Football culture, built around the colors that make home feel like home. No
                    logos. Just football.
                  </p>
                  <Link
                    href="/merch/accessories?city=CIN"
                    className="mt-7 inline-flex items-center gap-2 font-black uppercase"
                  >
                    Shop the drop <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
              <StoreCollection title="Featured gear" href="/merch/men">
                <MerchProductGrid products={catalogProducts.slice(4, 8)} onAdd={addItem} />
              </StoreCollection>
              <ShopByCity />
            </>
          ) : (
            <>
              <section className="border-b border-[#00172B]/10 bg-white">
                <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-6 lg:px-8">
                  <p className="text-xs font-black uppercase tracking-[.25em] text-[#FF3D38]">
                    Down &amp; Distance
                  </p>
                  <h1 className="mt-2 text-4xl font-black uppercase sm:text-6xl">{categoryPage}</h1>
                  <p className="mt-3 text-lg font-semibold text-[#00172B]/60">
                    {CATEGORY_COPY[categoryPage]}
                  </p>
                </div>
              </section>
              <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00172B]/10 pb-5">
                  <button
                    type="button"
                    onClick={() => setMobileFilters(true)}
                    className="rounded-full border border-[#00172B]/15 bg-white px-5 py-3 text-sm font-black lg:hidden"
                  >
                    Filter
                  </button>
                  <div className="hidden items-center gap-3 lg:flex">
                    <CatalogFilters
                      city={city}
                      cities={categoryCities}
                      type={type}
                      types={productTypes}
                      onChange={updateCatalogQuery}
                    />
                  </div>
                  <label className="ml-auto flex items-center gap-3 rounded-full border border-[#00172B]/15 bg-white px-4 text-sm font-bold">
                    Sort
                    <select
                      value={sort}
                      onChange={(event) => updateCatalogQuery('sort', event.target.value)}
                      className="h-11 bg-transparent outline-none"
                    >
                      <option value="featured">Featured</option>
                      <option value="new">Newest</option>
                      <option value="price-low">Price: low to high</option>
                      <option value="price-high">Price: high to low</option>
                    </select>
                    <ChevronDown className="h-4 w-4" />
                  </label>
                </div>
                <p className="mt-5 text-sm font-bold text-[#00172B]/50">
                  {products.length} products
                </p>
                <MerchProductGrid products={products} onAdd={addItem} className="mt-6" />
              </section>
              {mobileFilters ? (
                <div
                  className="fixed inset-0 z-[95] bg-[#00172B]/60"
                  onClick={() => setMobileFilters(false)}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-[#f7f4ee] p-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black">Filters</h2>
                      <button onClick={() => setMobileFilters(false)} aria-label="Close filters">
                        <X />
                      </button>
                    </div>
                    <div className="mt-6 grid gap-4">
                      <CatalogFilters
                        city={city}
                        cities={categoryCities}
                        type={type}
                        types={productTypes}
                        onChange={updateCatalogQuery}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function StoreCollection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4 border-b border-[#00172B]/10 pb-4">
        <h2 className="text-3xl font-black uppercase">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-sm font-black uppercase text-[#FF3D38]"
        >
          Shop all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MerchProductGrid({
  products,
  onAdd,
  className = '',
}: {
  products: MerchProduct[];
  onAdd: (productId: string, size: string) => void;
  className?: string;
}) {
  if (!products.length)
    return (
      <div className="py-20 text-center">
        <Search className="mx-auto h-8 w-8 opacity-25" />
        <p className="mt-3 font-black">No gear found.</p>
      </div>
    );
  return (
    <div className={`grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-4 lg:grid-cols-4 ${className}`}>
      {products.map((product, index) => (
        <article key={product.id} className="group min-w-0">
          <Link
            href={`/merch/${product.id}`}
            aria-label={`View ${product.name}`}
            className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl ${index % 3 === 0 ? 'bg-[#e9dfd0]' : index % 3 === 1 ? 'bg-[#d9e1e4]' : 'bg-[#f0c9c4]'}`}
          >
            {product.badge ? (
              <span
                className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${product.badge === 'Sale' ? 'bg-[#FF3D38] text-white' : 'bg-[#00172B] text-white'}`}
              >
                {product.badge}
              </span>
            ) : null}
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-contain transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <Shirt className="h-20 w-20 text-[#00172B]/35 sm:h-32 sm:w-32" strokeWidth={1} />
            )}
          </Link>
          <div className="mt-4">
            <p className="truncate text-xs font-bold text-[#00172B]/45">
              {product.cityName ? `${product.cityName} · ` : ''}
              {product.type}
            </p>
            <h3 className="mt-1 font-black leading-tight">
              <Link href={`/merch/${product.id}`} className="hover:underline">
                {product.name}
              </Link>
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-bold">
              <span className={product.compareAtPrice ? 'text-[#FF3D38]' : ''}>
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice ? (
                <span className="text-sm text-[#00172B]/35 line-through">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onAdd(product.id, product.sizes[0] ?? 'One Size')}
              className="mt-3 text-xs font-black uppercase tracking-wider text-[#FF3D38]"
            >
              Quick add +
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CatalogFilters({
  city,
  cities,
  type,
  types,
  onChange,
}: {
  city: string;
  cities: typeof CITY_COLORWAYS;
  type: string;
  types: string[];
  onChange: (key: 'city' | 'type' | 'sort', value: string) => void;
}) {
  return (
    <>
      {cities.length > 0 ? (
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider">
          City
          <select
            value={city}
            onChange={(event) => onChange('city', event.target.value)}
            className="min-h-11 rounded-xl border border-[#00172B]/15 bg-white px-3 text-sm normal-case tracking-normal"
          >
            <option value="ALL">All cities</option>
            {cities.map((item) => (
              <option key={item.cityCode} value={item.cityCode}>
                {item.cityName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="grid gap-1 text-xs font-black uppercase tracking-wider">
        Product type
        <select
          value={type}
          onChange={(event) => onChange('type', event.target.value)}
          className="min-h-11 rounded-xl border border-[#00172B]/15 bg-white px-3 text-sm normal-case tracking-normal"
        >
          <option value="ALL">All types</option>
          {types.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function ShopByCity() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
            Shop by city
          </p>
          <h2 className="mt-2 text-3xl font-black">Find your colorway.</h2>
        </div>
      </div>
      <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
        {CITY_COLORWAYS.map((colorway) => (
          <Link
            key={colorway.cityCode}
            href={`/merch/accessories?city=${colorway.cityCode}`}
            className="relative min-w-40 rounded-2xl border-4 px-5 py-6 font-black"
            style={{
              backgroundColor: colorway.primary,
              borderColor: colorway.secondary,
              color: colorway.textColor,
            }}
          >
            {colorway.cityName.toUpperCase()}
          </Link>
        ))}
      </div>
    </section>
  );
}
