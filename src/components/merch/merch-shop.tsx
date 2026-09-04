'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, Search, Shirt, Tag, X } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import { MerchCartButton, useMerchCart } from '@/components/merch/merch-cart';
import TeamThemeProvider from '@/components/team-theme-provider';
import MoveTheChainsIndicator from '@/components/rewards/move-the-chains-indicator';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import { MERCH_CATEGORIES, MERCH_PRODUCTS, type MerchCategory } from '@/features/merch/catalog';
import type { MerchProduct } from '@/features/merch/catalog';
import { CITY_COLORWAYS } from '@/features/merch/city-colorways';

export default function MerchShop() {
  const [category, setCategory] = useState<MerchCategory | 'All'>('All');
  const [city, setCity] = useState<string>('ALL');
  const [sort, setSort] = useState('featured');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<MerchProduct[]>(MERCH_PRODUCTS);
  const { addItem } = useMerchCart();

  useEffect(() => {
    void fetch('/api/commerce/catalog')
      .then((response) => response.json())
      .then((body) =>
        setCatalogProducts(
          body.products.map((product: any) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            type: product.variants[0]?.cityName ? 'Koozie' : product.category,
            price: product.basePriceCents / 100,
            colors: ['#00172B'],
            sizes: [
              ...new Set(product.variants.map((variant: any) => variant.size).filter(Boolean)),
            ],
            imageUrl: product.variants[0]?.imageUrl,
            badge: product.featured ? 'New' : undefined,
            cityCode: product.variants[0]?.cityCode,
            cityName: product.variants[0]?.cityName,
          })),
        ),
      );
  }, []);

  const products = useMemo(() => {
    const filtered = catalogProducts.filter(
      (product) =>
        (category === 'All' || product.category === category) &&
        (city === 'ALL' || product.cityCode === city),
    );
    return [...filtered].sort((left, right) => {
      if (sort === 'price-low') return left.price - right.price;
      if (sort === 'price-high') return right.price - left.price;
      if (sort === 'new') return Number(right.badge === 'New') - Number(left.badge === 'New');
      return Number(Boolean(right.badge)) - Number(Boolean(left.badge));
    });
  }, [catalogProducts, category, city, sort]);
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
        <div className="border-b border-[#00172B]/10 bg-[#FF3D38] text-white">
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
              <button type="button" onClick={() => setCategory('All')}>
                New &amp; Trending
              </button>
              {MERCH_CATEGORIES.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCategory(item)}
                  className={category === item ? 'underline decoration-2 underline-offset-8' : ''}
                >
                  {item}
                </button>
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
              <button
                type="button"
                onClick={() => {
                  setCategory('All');
                  setMobileMenu(false);
                }}
                className="border-b border-white/10 py-4 text-left"
              >
                New &amp; Trending
              </button>
              {MERCH_CATEGORIES.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => {
                    setCategory(item);
                    setMobileMenu(false);
                  }}
                  className="border-b border-white/10 py-4 text-left"
                >
                  {item}
                </button>
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
          <section className="overflow-hidden bg-white text-[#00172B]">
            <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-16">
              <div className="py-4 lg:py-8">
                <p className="inline-flex rounded-full bg-[#FF3D38] px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-white">
                  Down &amp; Distance originals
                </p>
                <h1 className="mt-5 max-w-3xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#00172B] sm:text-7xl">
                  Gear for people who live football.
                </h1>
                <p className="mt-6 max-w-xl text-lg font-semibold leading-7 text-[#00172B]/70">
                  D&amp;D originals in city-inspired colorways. No logos. Just football.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('All');
                    setCity('ALL');
                  }}
                  className="mt-8 inline-flex h-14 items-center gap-3 rounded-full bg-[#00172B] px-7 font-black text-white"
                >
                  Shop all <ArrowRight className="h-4 w-4" />
                </button>
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
          <section className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
              Shop by city
            </p>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
              <button
                onClick={() => setCity('ALL')}
                className={`min-w-32 rounded-2xl border-4 px-5 py-6 text-left font-black ${city === 'ALL' ? 'border-[#FF3D38] bg-[#00172B] text-white' : 'border-transparent bg-white'}`}
              >
                ALL
              </button>
              {CITY_COLORWAYS.map((colorway) => (
                <button
                  key={colorway.cityCode}
                  onClick={() => {
                    setCity(colorway.cityCode);
                    setCategory('Accessories');
                  }}
                  className="relative min-w-40 overflow-hidden rounded-2xl border-4 px-5 py-6 text-left font-black"
                  style={{
                    backgroundColor: colorway.primary,
                    borderColor: city === colorway.cityCode ? '#FF3D38' : colorway.secondary,
                    color: colorway.textColor,
                  }}
                >
                  <span className="relative z-10">{colorway.cityName.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {MERCH_CATEGORIES.map((item, index) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${category === item ? 'team-primary-filled border-[var(--team-primary-fill)]' : 'border-[#00172B]/10 bg-white'}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00172B] text-[#F4D9B7]">
                    {item === 'Sale' ? <Tag className="h-4 w-4" /> : <Shirt className="h-4 w-4" />}
                  </span>
                  <span className="mt-5 block text-lg font-black">{item}</span>
                  <span className="mt-1 block text-xs font-bold opacity-50">
                    {catalogProducts.filter((product) => product.category === item).length} products
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-end justify-between gap-4 border-b border-[#00172B]/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FF3D38]">
                  {city !== 'ALL'
                    ? `${CITY_COLORWAYS.find((item) => item.cityCode === city)?.cityName} colorway`
                    : category === 'All'
                      ? 'New & trending'
                      : category}
                </p>
                <h2 className="mt-2 text-3xl font-black">Gear worth putting in the rotation.</h2>
              </div>
              <label className="flex items-center gap-3 rounded-full border border-[#00172B]/15 bg-white px-4 text-sm font-bold">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-11 appearance-none bg-transparent pr-5 outline-none"
                >
                  <option value="featured">Featured</option>
                  <option value="new">Newest</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                </select>
                <ChevronDown className="h-4 w-4" />
              </label>
            </div>
            <div className="mt-6 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product, index) => (
                <article key={product.id} className="group">
                  <Link
                    href={`/merch/${product.id}`}
                    aria-label={`View ${product.name}`}
                    className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl ${index % 3 === 0 ? 'bg-[#e9dfd0]' : index % 3 === 1 ? 'bg-[#d9e1e4]' : 'bg-[#f0c9c4]'}`}
                  >
                    {product.badge ? (
                      <span
                        className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${product.badge === 'Sale' ? 'bg-[#FF3D38]' : 'bg-[#00172B] text-white'}`}
                      >
                        {product.badge}
                      </span>
                    ) : null}
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-contain transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <>
                        <Shirt
                          className="h-32 w-32 text-[#00172B] transition group-hover:scale-105"
                          strokeWidth={1}
                        />
                        <span className="absolute bottom-5 rounded bg-[#00172B] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#F4D9B7]">
                          Down &amp; Distance
                        </span>
                      </>
                    )}
                  </Link>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-[#00172B]/45">{product.type}</p>
                    <h3 className="mt-1 font-black">
                      <Link href={`/merch/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </h3>
                    <div className="mt-2 flex items-center gap-2 font-bold">
                      <span>${product.price.toFixed(2)}</span>
                      {product.compareAtPrice ? (
                        <span className="text-sm text-[#00172B]/35 line-through">
                          ${product.compareAtPrice.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {product.colors.map((color) => (
                          <span
                            key={color}
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(product.id, product.sizes[0] ?? 'One Size')}
                        className="text-xs font-black uppercase tracking-wider text-[#FF3D38]"
                      >
                        Quick add +
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!products.length ? (
              <div className="py-20 text-center">
                <Search className="mx-auto h-8 w-8 opacity-25" />
                <p className="mt-3 font-black">No gear found.</p>
              </div>
            ) : null}
          </section>
        </main>
        <footer className="mt-12 bg-[#00172B] px-4 py-10 text-[#F4D9B7]">
          <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 sm:flex-row">
            <p className="font-black">Down &amp; Distance Supply Co.</p>
            <p className="text-sm opacity-55">Storefront preview · Stripe test checkout enabled</p>
          </div>
        </footer>
      </div>
    </TeamThemeProvider>
  );
}
