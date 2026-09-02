'use client';

import Image from 'next/image';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

import { MERCH_PRODUCTS } from '@/features/merch/catalog';

type CartItem = {
  productId: string;
  size: string;
  quantity: number;
};

type CartContextValue = {
  count: number;
  addItem: (productId: string, size: string) => void;
  openCart: () => void;
};

const STORAGE_KEY = 'down-distance-demo-cart';
const CartContext = createContext<CartContextValue | null>(null);

export function useMerchCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useMerchCart must be used inside MerchCartProvider');
  return context;
}

export function MerchCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [complete, setComplete] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored) as CartItem[]);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => {
    const product = MERCH_PRODUCTS.find((candidate) => candidate.id === item.productId);
    return total + (product?.price ?? 0) * item.quantity;
  }, 0);

  const addItem = (productId: string, size: string) => {
    setItems((current) => {
      const matching = current.find((item) => item.productId === productId && item.size === size);
      if (matching) {
        return current.map((item) =>
          item === matching ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { productId, size, quantity: 1 }];
    });
    setComplete(false);
    setCheckout(false);
    setIsOpen(true);
  };

  const updateQuantity = (target: CartItem, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((item) => item.productId !== target.productId || item.size !== target.size)
        : current.map((item) => (item === target ? { ...item, quantity } : item)),
    );
  };

  const value = useMemo(() => ({ count, addItem, openCart: () => setIsOpen(true) }), [count]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex justify-end bg-[#00172B]/45 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close cart"
          />
          <aside className="relative flex h-full w-full max-w-lg flex-col bg-[#f7f4ee] text-[#00172B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#00172B]/10 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FF3D38]">
                  {checkout ? 'Demo checkout' : 'Your bag'}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {complete ? 'Order confirmed' : checkout ? 'Almost game time.' : `${count} items`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#00172B]/15 bg-white"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {complete ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF3D38] text-white">
                  <Check className="h-10 w-10" />
                </span>
                <h3 className="mt-6 text-3xl font-black">Demo order placed.</h3>
                <p className="mt-3 max-w-sm font-semibold text-[#00172B]/60">
                  No payment was collected. This confirms the storefront experience is working end
                  to end.
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="mt-8 rounded-full bg-[#00172B] px-7 py-4 font-black text-white"
                >
                  Keep shopping
                </button>
              </div>
            ) : checkout ? (
              <form
                className="flex flex-1 flex-col overflow-y-auto p-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  setItems([]);
                  setComplete(true);
                }}
              >
                <div className="rounded-2xl bg-[#F4D9B7] p-4 text-sm font-bold">
                  Preview only — use any sample information. No payment will be processed.
                </div>
                <div className="mt-6 grid gap-4">
                  <label className="text-sm font-black">
                    Email
                    <input
                      required
                      type="email"
                      placeholder="fan@example.com"
                      className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                    />
                  </label>
                  <label className="text-sm font-black">
                    Shipping name
                    <input
                      required
                      placeholder="Patrick Fan"
                      className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                    />
                  </label>
                  <label className="text-sm font-black">
                    Address
                    <input
                      required
                      placeholder="123 Game Day Way"
                      className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-black">
                      City
                      <input
                        required
                        placeholder="Kansas City"
                        className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                      />
                    </label>
                    <label className="text-sm font-black">
                      ZIP
                      <input
                        required
                        inputMode="numeric"
                        placeholder="64101"
                        className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                      />
                    </label>
                  </div>
                  <label className="text-sm font-black">
                    Demo card
                    <input
                      required
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      className="mt-2 h-12 w-full rounded-xl border border-[#00172B]/15 bg-white px-4 font-semibold outline-none focus:border-[#FF3D38]"
                    />
                  </label>
                </div>
                <div className="mt-auto pt-8">
                  <div className="flex justify-between border-t border-[#00172B]/10 py-5 text-lg font-black">
                    <span>Demo total</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <button
                    type="submit"
                    className="h-14 w-full rounded-full bg-[#FF3D38] font-black text-white"
                  >
                    Place demo order
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckout(false)}
                    className="mt-3 w-full py-3 text-sm font-black"
                  >
                    Back to bag
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  {!items.length ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <ShoppingBag className="h-12 w-12 text-[#00172B]/25" />
                      <h3 className="mt-4 text-2xl font-black">Your bag is empty.</h3>
                      <p className="mt-2 font-semibold text-[#00172B]/55">
                        Add some gear to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {items.map((item) => {
                        const product = MERCH_PRODUCTS.find(
                          (candidate) => candidate.id === item.productId,
                        );
                        if (!product) return null;
                        return (
                          <div
                            key={`${item.productId}-${item.size}`}
                            className="flex gap-4 border-b border-[#00172B]/10 pb-5"
                          >
                            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-white">
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  sizes="96px"
                                  className="object-contain"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-black">{product.name}</p>
                              <p className="mt-1 text-sm font-bold text-[#00172B]/50">
                                Size {item.size}
                              </p>
                              <p className="mt-2 font-black">
                                ${(product.price * item.quantity).toFixed(2)}
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex items-center rounded-full border border-[#00172B]/15 bg-white">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item, item.quantity - 1)}
                                    className="p-2"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-black">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item, item.quantity + 1)}
                                    className="p-2"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item, 0)}
                                  className="p-2 text-[#00172B]/45"
                                  aria-label={`Remove ${product.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {items.length ? (
                  <div className="border-t border-[#00172B]/10 bg-white p-6">
                    <div className="flex justify-between text-xl font-black">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-[#00172B]/45">
                      Shipping and taxes calculated in the demo checkout.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCheckout(true)}
                      className="mt-5 h-14 w-full rounded-full bg-[#00172B] font-black text-white"
                    >
                      Pretend checkout
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </aside>
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function MerchCartButton({ className = '' }: { className?: string }) {
  const { count, openCart } = useMerchCart();
  return (
    <button
      type="button"
      onClick={openCart}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-[#00172B]/15 ${className}`}
      aria-label={`Open shopping bag with ${count} items`}
    >
      <ShoppingBag className="h-5 w-5" />
      {count ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00172B] px-1 text-[10px] font-black text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
