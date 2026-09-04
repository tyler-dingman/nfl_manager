'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const date = (x: string) =>
  new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export function CustomerOrders() {
  const [orders, setOrders] = useState<any[] | null>(null),
    [tab, setTab] = useState('ALL');
  useEffect(() => {
    void fetch('/api/commerce/orders', { cache: 'no-store' }).then(async (r) => {
      if (r.status === 401) {
        location.href = '/login?next=/orders';
        return;
      }
      setOrders((await r.json()).orders);
    });
  }, []);
  const visible = (orders ?? []).filter(
    (o) =>
      tab === 'ALL' ||
      (tab === 'PROCESSING'
        ? ['NEW', 'PICKING', 'PACKED'].includes(o.fulfillment_status)
        : o.fulfillment_status === tab),
  );
  return (
    <CommerceShell>
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">Your account</p>
      <h1 className="mt-2 text-5xl font-black">MY ORDERS</h1>
      <div className="mt-7 flex gap-2">
        {['ALL', 'PROCESSING', 'SHIPPED', 'CANCELED'].map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`rounded-full px-4 py-2 text-xs font-black ${tab === x ? 'bg-[#FF3D38] text-white' : 'bg-white'}`}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="mt-7 grid gap-3">
        {orders === null ? (
          <p>Loading orders…</p>
        ) : visible.length ? (
          visible.map((order) => (
            <Link
              href={`/orders/${order.id}`}
              key={order.id}
              className="grid gap-2 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <p className="text-xl font-black">#{order.order_number}</p>
                <p className="text-sm text-slate-500">{date(order.created_at)}</p>
              </div>
              <p className="font-black">{money(order.total_cents)}</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#00172B] px-3 py-1 text-xs font-black text-white">
                  {order.fulfillment_status}
                </span>
                {order.payment_status.includes('REFUND') ? (
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black">
                    {order.payment_status.replaceAll('_', ' ')}
                  </span>
                ) : null}
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-2xl bg-white p-8 text-center font-bold">No orders in this view.</p>
        )}
      </div>
    </CommerceShell>
  );
}
export function CustomerOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<any | null | undefined>();
  useEffect(() => {
    void fetch(`/api/commerce/orders/${orderId}`, { cache: 'no-store' }).then(async (r) =>
      setOrder(r.ok ? (await r.json()).order : null),
    );
  }, [orderId]);
  if (order === undefined) return <CommerceShell>Loading order…</CommerceShell>;
  if (!order) return <CommerceShell>Order not found.</CommerceShell>;
  const steps = ['NEW', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'];
  const current = steps.indexOf(order.fulfillment_status);
  return (
    <CommerceShell>
      <Link href="/orders" className="text-sm font-black">
        ← Back to orders
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#FF3D38]">Order</p>
          <h1 className="text-4xl font-black">#{order.order_number}</h1>
          <p className="mt-2 text-sm text-slate-500">Placed {date(order.created_at)}</p>
        </div>
        <span className="rounded-full bg-[#00172B] px-4 py-2 text-xs font-black text-white">
          {order.fulfillment_status}
        </span>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl bg-white p-6">
          <h2 className="font-black">ITEMS</h2>
          {order.items.map((item: any) => (
            <div key={item.id} className="mt-4 flex justify-between border-t pt-4">
              <div>
                <p className="font-black">{item.productName}</p>
                <p className="text-sm text-slate-500">
                  {item.variantLabel} · Qty {item.quantity}
                </p>
              </div>
              <p className="font-black">{money(item.lineTotalCents)}</p>
            </div>
          ))}
        </section>
        <section className="rounded-2xl bg-white p-6">
          <h2 className="font-black">ORDER SUMMARY</h2>
          {[
            ['Subtotal', order.subtotal_cents],
            ['Discount', -order.discount_total_cents],
            ['Shipping', order.shipping_total_cents],
            ['Estimated tax', order.tax_total_cents],
            ['Total', order.total_cents],
            ...(order.refunded_total_cents > 0
              ? [
                  ['Refunded', -order.refunded_total_cents],
                  ['Net paid', order.total_cents - order.refunded_total_cents],
                ]
              : []),
          ].map(([label, value]) => (
            <div key={String(label)} className="mt-3 flex justify-between">
              <span>{label}</span>
              <b>{money(Number(value))}</b>
            </div>
          ))}
        </section>
      </div>
      <section className="mt-6 rounded-2xl bg-white p-6">
        <h2 className="font-black">ORDER STATUS</h2>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {steps.map((step, index) => (
            <div key={step}>
              <div
                className={`h-2 rounded-full ${index <= current ? 'bg-[#FF3D38]' : 'bg-slate-200'}`}
              />
              <p className="mt-2 text-[10px] font-black">
                {step === 'NEW' ? 'ORDER RECEIVED' : step}
              </p>
            </div>
          ))}
        </div>
        {order.tracking_number ? (
          <p className="mt-6 rounded-xl bg-slate-100 p-4">
            <b>{order.carrier}</b> · {order.tracking_number}
          </p>
        ) : null}
      </section>
      <section className="mt-6 rounded-2xl bg-white p-6">
        <h2 className="font-black">SHIPPING ADDRESS</h2>
        <p className="mt-3 text-sm leading-6">
          {order.shipping_address.firstName} {order.shipping_address.lastName}
          <br />
          {order.shipping_address.address1}
          <br />
          {order.shipping_address.city}, {order.shipping_address.state}{' '}
          {order.shipping_address.postalCode}
        </p>
      </section>
    </CommerceShell>
  );
}
function CommerceShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
      <MainSiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">{children}</main>
    </div>
  );
}
