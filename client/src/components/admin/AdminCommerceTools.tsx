import { useMemo, useState, type ReactNode } from "react";
import type { Order } from "@/lib/api";
import { formatCurrency } from "@/lib/products";
import { fulfillmentQueue } from "@/lib/admin-operations";
import { adminActionRowClass, adminButtonClass, adminControlClass } from "./admin-ui";

type View = "Customers" | "Logistics";

type Props = {
  view: View;
  orders: Order[];
  onOpenOrder: (order: Order) => void;
};

const money = (value: number) => formatCurrency(Number.isFinite(value) ? value : 0);
const clean = (value?: string | null) => (value || "").trim().toLowerCase();
const title = (value?: string | null) =>
  (value || "Not specified").replace(/[_-]/g, " ").replace(/\b\w/g, character => character.toUpperCase());
const timestamp = (order: Order) => {
  const parsed = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};
const age = (order: Order) => {
  const created = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
  if (!Number.isFinite(created)) return "Age unavailable";
  const days = Math.max(0, Math.floor((Date.now() - created) / 86400000));
  return days === 0 ? "Today" : `${days}d old`;
};
const excludedFromValue = (order: Order) => ["cancelled", "canceled", "refunded"].includes(clean(order.status));
const statusPill = (value: string, tone = "slate") => `inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${{
  teal: "border-[#b9ded8] bg-[#e8f5f2] text-[#126f69]",
  amber: "border-[#ead6aa] bg-[#fff8e9] text-[#805e1d]",
  red: "border-[#ebc4be] bg-[#fff0ee] text-[#a44539]",
  navy: "border-[#c7d5dc] bg-[#eef4f6] text-[#12334a]",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
}[tone] || "border-slate-200 bg-slate-50 text-slate-600"}`;

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-[0_5px_18px_rgba(18,51,74,.04)] focus-within:border-[#16877f] focus-within:ring-2 focus-within:ring-[#16877f]/10">
      <span aria-hidden="true" className="text-lg leading-none text-[#16877f]">⌕</span>
      <span className="sr-only">Search</span>
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#12334a] outline-none placeholder:text-slate-400" />
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className={`${adminControlClass} normal-case tracking-normal`}>
        {children}
      </select>
    </label>
  );
}

function OrderButton({ order, onOpenOrder }: { order: Order; onOpenOrder: (order: Order) => void }) {
  return (
    <button type="button" onClick={() => onOpenOrder(order)} className="font-semibold text-[#126f69] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#16877f]/30" aria-label={`Open order ${order.orderNumber}`}>
      {order.orderNumber}
    </button>
  );
}

function CustomersView({ orders, onOpenOrder }: Omit<Props, "view">) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const customers = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; email: string; phone: string; orders: Order[] }>();
    orders.forEach(order => {
      const email = clean(order.customerEmail);
      const phone = clean(order.customerPhone).replace(/[^\d+]/g, "");
      const key = email ? `email:${email}` : phone ? `phone:${phone}` : `order:${order.id}`;
      const current = groups.get(key) || { key, name: order.customerName || "Unnamed buyer", email: order.customerEmail || "", phone: order.customerPhone || "", orders: [] };
      current.orders.push(order);
      if (!current.name && order.customerName) current.name = order.customerName;
      groups.set(key, current);
    });
    const search = clean(query);
    return Array.from(groups.values())
      .filter(customer => !search || `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(search))
      .sort((a, b) => {
        const latestTime = (items: Order[]) => Math.max(...items.map(timestamp));
        if (sort === "orders") return b.orders.length - a.orders.length || latestTime(b.orders) - latestTime(a.orders);
        if (sort === "value") return b.orders.filter(o => !excludedFromValue(o)).reduce((sum, o) => sum + o.total, 0) - a.orders.filter(o => !excludedFromValue(o)).reduce((sum, o) => sum + o.total, 0);
        return latestTime(b.orders) - latestTime(a.orders);
      });
  }, [orders, query, sort]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row">
        <SearchBox value={query} onChange={setQuery} placeholder="Search buyer name, email or phone" />
        <Select label="Sort buyers" value={sort} onChange={setSort}>
          <option value="recent">Most recent order</option>
          <option value="orders">Most orders</option>
          <option value="value">Highest booked value</option>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-slate-500">
        <span><strong className="text-[#12334a]">{customers.length}</strong> buyers with orders</span>
        <span>Cancelled and refunded orders count, but add no booked value.</span>
      </div>
      {customers.length === 0 ? (
        <Empty title="No buyers match this search" detail={orders.length ? "Try a name, email, or phone number from the order records." : "Buyers appear here once orders are available."} />
      ) : (
        <div className="space-y-3">
          {customers.map(customer => {
            const customerOrders = [...customer.orders].sort((a, b) => timestamp(b) - timestamp(a));
            const latest = customerOrders[0];
            const booked = customerOrders.filter(order => !excludedFromValue(order)).reduce((sum, order) => sum + order.total, 0);
            const isOpen = expanded === customer.key;
            return (
              <article key={customer.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_25px_rgba(18,51,74,.05)]">
                <button type="button" onClick={() => setExpanded(isOpen ? null : customer.key)} aria-expanded={isOpen} className="grid w-full gap-4 p-4 text-left transition hover:bg-[#f7fbfa] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#16877f]/30 md:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,.75fr))_auto] md:items-center md:p-5">
                  <div className="min-w-0"><p className="truncate font-semibold text-[#12334a]">{customer.name}</p><p className="mt-1 truncate text-xs text-slate-500">{customer.email || customer.phone || "Contact not provided"}</p></div>
                  <Metric label="Orders" value={String(customerOrders.length)} />
                  <Metric label="Latest order" value={latest ? latest.orderNumber : "Unavailable"} />
                  <Metric label="Booked value" value={money(booked)} detail="eligible orders" />
                  <span className="text-xs font-bold uppercase tracking-[.1em] text-[#16877f]">{isOpen ? "Hide orders" : "View orders"}</span>
                </button>
                {isOpen && <div className="border-t border-slate-100 bg-[#fbfdfc] px-4 py-3 md:px-5"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">All matching orders</p><div className="divide-y divide-slate-200">{customerOrders.map(order => <div key={order.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><OrderButton order={order} onOpenOrder={onOpenOrder} /><span className={statusPill(order.status, excludedFromValue(order) ? "red" : "navy")}>{title(order.status)}</span><span className="text-xs text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Date unavailable"}</span></div><span className="font-semibold text-[#12334a]">{money(order.total)}</span></div>)}</div></div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FulfillmentView({ orders, onOpenOrder }: Omit<Props, "view">) {
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState("all");
  const [delivery, setDelivery] = useState("all");
  const [tracking, setTracking] = useState("all");
  const [sort, setSort] = useState("oldest");
  const deliveryTypes = useMemo(() => Array.from(new Set(orders.map(order => order.deliveryType).filter(Boolean) as string[])).sort(), [orders]);
  const actionable = useMemo(() => {
    const search = clean(query);
    return orders.map(order => ({ order, queue: fulfillmentQueue(order) })).filter(row => row.queue)
      .filter(row => delivery === "all" || (row.order.deliveryType || "") === delivery)
      .filter(row => tracking === "all" || (tracking === "missing" ? !row.order.trackingNumber : !!row.order.trackingNumber))
      .filter(row => !search || `${row.order.orderNumber} ${row.order.customerName} ${row.order.customerEmail} ${row.order.customerPhone} ${row.order.trackingNumber || ""}`.toLowerCase().includes(search));
  }, [orders, query, delivery, tracking]);
  const counts = useMemo(() => actionable.reduce((result, row) => { result[row.queue as string] += 1; return result; }, { exceptions: 0, awaiting: 0, transit: 0 } as Record<string, number>), [actionable]);
  const rows = useMemo(() => actionable.filter(row => queue === "all" || row.queue === queue)
    .sort((a, b) => {
      const priority: Record<string, number> = { exceptions: 0, awaiting: 1, transit: 2 };
      return priority[a.queue as string] - priority[b.queue as string] ||
        (sort === "oldest" ? timestamp(a.order) - timestamp(b.order) : timestamp(b.order) - timestamp(a.order));
    }), [actionable, queue, sort]);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(130px,auto))]"><SearchBox value={query} onChange={setQuery} placeholder="Search order, customer or tracking number" /><Select label="Queue" value={queue} onChange={setQueue}><option value="all">All actionable queues</option><option value="exceptions">Priority exceptions</option><option value="awaiting">Awaiting dispatch / label</option><option value="transit">In transit</option></Select><Select label="Delivery type" value={delivery} onChange={setDelivery}><option value="all">All delivery types</option>{deliveryTypes.map(type => <option key={type} value={type}>{title(type)}</option>)}</Select><Select label="Tracking" value={tracking} onChange={setTracking}><option value="all">All records</option><option value="missing">Missing number</option><option value="present">Has number</option></Select><Select label="Order" value={sort} onChange={setSort}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></Select></div>
      <div className="grid gap-3 sm:grid-cols-3"><QueueCount label="Priority exceptions" value={counts.exceptions} tone="red" /><QueueCount label="Awaiting dispatch / label" value={counts.awaiting} tone="amber" /><QueueCount label="In transit" value={counts.transit} tone="teal" /></div>
       {rows.length === 0 ? <Empty title="No actionable deliveries" detail={orders.length ? "No orders match these queues and filters. Delivered, cancelled, and refunded orders are intentionally excluded." : "Actionable delivery work appears here when orders are available."} /> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_25px_rgba(18,51,74,.05)]"><div className="divide-y divide-slate-200">{rows.map(({ order, queue: rowQueue }) => <div key={order.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.8fr)_auto] md:items-center md:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><OrderButton order={order} onOpenOrder={onOpenOrder} /><span className={statusPill(rowQueue === "exceptions" ? "Priority exception" : rowQueue === "awaiting" ? "Awaiting dispatch" : "In transit", rowQueue === "exceptions" ? "red" : rowQueue === "awaiting" ? "amber" : "teal")}>{rowQueue === "exceptions" ? "Priority exception" : rowQueue === "awaiting" ? "Awaiting dispatch" : "In transit"}</span></div><p className="mt-1 truncate text-sm font-medium text-[#12334a]">{order.customerName || "Customer not provided"}</p><p className="truncate text-xs text-slate-500">{order.trackingNumber ? `Tracking ${order.trackingNumber}` : "No tracking number"}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Delivery</p><p className="mt-1 text-sm text-[#12334a]">{title(order.deliveryType)}</p><p className="text-xs text-slate-500">Age: {age(order)}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Statuses</p><p className="mt-1 text-sm text-[#12334a]">{title(order.deliveryStatus || "Not set")}</p><p className="text-xs text-slate-500">Order lifecycle: {title(order.status)}</p></div><div className={adminActionRowClass}><button type="button" onClick={() => onOpenOrder(order)} className={`${adminButtonClass("outline")} w-full sm:w-auto`}>Open order</button></div></div>)}</div></div>}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#12334a]">{value}</p>{detail && <p className="text-[10px] text-slate-400">{detail}</p>}</div>;
}
function QueueCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_rgba(18,51,74,.04)]"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className={`mt-2 font-serif text-3xl ${tone === "red" ? "text-[#a44539]" : tone === "amber" ? "text-[#805e1d]" : "text-[#126f69]"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">open work items</p></div>;
}
function Empty({ title: heading, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center"><p className="font-serif text-xl text-[#12334a]">{heading}</p><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{detail}</p></div>;
}

export function AdminCommerceTools({ view, orders, onOpenOrder }: Props) {
  const isCustomers = view === "Customers";
  return <div className="w-full text-[#12334a]"><header className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#16877f]">Infinite Home / Operations</p><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="font-serif text-3xl md:text-4xl">{view}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{isCustomers ? "Buyers with orders, grouped by order email when provided, otherwise phone. Shared contact details may represent different people." : "Confirmed orders awaiting dispatch or in transit, plus delivery exceptions. Pending payment orders are excluded."}</p></div><div className="rounded-md bg-[#12334a] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white/80">{orders.length} order records</div></div></header>{isCustomers ? <CustomersView orders={orders} onOpenOrder={onOpenOrder} /> : <FulfillmentView orders={orders} onOpenOrder={onOpenOrder} />}</div>;
}

export default AdminCommerceTools;