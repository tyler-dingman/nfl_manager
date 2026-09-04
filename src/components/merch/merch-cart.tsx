'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Check, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { MERCH_PRODUCTS, type MerchProduct } from '@/features/merch/catalog';
import {
  demoExpressProviders,
  type DemoExpressCheckoutProfile,
  type ExpressProviderId,
} from '@/features/merch/express-checkout';
import { PaymentBrandMark } from './payment-brand-mark';
import { StripeCardPayment } from './stripe-card-payment';
type CartItem = { productId: string; size: string; quantity: number };
type OrderConfirmation = { id: string; orderNumber: string; totalCents: number };
type PreparedStripeCheckout = {
  order: OrderConfirmation;
  paymentIntentId: string;
  clientSecret: string;
};
type Quote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number | null;
  taxCents: number | null;
  totalCents: number;
  promoCode: string | null;
};
type CheckoutStage = 'bag' | 'entry' | 'standard' | 'payment' | 'express-review';
type CartContextValue = {
  count: number;
  addItem: (productId: string, size: string, quantity?: number) => void;
  openCart: () => void;
};
const STORAGE_KEY = 'down-distance-demo-cart';
const STRIPE_CHECKOUT_STORAGE_KEY = 'down-distance-stripe-checkout';
const CartContext = createContext<CartContextValue | null>(null);
export function useMerchCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useMerchCart must be used inside MerchCartProvider');
  return value;
}
const inputClass =
  'mt-1 h-11 w-full rounded-xl border border-[#00172B]/15 bg-white px-3 font-semibold outline-none focus:border-[#FF3D38]';
export function MerchCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [catalogProducts, setCatalogProducts] = useState<MerchProduct[]>(MERCH_PRODUCTS),
    [open, setOpen] = useState(false),
    [checkoutStage, setCheckoutStage] = useState<CheckoutStage>('bag'),
    [hydrated, setHydrated] = useState(false),
    [placing, setPlacing] = useState(false),
    [stripeCheckout, setStripeCheckout] = useState<PreparedStripeCheckout | null>(null);
  const checkoutAttemptId = useRef<string | null>(null);
  const [order, setOrder] = useState<OrderConfirmation | null>(null),
    [error, setError] = useState(''),
    [promoCode, setPromoCode] = useState(''),
    [quote, setQuote] = useState<Quote | null>(null),
    [expressProvider, setExpressProvider] = useState<ExpressProviderId | null>(null),
    [expressProfile, setExpressProfile] = useState<DemoExpressCheckoutProfile | null>(null),
    [expressLoading, setExpressLoading] = useState<ExpressProviderId | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
    fetch('/api/commerce/catalog')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        const products = (body.products ?? []).map((product: any) => {
          const fallback = MERCH_PRODUCTS.find((item) => item.id === product.id);
          return {
            ...fallback,
            id: product.id,
            name: product.name,
            category: product.category,
            type: fallback?.type ?? product.category,
            price: product.basePriceCents / 100,
            colors: fallback?.colors ?? ['#00172B'],
            sizes: product.variants.map((variant: any) => variant.size),
            imageUrl: product.variants[0]?.imageUrl ?? fallback?.imageUrl,
            cityCode: product.variants[0]?.cityCode ?? fallback?.cityCode,
            cityName: product.variants[0]?.cityName ?? fallback?.cityName,
          } satisfies MerchProduct;
        });
        if (products.length) setCatalogProducts(products);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const stored = sessionStorage.getItem(STRIPE_CHECKOUT_STORAGE_KEY);
    if (!stored) return;
    try {
      const checkout = JSON.parse(stored) as PreparedStripeCheckout;
      void fetch('/api/commerce/stripe/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: checkout.order.id,
          paymentIntentId: checkout.paymentIntentId,
        }),
      })
        .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
        .then(({ response, body }) => {
          if (!response.ok) return;
          if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(body.order.paymentStatus)) {
            setOrder(checkout.order);
            setItems([]);
            sessionStorage.removeItem(STRIPE_CHECKOUT_STORAGE_KEY);
          } else if (body.order.paymentStatus === 'CANCELED') {
            sessionStorage.removeItem(STRIPE_CHECKOUT_STORAGE_KEY);
          } else {
            setStripeCheckout(checkout);
            setCheckoutStage('payment');
          }
          setOpen(true);
        });
    } catch {
      sessionStorage.removeItem(STRIPE_CHECKOUT_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);
  const count = items.reduce((n, x) => n + x.quantity, 0),
    subtotal = items.reduce(
      (n, x) => n + (catalogProducts.find((p) => p.id === x.productId)?.price ?? 0) * x.quantity,
      0,
    );
  const addItem = (productId: string, size: string, quantity = 1) => {
    setItems((current) => {
      const match = current.find((x) => x.productId === productId && x.size === size);
      return match
        ? current.map((x) => (x === match ? { ...x, quantity: x.quantity + quantity } : x))
        : [...current, { productId, size, quantity }];
    });
    setOrder(null);
    setStripeCheckout(null);
    sessionStorage.removeItem(STRIPE_CHECKOUT_STORAGE_KEY);
    checkoutAttemptId.current = null;
    setCheckoutStage('bag');
    setOpen(true);
    console.info('add_to_cart', { productId, quantity });
  };
  const update = (target: CartItem, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((x) => x.productId !== target.productId || x.size !== target.size)
        : current.map((x) => (x === target ? { ...x, quantity } : x)),
    );
    if (quantity <= 0) console.info('remove_from_cart', { productId: target.productId });
  };
  const placeOrder = async (payload: Record<string, unknown>) => {
    setPlacing(true);
    setError('');
    const response = await fetch('/api/commerce/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, promoCode: quote?.promoCode ?? undefined, items }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      setOrder(body.order);
      setItems([]);
      console.info('demo_order_placed', { orderId: body.order.id });
      console.info('order_confirmation_viewed', { orderId: body.order.id });
    } else setError(body?.error ?? 'Unable to place order.');
    setPlacing(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPlacing(true);
    setError('');
    const attemptId = checkoutAttemptId.current ?? crypto.randomUUID();
    checkoutAttemptId.current = attemptId;
    const response = await fetch('/api/commerce/stripe/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        checkoutAttemptId: attemptId,
        email: form.get('email'),
        phone: form.get('phone') || undefined,
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        address1: form.get('address1'),
        address2: form.get('address2') || undefined,
        city: form.get('city'),
        state: form.get('state'),
        postalCode: form.get('postalCode'),
        shippingMethod: form.get('shippingMethod'),
        promoCode: quote?.promoCode ?? undefined,
        items,
      }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      setStripeCheckout(body);
      sessionStorage.setItem(STRIPE_CHECKOUT_STORAGE_KEY, JSON.stringify(body));
      setCheckoutStage('payment');
    } else setError(body?.error ?? 'Unable to start card checkout.');
    setPlacing(false);
  };
  const confirmStripePayment = async (paymentIntentId: string) => {
    if (!stripeCheckout) throw new Error('Card checkout is not ready.');
    if (paymentIntentId !== stripeCheckout.paymentIntentId)
      throw new Error('Stripe returned an unexpected payment reference.');
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch('/api/commerce/stripe/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: stripeCheckout.order.id, paymentIntentId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Unable to verify payment.');
      if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(body.order.paymentStatus)) {
        setOrder(stripeCheckout.order);
        setItems([]);
        checkoutAttemptId.current = null;
        setStripeCheckout(null);
        sessionStorage.removeItem(STRIPE_CHECKOUT_STORAGE_KEY);
        console.info('stripe_test_order_confirmed', { orderId: body.order.id });
        console.info('order_confirmation_viewed', { orderId: body.order.id });
        return;
      }
      if (body.order.paymentStatus === 'CANCELED')
        throw new Error("Payment didn't go through. Check your card details and try again.");
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    throw new Error('Payment was received and is still being verified. Check again in a moment.');
  };
  const prepareStripeRetry = async () => {
    if (!stripeCheckout) throw new Error('Card checkout is not ready.');
    const response = await fetch('/api/commerce/stripe/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: stripeCheckout.order.id,
        paymentIntentId: stripeCheckout.paymentIntentId,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? 'Unable to prepare payment.');
  };
  const applyPromo = async () => {
    setError('');
    const response = await fetch('/api/commerce/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items, promoCode: promoCode || undefined }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setError(body?.error ?? 'Unable to apply promo code.');
    setQuote(body.quote);
    console.info('promo_code_applied', { promoCode: body.quote.promoCode });
  };
  const startExpress = async (providerId: ExpressProviderId) => {
    setError('');
    setExpressLoading(providerId);
    console.info('express_checkout_selected', { provider: providerId });
    try {
      const profile = await demoExpressProviders[providerId].startCheckout();
      const response = await fetch('/api/commerce/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items,
          promoCode: quote?.promoCode ?? undefined,
          shippingMethod: 'STANDARD',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error);
      setQuote(body.quote);
      setExpressProfile(profile);
      setExpressProvider(providerId);
      setCheckoutStage('express-review');
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Express checkout temporarily unavailable.',
      );
    } finally {
      setExpressLoading(null);
    }
  };
  const value = useMemo(() => ({ count, addItem, openCart: () => setOpen(true) }), [count]);
  return (
    <CartContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end bg-[#00172B]/45 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col bg-[#f7f4ee] text-[#00172B] shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#00172B]/10 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
                  {order
                    ? 'Order confirmed'
                    : checkoutStage === 'bag'
                      ? 'Your bag'
                      : 'Secure checkout'}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {order
                    ? 'Thanks for your order'
                    : checkoutStage === 'entry'
                      ? 'How do you want to check out?'
                      : checkoutStage === 'express-review'
                        ? 'Review your order'
                        : checkoutStage === 'payment'
                          ? 'Secure card payment'
                          : checkoutStage === 'standard'
                            ? 'Almost game time.'
                            : `${count} items`}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full border bg-white"
                aria-label="Close cart"
              >
                <X />
              </button>
            </header>
            {order ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-[#FF3D38] text-white">
                  <Check className="h-10 w-10" />
                </span>
                <h3 className="mt-6 text-3xl font-black">THANKS FOR YOUR ORDER</h3>
                <p className="mt-3 text-xl font-black">Order #{order.orderNumber}</p>
                <p className="mt-2 text-[#00172B]/60">
                  Test order confirmed. No real charge was made.
                </p>
                <div className="mt-7 w-full rounded-2xl bg-white p-5 text-left">
                  <p className="font-black">WHAT’S NEXT</p>
                  <p className="mt-3 text-sm">
                    <b>Order Received</b>
                    <br />
                    We’ll let you know when it ships.
                  </p>
                  <p className="mt-3 text-sm">
                    <b>Track Your Order</b>
                    <br />
                    Tracking appears once shipped.
                  </p>
                </div>
                <Link
                  href="/orders"
                  onClick={() => setOpen(false)}
                  className="mt-7 rounded-full bg-[#00172B] px-7 py-4 font-black text-white"
                >
                  VIEW YOUR ORDERS
                </Link>
              </div>
            ) : checkoutStage === 'entry' ? (
              <CheckoutEntry
                subtotal={subtotal}
                quote={quote}
                promoCode={promoCode}
                setPromoCode={setPromoCode}
                applyPromo={applyPromo}
                error={error}
                expressLoading={expressLoading}
                startExpress={startExpress}
                continueStandard={() => {
                  setCheckoutStage('standard');
                  console.info('standard_checkout_selected');
                  console.info('standard_checkout_started');
                }}
                back={() => setCheckoutStage('bag')}
              />
            ) : checkoutStage === 'express-review' && expressProfile && expressProvider ? (
              <ExpressReview
                provider={expressProvider}
                profile={expressProfile}
                quote={quote}
                placing={placing}
                error={error}
                back={() => setCheckoutStage('entry')}
                place={() =>
                  placeOrder({
                    ...expressProfile,
                    shippingMethod: 'STANDARD',
                    paymentMethod: expressProvider,
                  })
                }
              />
            ) : checkoutStage === 'payment' && stripeCheckout ? (
              <StripeCardPayment
                clientSecret={stripeCheckout.clientSecret}
                orderId={stripeCheckout.order.id}
                totalCents={stripeCheckout.order.totalCents}
                onConfirmed={confirmStripePayment}
                onBeforeConfirm={prepareStripeRetry}
                onBack={() => setCheckoutStage('standard')}
              />
            ) : checkoutStage === 'standard' ? (
              <form onSubmit={submit} className="flex-1 overflow-y-auto p-6">
                <div className="rounded-2xl bg-[#F4D9B7] p-4 text-sm font-bold">
                  STRIPE TEST MODE — NO REAL CHARGE WILL BE MADE
                </div>
                <Section title="Contact">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="email" label="Email" type="email" required />
                    <Field name="phone" label="Phone (optional)" />
                  </div>
                </Section>
                <Section title="Shipping information">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="firstName" label="First name" required />
                    <Field name="lastName" label="Last name" required />
                  </div>
                  <Field name="address1" label="Address" required />
                  <Field name="address2" label="Address line 2" />
                  <div className="grid grid-cols-3 gap-3">
                    <Field name="city" label="City" required />
                    <Field name="state" label="State" required />
                    <Field name="postalCode" label="ZIP" required />
                  </div>
                </Section>
                <Section title="Shipping method">
                  <Choice
                    name="shippingMethod"
                    value="STANDARD"
                    label="Standard · $6.99"
                    defaultChecked
                  />
                  <Choice name="shippingMethod" value="EXPRESS" label="Express · $12.99" />
                </Section>
                <Section title="Payment">
                  <Choice
                    name="paymentMethod"
                    value="CARD"
                    label="Card — secure Stripe test payment"
                    defaultChecked
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Enter Stripe test-card details on the next step. Never use a live card here.
                  </p>
                </Section>
                {error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
                  >
                    {error}
                  </p>
                ) : null}
                <div className="mt-6 flex justify-between border-t py-5 text-lg font-black">
                  <span>Items</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <button
                  disabled={placing}
                  className="h-14 w-full rounded-full bg-[#FF3D38] font-black text-white disabled:opacity-50"
                >
                  {placing ? 'PREPARING PAYMENT…' : 'CONTINUE TO SECURE PAYMENT'}
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutStage('entry')}
                  className="mt-2 w-full py-3 text-sm font-black"
                >
                  Back to bag
                </button>
              </form>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  {!items.length ? (
                    <div className="grid h-full place-content-center text-center">
                      <ShoppingBag className="mx-auto h-12 w-12 opacity-25" />
                      <h3 className="mt-4 text-2xl font-black">Your bag is empty.</h3>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {items.map((item) => {
                        const product = catalogProducts.find((p) => p.id === item.productId);
                        if (!product) return null;
                        return (
                          <div
                            key={`${item.productId}-${item.size}`}
                            className="flex gap-4 border-b pb-5"
                          >
                            <div className="relative h-28 w-24 shrink-0 rounded-xl bg-white">
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
                            <div className="flex-1">
                              <p className="font-black">{product.name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {product.cityName ? `${product.cityName} Colorway · ` : ''}
                                {item.size}
                              </p>
                              <p className="mt-2 font-black">
                                ${(product.price * item.quantity).toFixed(2)}
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex items-center rounded-full border bg-white">
                                  <button
                                    onClick={() => update(item, item.quantity - 1)}
                                    className="p-2"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-black">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => update(item, item.quantity + 1)}
                                    className="p-2"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => update(item, 0)}
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
                  <footer className="border-t bg-white p-6">
                    <div className="flex justify-between text-xl font-black">
                      <span>Item total</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Shipping, promo, and estimated tax calculated at checkout.
                    </p>
                    <button
                      onClick={() => {
                        setCheckoutStage('entry');
                        console.info('checkout_started', { itemCount: count });
                        console.info('checkout_entry_viewed');
                      }}
                      className="mt-5 h-14 w-full rounded-full bg-[#00172B] font-black text-white"
                    >
                      CHECKOUT
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="mt-2 w-full py-2 text-sm font-black"
                    >
                      Continue shopping
                    </button>
                  </footer>
                ) : null}
              </>
            )}
          </aside>
        </div>
      ) : null}
    </CartContext.Provider>
  );
}
function CheckoutEntry({
  subtotal,
  quote,
  promoCode,
  setPromoCode,
  applyPromo,
  error,
  expressLoading,
  startExpress,
  continueStandard,
  back,
}: {
  subtotal: number;
  quote: Quote | null;
  promoCode: string;
  setPromoCode: (value: string) => void;
  applyPromo: () => void;
  error: string;
  expressLoading: ExpressProviderId | null;
  startExpress: (provider: ExpressProviderId) => void;
  continueStandard: () => void;
  back: () => void;
}) {
  const subtotalCents = Math.round(subtotal * 100);
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="text-sm text-slate-500">
        Card checkout uses Stripe test mode. Express options remain preview-only.
      </p>
      <section className="mt-6">
        <h3 className="text-xs font-black uppercase tracking-[.18em]">Have a promo code?</h3>
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Promo code"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            className={`${inputClass} mt-0`}
            placeholder="CODE"
          />
          <button
            type="button"
            onClick={applyPromo}
            className="rounded-xl border border-[#00172B] px-5 font-black"
          >
            APPLY
          </button>
        </div>
        {quote?.promoCode ? (
          <p className="mt-2 text-sm font-black text-green-700">
            {quote.promoCode} · ${(quote.discountCents / 100).toFixed(2)} off
          </p>
        ) : null}
      </section>
      <section className="mt-7 rounded-2xl bg-white p-5">
        <h3 className="text-xs font-black uppercase tracking-[.18em]">Order summary</h3>
        <MoneyLine label="Items" cents={quote?.subtotalCents ?? subtotalCents} />
        {quote?.discountCents ? <MoneyLine label="Discount" cents={-quote.discountCents} /> : null}
        <MoneyLine label="Shipping" value="Calculated at checkout" />
        <MoneyLine label="Tax" value="Calculated at checkout" />
        <div className="mt-4 flex justify-between border-t pt-4 text-lg font-black">
          <span>Estimated subtotal</span>
          <span>${((quote?.totalCents ?? subtotalCents) / 100).toFixed(2)}</span>
        </div>
      </section>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      <section className="mt-7">
        <h3 className="text-center text-xs font-black uppercase tracking-[.18em]">
          Express checkout
        </h3>
        <div className="mt-3 grid gap-3">
          {(['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY'] as ExpressProviderId[]).map((id) => (
            <button
              key={id}
              type="button"
              disabled={Boolean(expressLoading)}
              onClick={() => startExpress(id)}
              aria-label={`Checkout with ${demoExpressProviders[id].label.replace(' Checkout', '')}`}
              className={`h-14 rounded-xl font-black disabled:opacity-60 ${id === 'PAYPAL' ? 'bg-[#00A8EA] text-white' : id === 'APPLE_PAY' ? 'apple-pay-demo-button bg-black text-white' : 'bg-black text-white'}`}
            >
              {expressLoading === id ? (
                <span className="wallet-loading-label">
                  OPENING {demoExpressProviders[id].label.toUpperCase()}…
                </span>
              ) : (
                <PaymentBrandMark provider={id} />
              )}
            </button>
          ))}
        </div>
      </section>
      <div className="my-6 flex items-center gap-3 text-xs font-black text-slate-400">
        <span className="h-px flex-1 bg-slate-300" />
        OR
        <span className="h-px flex-1 bg-slate-300" />
      </div>
      <button
        type="button"
        onClick={continueStandard}
        className="h-14 w-full rounded-full bg-[#00172B] font-black text-white"
      >
        CONTINUE TO CHECKOUT →
      </button>
      <button type="button" onClick={back} className="mt-2 w-full py-3 text-sm font-black">
        Back to bag
      </button>
    </div>
  );
}

function ExpressReview({
  provider,
  profile,
  quote,
  placing,
  error,
  back,
  place,
}: {
  provider: ExpressProviderId;
  profile: DemoExpressCheckoutProfile;
  quote: Quote | null;
  placing: boolean;
  error: string;
  back: () => void;
  place: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="rounded-2xl bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[.18em]">
          {demoExpressProviders[provider].label}
        </p>
        <h3 className="mt-5 font-black">Ship to</h3>
        <p className="mt-1 text-sm leading-6">
          {profile.firstName} {profile.lastName}
          <br />
          {profile.address1}
          <br />
          {profile.city}, {profile.state} {profile.postalCode}
        </p>
        <div className="mt-5 border-t pt-4">
          <MoneyLine label="Standard shipping" cents={quote?.shippingCents ?? 699} />
          <MoneyLine label="Estimated tax" cents={quote?.taxCents ?? 0} />
        </div>
        <div className="mt-4 flex justify-between border-t pt-4 text-xl font-black">
          <span>Order total</span>
          <span>${((quote?.totalCents ?? 0) / 100).toFixed(2)}</span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={placing}
        onClick={place}
        className="mt-6 h-14 w-full rounded-full bg-[#FF3D38] font-black text-white disabled:opacity-50"
      >
        {placing ? 'PLACING ORDER…' : 'PLACE DEMO ORDER'}
      </button>
      <button type="button" onClick={back} className="mt-2 w-full py-3 text-sm font-black">
        Back to checkout options
      </button>
    </div>
  );
}

function MoneyLine({ label, cents, value }: { label: string; cents?: number; value?: string }) {
  return (
    <div className="mt-3 flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-bold">
        {value ?? `${(cents ?? 0) < 0 ? '-' : ''}$${(Math.abs(cents ?? 0) / 100).toFixed(2)}`}
      </span>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 grid gap-3">
      <legend className="mb-2 text-xs font-black uppercase tracking-[.18em]">{title}</legend>
      {children}
    </fieldset>
  );
}
function Field({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input name={name} type={type} required={required} className={inputClass} />
    </label>
  );
}
function Choice({
  name,
  value,
  label,
  defaultChecked = false,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} required />
      {label}
    </label>
  );
}
export function MerchCartButton({ className = '' }: { className?: string }) {
  const { count, openCart } = useMerchCart();
  return (
    <button
      onClick={openCart}
      className={`relative grid h-10 w-10 place-items-center rounded-full border border-[#00172B]/15 ${className}`}
      aria-label={`Open shopping bag with ${count} items`}
    >
      <ShoppingBag className="h-5 w-5" />
      {count ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#00172B] px-1 text-[10px] font-black text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
