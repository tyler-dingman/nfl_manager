'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Minus, PackageCheck, Plus, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import LoginButton from '@/components/auth/login-button';
import { MerchCartButton, useMerchCart } from '@/components/merch/merch-cart';
import TeamThemeProvider from '@/components/team-theme-provider';
import MoveTheChainsIndicator from '@/components/rewards/move-the-chains-indicator';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import type { MerchProduct } from '@/features/merch/catalog';

export default function MerchProductDetail({ product }: { product: MerchProduct }) {
  const [size, setSize] = useState(product.sizes[0] ?? 'One Size');
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useMerchCart();

  return (
    <TeamThemeProvider>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <SiteHeaderShell tone="merch">
          <SiteHeaderLogo generic />
          <PrimaryNavigation active="merch" tone="dark" />
          <div className="ml-auto flex items-center gap-2">
            <MoveTheChainsIndicator />
            <LoginButton dark={false} />
            <MerchCartButton />
          </div>
        </SiteHeaderShell>
        <div className="bg-[#00172B] px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#F4D9B7]">
          Free shipping on orders $75+ · Shop preview
        </div>

        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
          <Link
            href="/merch"
            className="inline-flex items-center gap-2 text-sm font-black text-[#00172B]/60 hover:text-[#00172B]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to shop
          </Link>
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:gap-16">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(0,23,43,0.08)]">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xl font-black text-[#00172B]/25">
                  Down &amp; Distance
                </div>
              )}
              {product.badge ? (
                <span className="absolute left-5 top-5 rounded-full bg-[#FF3D38] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  {product.badge}
                </span>
              ) : null}
            </div>

            <div className="lg:pt-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF3D38]">
                {product.type}
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{product.name}</h1>
              <p className="mt-5 text-2xl font-black">${product.price.toFixed(2)}</p>
              <p className="mt-6 text-lg font-semibold leading-8 text-[#00172B]/65">
                {product.type === 'Koozie'
                  ? 'Keep it cold. Rep your city. All season long.'
                  : 'Built for Sundays, Saturdays, and everything in between.'}
              </p>
              {product.cityName ? (
                <p className="mt-5 text-sm font-black uppercase tracking-wider">
                  City colorway · {product.cityName}
                </p>
              ) : null}

              <div className="mt-8 border-t border-[#00172B]/10 pt-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black uppercase tracking-[0.12em]">Select size</p>
                  <button type="button" className="text-xs font-black underline underline-offset-4">
                    Size guide
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
                  {product.sizes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSize(item)}
                      className={`h-12 rounded-xl border text-sm font-black transition ${size === item ? 'border-[#00172B] bg-[#00172B] text-white' : 'border-[#00172B]/15 bg-white hover:border-[#00172B]'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <p className="text-sm font-black uppercase tracking-[0.12em]">Quantity</p>
                <div className="mt-3 inline-flex items-center rounded-full border bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="p-3"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center font-black">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                    className="p-3"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => addItem(product.id, size, quantity)}
                className="mt-7 flex h-16 w-full items-center justify-center rounded-full bg-[#FF3D38] text-lg font-black text-white transition hover:bg-[#e93430]"
              >
                Add to cart · ${(product.price * quantity).toFixed(2)}
              </button>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-[#00172B]/50">
                <Check className="h-4 w-4" /> Demo cart — no payment collected
              </p>

              <div className="mt-9 grid gap-3 border-t border-[#00172B]/10 pt-7 text-sm font-bold sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <span className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-[#FF3D38]" /> Ships in 2–3 days
                </span>
                <span className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5 text-[#FF3D38]" /> Easy returns
                </span>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#FF3D38]" /> Secure demo
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </TeamThemeProvider>
  );
}
