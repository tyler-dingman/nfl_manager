'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const tabs = ['dashboard', 'orders', 'inventory', 'products', 'customers', 'promos', 'settings'];
export default function CommerceDashboard() {
  const [section, setSection] = useState('dashboard'),
    [data, setData] = useState<any>(),
    [error, setError] = useState(''),
    [status, setStatus] = useState('ALL'),
    [search, setSearch] = useState(''),
    [orderId, setOrderId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(
      `/api/admin/commerce?section=${section}&status=${status}&search=${encodeURIComponent(search)}`,
      { cache: 'no-store' },
    );
    const b = await r.json();
    if (!r.ok) setError(b.error ?? 'Not found');
    else {
      setData(b);
      setError('');
    }
  }, [search, section, status]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <main className="p-10">
        <h1 className="text-3xl font-black">Commerce</h1>
        <p className="mt-4">{error}</p>
      </main>
    );
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
      <header className="bg-[#00172B] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#F4D9B7]">
              Down &amp; Distance internal
            </p>
            <h1 className="text-2xl font-black">COMMERCE</h1>
          </div>
          <Link href="/merch" className="text-sm font-black">
            View store →
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_1fr]">
        <nav className="p-5 lg:min-h-[calc(100vh-84px)] lg:border-r">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSection(tab);
                setOrderId(null);
              }}
              className={`mb-1 w-full rounded-xl px-4 py-3 text-left text-sm font-black uppercase ${section === tab ? 'bg-[#FF3D38] text-white' : 'hover:bg-white'}`}
            >
              {tab === 'promos' ? 'Promo codes' : tab}
            </button>
          ))}
        </nav>
        <main className="min-w-0 p-5 lg:p-8">
          {!data ? (
            <p>Loading commerce…</p>
          ) : orderId ? (
            <AdminOrder orderId={orderId} back={() => setOrderId(null)} reload={load} />
          ) : section === 'dashboard' ? (
            <Dashboard data={data} open={setOrderId} />
          ) : section === 'orders' ? (
            <Orders
              data={data}
              open={setOrderId}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
            />
          ) : section === 'inventory' ? (
            <Inventory data={data} reload={load} />
          ) : section === 'products' ? (
            <Products data={data} reload={load} />
          ) : section === 'customers' ? (
            <Customers data={data} />
          ) : section === 'promos' ? (
            <Promos data={data} />
          ) : (
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}
function Dashboard({ data, open }: { data: any; open: (id: string) => void }) {
  const t = data.today ?? {};
  return (
    <>
      <h2 className="text-4xl font-black">TODAY</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card label="New Orders" value={t.newOrders ?? 0} />
        <Card label="Revenue" value={money(t.revenue ?? 0)} />
        <Card label="Need Fulfillment" value={t.needFulfillment ?? 0} />
        <Card label="Shipped" value={t.shipped ?? 0} />
      </div>
      <h3 className="mt-9 text-xl font-black">RECENT ORDERS</h3>
      <OrderTable orders={data.recentOrders ?? []} open={open} />
      <h3 className="mt-9 text-xl font-black">LOW INVENTORY</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.lowInventory?.map((x: any) => (
          <div key={x.id} className="rounded-xl bg-white p-4">
            <b>{x.cityName ? `${x.cityName} Koozie` : x.name}</b>
            <span className="float-right">{x.available} available</span>
          </div>
        ))}
      </div>
    </>
  );
}
function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
function Orders({
  data,
  open,
  search,
  setSearch,
  status,
  setStatus,
}: {
  data: any;
  open: (id: string) => void;
  search: string;
  setSearch: (x: string) => void;
  status: string;
  setStatus: (x: string) => void;
}) {
  return (
    <>
      <h2 className="text-4xl font-black">ORDERS</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order, email, customer"
          className="h-11 min-w-64 rounded-xl border px-3"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border px-3"
        >
          {['ALL', 'NEW', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELED'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <OrderTable orders={data.orders ?? []} open={open} />
    </>
  );
}
function OrderTable({ orders, open }: { orders: any[]; open: (id: string) => void }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {['Order', 'Customer', 'Date', 'Items', 'Total', 'Payment', 'Fulfillment'].map((x) => (
              <th key={x} className="p-4">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              onClick={() => open(o.id)}
              className="cursor-pointer border-t hover:bg-slate-50"
            >
              <td className="p-4 font-black">{o.order_number}</td>
              <td className="p-4">{o.email}</td>
              <td className="p-4">{new Date(o.created_at).toLocaleDateString()}</td>
              <td className="p-4">{o.item_count}</td>
              <td className="p-4">{money(o.total_cents)}</td>
              <td className="p-4">{o.payment_status}</td>
              <td className="p-4 font-black">{o.fulfillment_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AdminOrder({
  orderId,
  back,
  reload,
}: {
  orderId: string;
  back: () => void;
  reload: () => void;
}) {
  const [order, setOrder] = useState<any>(),
    [carrier, setCarrier] = useState('USPS'),
    [tracking, setTracking] = useState(''),
    [note, setNote] = useState(''),
    [error, setError] = useState('');
  const load = useCallback(
    () =>
      fetch(`/api/admin/commerce/orders/${orderId}`)
        .then((r) => r.json())
        .then((b) => setOrder(b.order)),
    [orderId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!order) return <p>Loading order…</p>;
  const action =
    order.fulfillment_status === 'NEW'
      ? 'START_PICKING'
      : order.fulfillment_status === 'PICKING'
        ? 'MARK_PACKED'
        : order.fulfillment_status === 'PACKED'
          ? 'MARK_SHIPPED'
          : null;
  const update = async () => {
    if (!action) return;
    const r = await fetch(`/api/admin/commerce/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, carrier, trackingNumber: tracking, internalNote: note }),
    });
    const b = await r.json();
    if (r.ok) {
      setOrder(b.order);
      reload();
    } else setError(b.error);
  };
  return (
    <>
      <button onClick={back} className="font-black">
        ← Orders
      </button>
      <div className="mt-5 flex justify-between">
        <div>
          <p className="text-xs font-black text-[#FF3D38]">ORDER</p>
          <h2 className="text-4xl font-black">#{order.order_number}</h2>
        </div>
        <b>{order.fulfillment_status}</b>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h3 className="font-black">CUSTOMER</h3>
          <p className="mt-3">
            {order.customer_first_name} {order.customer_last_name}
            <br />
            {order.email}
            <br />
            {order.phone}
          </p>
          <p className="mt-3">
            {order.shipping_address.address1}
            <br />
            {order.shipping_address.city}, {order.shipping_address.state}{' '}
            {order.shipping_address.postalCode}
          </p>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h3 className="font-black">ITEMS</h3>
          {order.items.map((x: any) => (
            <div key={x.id} className="mt-3 border-t pt-3">
              <b>{x.productName}</b>
              <p>
                {x.variantLabel} · Qty {x.quantity} · {x.sku}
              </p>
            </div>
          ))}
        </section>
      </div>
      <section className="mt-5 rounded-2xl bg-white p-5">
        <h3 className="font-black">FULFILLMENT</h3>
        {order.fulfillment_status === 'PACKED' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="h-11 rounded-xl border px-3"
            >
              {['USPS', 'UPS', 'FEDEX', 'OTHER'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking number"
              className="h-11 rounded-xl border px-3"
            />
          </div>
        ) : null}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note"
          className="mt-3 h-20 w-full rounded-xl border p-3"
        />
        {action ? (
          <button
            onClick={() => void update()}
            className="mt-4 rounded-xl bg-[#FF3D38] px-6 py-3 font-black text-white"
          >
            {action.replaceAll('_', ' ')}
          </button>
        ) : (
          <p className="mt-4 font-bold">
            {order.carrier} {order.tracking_number}
          </p>
        )}
        {error ? <p className="mt-2 text-red-700">{error}</p> : null}
      </section>
    </>
  );
}
function Inventory({ data, reload }: { data: any; reload: () => void }) {
  const adjust = async (x: any) => {
    const raw = prompt('Quantity adjustment (+ or -)');
    if (!raw) return;
    const reason = prompt(
      'Reason: New stock, Damaged, Manual correction, Return, or Sample',
      'New stock',
    );
    if (!reason) return;
    await fetch(`/api/admin/commerce/inventory/${encodeURIComponent(x.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ delta: Number(raw), reason }),
    });
    reload();
  };
  return (
    <>
      <h2 className="text-4xl font-black">INVENTORY</h2>
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {['SKU', 'Product', 'City', 'Size', 'On Hand', 'Reserved', 'Available', ''].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.inventory.map((x: any) => (
              <tr key={x.id} className="border-t">
                <td className="p-3 font-mono text-xs">{x.sku}</td>
                <td>{x.productName}</td>
                <td>{x.cityName}</td>
                <td>{x.size}</td>
                <td>{x.onHand}</td>
                <td>{x.reserved}</td>
                <td className="font-black">{x.available}</td>
                <td>
                  <button onClick={() => void adjust(x)} className="font-black text-[#FF3D38]">
                    Adjust
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Products({ data, reload }: { data: any; reload: () => void }) {
  const create = async () => {
    const name = prompt('Product name');
    if (!name) return;
    const id = prompt('Product slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const sku = id ? prompt('Initial SKU', id.toUpperCase()) : null;
    if (!id || !sku) return;
    await fetch('/api/admin/commerce/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        sku,
        description: 'Built for football people.',
        category: 'Accessories',
        basePriceCents: 999,
        inventoryOnHand: 0,
        size: 'One Size',
      }),
    });
    reload();
  };
  const toggle = async (x: any) => {
    await fetch(`/api/admin/commerce/products/${x.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !x.active }),
    });
    reload();
  };
  return (
    <>
      <h2 className="text-4xl font-black">PRODUCTS</h2>
      <button
        onClick={() => void create()}
        className="mt-5 rounded-xl bg-[#FF3D38] px-5 py-3 font-black text-white"
      >
        CREATE PRODUCT
      </button>
      <div className="mt-5 grid gap-2">
        {data.products.map((x: any) => (
          <div key={x.id} className="flex items-center justify-between rounded-xl bg-white p-4">
            <div>
              <b>{x.name}</b>
              <p className="text-sm text-slate-500">
                {x.category} · {x.variant_count} variants · {money(x.base_price_cents)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const name = prompt('Product name', x.name);
                  if (name) {
                    await fetch(`/api/admin/commerce/products/${x.id}`, {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ name }),
                    });
                    reload();
                  }
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black"
              >
                EDIT
              </button>
              <button
                onClick={() => void toggle(x)}
                className={`rounded-full px-3 py-2 text-xs font-black ${x.active ? 'bg-green-100' : 'bg-slate-200'}`}
              >
                {x.active ? 'ACTIVE' : 'INACTIVE'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function Customers({ data }: { data: any }) {
  return (
    <>
      <h2 className="text-4xl font-black">CUSTOMERS</h2>
      <div className="mt-5 grid gap-2">
        {data.customers.map((x: any) => (
          <div key={x.email} className="grid rounded-xl bg-white p-4 sm:grid-cols-4">
            <b>{x.name}</b>
            <span>{x.email}</span>
            <span>{x.orderCount} orders</span>
            <b>{money(x.lifetimeSpendCents)}</b>
          </div>
        ))}
      </div>
    </>
  );
}
function Promos({ data }: { data: any }) {
  return (
    <>
      <h2 className="text-4xl font-black">PROMO CODES</h2>
      <div className="mt-5 grid gap-2">
        {data.promos.map((x: any) => (
          <div key={x.code} className="rounded-xl bg-white p-4">
            <b>{x.code}</b>
            <span className="ml-5">
              {x.type} · {x.value}
              {x.type === 'PERCENT' ? '%' : '¢'} · {x.active ? 'Active' : 'Inactive'} ·{' '}
              {x.usage_count} uses
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
function Settings() {
  return (
    <>
      <h2 className="text-4xl font-black">SETTINGS</h2>
      <div className="mt-5 rounded-2xl bg-white p-6">
        <p>
          <b>Payment:</b> Demo
        </p>
        <p>
          <b>Shipping:</b> Manual
        </p>
        <p>
          <b>Tax:</b> Demo estimate
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Stripe, wallet, PayPal, carrier, and production tax adapters are intentionally
          disconnected.
        </p>
      </div>
    </>
  );
}
