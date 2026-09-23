import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Order, PosTransaction } from "@/lib/api";
import { formatCurrency } from "@/lib/products";
import { matchesReportFacets, type ReportSource } from "@/lib/report-filters";
import { adminButtonClass } from "./admin-ui";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type View = "Analytics" | "Finance" | "Charts";
type PosRuntime = PosTransaction & { convertedToOrderId?: string | null };
type Filters = {
  period: "7" | "30" | "90" | "all" | "custom";
  from: string; to: string; status: string[]; payment: string[];
  delivery: string[]; source: ReportSource[]; search: string;
};

const initialFilters: Filters = {
  period: "30", from: "", to: "", status: [], payment: [],
  delivery: [], source: [], search: "",
};
const palette = ["#16877f", "#12334a", "#c38d55", "#7b9b9d", "#bd5d4e", "#5d6d80"];
const label = (value: string) => value.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const dateValue = (value?: string) => value ? new Date(value).getTime() : NaN;
const isCompletedPos = (status: string) => status.trim().toLowerCase() === "completed";
const isExcludedOrder = (status: string) => ["cancelled", "canceled", "refunded"].includes(status.trim().toLowerCase());
const money = (value: number) => formatCurrency(Number.isFinite(value) ? value : 0);

function SelectFilter({ label: title, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <label className="flex min-w-[130px] flex-1 flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
    {title}<select aria-label={title} value={value} onChange={e => onChange(e.target.value)}
      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 outline-none transition focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/15">{children}</select>
  </label>;
}

function MultiSelectFilter({ title, values, options, allLabel, onChange, open, onToggle, onClose }: {
  title: string; values: string[]; options: { value: string; name: string }[];
  allLabel: string; onChange: (values: string[]) => void;
  open: boolean; onToggle: () => void; onClose: () => void;
}) {
  const summary = values.length === 0 ? allLabel :
    values.length === 1 ? options.find(option => option.value === values[0])?.name || values[0] :
    `${values.length} selected`;
  const id = `report-filter-${title.toLowerCase()}`;
  return <div data-report-filter className="relative min-w-[150px] flex-1">
    <button type="button" aria-label={`${title}: ${summary}`} aria-expanded={open} aria-controls={id} onClick={onToggle} className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800 outline-none transition hover:border-[#16877f] focus-visible:ring-2 focus-visible:ring-[#16877f]/30">
      <span className="truncate"><span className="mr-2 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{title}</span>{summary}</span>
      <span aria-hidden="true" className="text-slate-500">{open ? "⌃" : "⌄"}</span>
    </button>
    {open && <div id={id} className="relative z-30 mt-1 w-full min-w-0 rounded-md border border-slate-200 bg-white p-2 shadow-lg sm:absolute sm:left-0 sm:top-full sm:mt-1 sm:min-w-[190px]">
      <button type="button" onClick={() => { onChange([]); onClose(); }} disabled={values.length === 0} className="w-full rounded px-2 py-2 text-left text-xs font-semibold text-[#16877f] hover:bg-slate-50 disabled:text-slate-400">Show all</button>
      <div className="max-h-56 overflow-y-auto">
        {options.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
          <input type="checkbox" checked={values.includes(option.value)} onChange={() => { onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value]); onClose(); }} className="accent-[#16877f]" />
          {option.name}
        </label>)}
        {options.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">No values available</p>}
      </div>
    </div>}
  </div>;
}

function FiltersBar({ filters, setFilters, statuses, payments, deliveries, hasPos }: {
  filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>; statuses: string[];
  payments: string[]; deliveries: string[]; hasPos: boolean;
}) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const set = (key: "period" | "from" | "to" | "search", value: string) => setFilters(current => ({ ...current, [key]: value }));
  const setMany = (key: "status" | "payment" | "delivery" | "source", values: string[]) =>
    setFilters(current => ({ ...current, [key]: values }));
  const selectProps = (title: string) => ({ open: openFilter === title, onToggle: () => setOpenFilter(current => current === title ? null : title), onClose: () => setOpenFilter(null) });
  return <section ref={barRef} aria-label="Report filters" onKeyDown={event => { if (event.key === "Escape") setOpenFilter(null); }} onPointerDown={event => {
    if (!(event.target as HTMLElement).closest("[data-report-filter]")) setOpenFilter(null);
  }} className="mb-7 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_25px_rgba(18,51,74,.05)]">
    <div className="flex flex-wrap gap-3">
      <SelectFilter label="Period" value={filters.period} onChange={v => set("period", v)}>
        <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        <option value="all">All time</option><option value="custom">Custom range</option>
      </SelectFilter>
      {filters.period === "custom" && <><label className="flex flex-1 flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">From<input aria-label="From date" type="date" value={filters.from} onChange={e => set("from", e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm tracking-normal outline-none focus:border-[#16877f]" /></label>
        <label className="flex flex-1 flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">To<input aria-label="To date" type="date" value={filters.to} onChange={e => set("to", e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm tracking-normal outline-none focus:border-[#16877f]" /></label></>}
      <MultiSelectFilter title="Status" values={filters.status} onChange={v => setMany("status", v)} options={statuses.map(value => ({ value, name: label(value) }))} allLabel="All statuses" {...selectProps("Status")} />
      <MultiSelectFilter title="Payment" values={filters.payment} onChange={v => setMany("payment", v)} options={payments.map(value => ({ value, name: label(value) }))} allLabel="All methods" {...selectProps("Payment")} />
      <MultiSelectFilter title="Delivery" values={filters.delivery} onChange={v => setMany("delivery", v)} options={deliveries.map(value => ({ value, name: label(value) }))} allLabel="All types" {...selectProps("Delivery")} />
      {hasPos && <MultiSelectFilter title="Source" values={filters.source} onChange={v => setMany("source", v)} options={[{ value: "orders", name: "Orders" }, { value: "pos", name: "POS" }]} allLabel="Orders + POS" {...selectProps("Source")} />}
      <button type="button" onClick={() => { setFilters(initialFilters); setOpenFilter(null); }} className={`${adminButtonClass()} shrink-0`}>Reset</button>
    </div>
    <p className="mt-3 text-xs text-slate-500">Select multiple options in any filter. Matches within a filter are combined; filters work together.</p>
    <label className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-500 focus-within:border-[#16877f]">
      <span aria-hidden="true" className="text-base">⌕</span><span className="sr-only">Search reports</span><input value={filters.search} onChange={e => set("search", e.target.value)} placeholder="Search order number, customer, product or transaction" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
    </label>
  </section>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center"><p className="font-serif text-xl text-[#12334a]">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{detail}</p></div>;
}
function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_25px_rgba(18,51,74,.05)]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{title}</p><p className="mt-3 font-serif text-[clamp(1.55rem,3vw,2.25rem)] leading-none text-[#12334a]">{value}</p><p className="mt-3 text-xs text-slate-500">{detail}</p></article>;
}
function Panel({ title, eyebrow, children, className = "" }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_25px_rgba(18,51,74,.05)] ${className}`}><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#16877f]">{eyebrow || "Report detail"}</p><h2 className="mt-1 font-serif text-xl text-[#12334a]">{title}</h2></div>{children}</section>;
}

export function AdminReports({ view, orders, posTransactions, canViewPos }: {
  view: View; orders: Order[]; posTransactions: PosTransaction[]; canViewPos: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const pos = useMemo(() => posTransactions as PosRuntime[], [posTransactions]);
  const allStatuses = useMemo(() => Array.from(new Set([...orders.map(o => o.status), ...(canViewPos ? pos.map(p => p.status) : [])])).filter(Boolean).sort(), [orders, pos, canViewPos]);
  const payments = useMemo(() => Array.from(new Set([...orders.map(o => o.paymentMethod), ...(canViewPos ? pos.map(p => p.paymentMethod) : [])])).filter(Boolean).sort(), [orders, pos, canViewPos]);
  const deliveries = useMemo(() => Array.from(new Set([...orders.map(o => o.deliveryType || ""), ...(canViewPos ? pos.map(p => p.labelDeliveryType || "") : [])])).filter(Boolean).sort(), [orders, pos, canViewPos]);
  const bounds = useMemo(() => {
    const now = Date.now(); let from = -Infinity; let to = Infinity;
    if (filters.period !== "all" && filters.period !== "custom") from = now - Number(filters.period) * 86400000;
    if (filters.period === "custom") { from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity; to = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : Infinity; }
    return { from, to };
  }, [filters.period, filters.from, filters.to]);
  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const facets = canViewPos ? filters : { ...filters, source: [] };
    const match = (date: string | undefined, status: string, payment: string, delivery: string, source: ReportSource, haystack: string) =>
      dateValue(date) >= bounds.from && dateValue(date) <= bounds.to &&
      matchesReportFacets(facets, { status, payment, delivery, source }) && (!query || haystack.toLowerCase().includes(query));
    const fo = orders.filter(o => match(o.createdAt, o.status, o.paymentMethod, o.deliveryType || "", "orders", `${o.orderNumber} ${o.customerName} ${o.items.map(i => i.name).join(" ")}`));
    const fp = canViewPos ? pos.filter(p => match(p.createdAt, p.status, p.paymentMethod, p.labelDeliveryType || "", "pos", `${p.transactionNumber} ${p.customerName || ""} ${p.items.map(i => i.name).join(" ")}`)) : [];
    return { orders: fo, pos: fp };
  }, [orders, pos, canViewPos, filters, bounds]);
  const ineligibleConvertedOrderIds = new Set(pos.filter(p => p.convertedToOrderId && !isCompletedPos(p.status)).map(p => p.convertedToOrderId));
  const isEligibleOrder = (o: Order) => !isExcludedOrder(o.status) && !ineligibleConvertedOrderIds.has(o.id);
  const eligibleOrders = filtered.orders.filter(isEligibleOrder);
  const eligibleOrderValue = eligibleOrders.reduce((s, o) => s + o.total, 0);
  const completedPos = filtered.pos.filter(p => isCompletedPos(p.status) && !p.convertedToOrderId);
  const posValue = completedPos.reduce((s, p) => s + p.total, 0);
  const itemRows = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; value: number }>();
    eligibleOrders.forEach(o => o.items.forEach(i => { const row = map.get(i.name) || { name: i.name, qty: 0, value: 0 }; row.qty += i.qty; row.value += i.qty * i.price; map.set(i.name, row); }));
    completedPos.forEach(p => p.items.forEach(i => { const row = map.get(i.name) || { name: i.name, qty: 0, value: 0 }; row.qty += i.qty; row.value += i.qty * i.price; map.set(i.name, row); }));
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [eligibleOrders, completedPos]);
  const recent = useMemo(() => [...filtered.orders.map(o => ({ date: o.createdAt, ref: o.orderNumber, who: o.customerName, value: isEligibleOrder(o) ? o.total : 0, status: o.status, kind: "Order" })), ...filtered.pos.map(p => ({ date: p.createdAt, ref: p.transactionNumber, who: p.customerName || p.cashierName, value: isCompletedPos(p.status) && !p.convertedToOrderId ? p.total : 0, status: p.status, kind: "POS" }))].sort((a, b) => dateValue(b.date) - dateValue(a.date)).slice(0, 7), [filtered, pos]);
  const statusData = useMemo(() => {
    const counts = new Map<string, number>(); [...filtered.orders.map(o => o.status), ...filtered.pos.map(p => p.status)].forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name: label(name), value }));
  }, [filtered]);
  const methodData = useMemo(() => {
    const values = new Map<string, number>(); eligibleOrders.forEach(o => values.set(o.paymentMethod, (values.get(o.paymentMethod) || 0) + o.total)); completedPos.forEach(p => values.set(p.paymentMethod, (values.get(p.paymentMethod) || 0) + p.total));
    return Array.from(values.entries()).map(([name, value]) => ({ name: label(name), value }));
  }, [eligibleOrders, completedPos]);
  const trend = useMemo(() => {
    const dates = [...filtered.orders.map(o => dateValue(o.createdAt)), ...filtered.pos.map(p => dateValue(p.createdAt))].filter(Number.isFinite) as number[];
    if (!dates.length) return [];
    const start = Math.min(...dates), end = Math.max(...dates), days = Math.max(1, Math.ceil((end - start) / 86400000));
    const unit = days > 365 ? "month" : days > 90 ? "week" : "day"; const map = new Map<string, { date: string; value: number; count: number }>();
    const keyFor = (time: number) => { const d = new Date(time); if (unit === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (unit === "week") { const x = new Date(d); x.setDate(d.getDate() - d.getDay()); return x.toISOString().slice(0, 10); } return d.toISOString().slice(0, 10); };
    [...eligibleOrders.map(o => ({ time: dateValue(o.createdAt), value: o.total })), ...completedPos.map(p => ({ time: dateValue(p.createdAt), value: p.total }))].filter(x => Number.isFinite(x.time)).forEach(x => { const key = keyFor(x.time); const row = map.get(key) || { date: key, value: 0, count: 0 }; row.value += x.value; row.count++; map.set(key, row); });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ ...x, label: unit === "month" ? x.date : new Date(`${x.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
  }, [eligibleOrders, completedPos]);
  const shared = <FiltersBar filters={filters} setFilters={setFilters} statuses={allStatuses} payments={payments} deliveries={deliveries} hasPos={canViewPos} />;
  const hasData = filtered.orders.length > 0 || filtered.pos.length > 0;

  return <div className="w-full text-[#12334a]">
    <header className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#16877f]">Infinite Home / Reporting</p><h1 className="font-serif text-3xl md:text-4xl">{view}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">A precise view of booked orders and store activity. Values are shown in MVR.</p></div><div className="rounded-md bg-[#12334a] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white/80">Loaded records · {filtered.orders.length + filtered.pos.length}</div></header>
    {shared}
    {!hasData ? <Empty title="Nothing matches these filters" detail="Try widening the period, clearing search, or selecting all sources. Reports only calculate from records passed into this view." /> :
      view === "Analytics" ? <Analytics orderValue={eligibleOrderValue} posValue={posValue} orders={eligibleOrders} completedPos={completedPos} itemRows={itemRows} recent={recent} statusData={statusData} /> :
      view === "Finance" ? <Finance orders={eligibleOrders} allOrders={filtered.orders} pos={filtered.pos} completedPos={completedPos} orderValue={eligibleOrderValue} posValue={posValue} methodData={methodData} eligibleOrderIds={new Set(eligibleOrders.map(o => o.id))} /> :
      <Charts trend={trend} statusData={statusData} methodData={methodData} />}
  </div>;
}

export default AdminReports;

function Analytics({ orderValue, posValue, orders, completedPos, itemRows, recent, statusData }: any) {
  const discounts = orders.reduce((s: number, o: Order) => s + o.discount, 0) + completedPos.reduce((s: number, p: PosRuntime) => s + p.discount, 0);
  return <div className="space-y-6"><div className="rounded-lg border border-[#e8d9ba] bg-[#fffaf0] px-4 py-3 text-sm leading-relaxed text-[#6d5734]">Cancelled and refunded orders remain visible in activity and status reporting, but contribute zero to financial and product metrics.</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi title="Booked order value" value={money(orderValue)} detail={`${orders.length} eligible orders · not settled revenue`} /><Kpi title="Completed POS value" value={money(posValue)} detail={`${completedPos.length} completed, unlinked transactions`} /><Kpi title="Average order value" value={money(orders.length ? orderValue / orders.length : 0)} detail="Eligible booked value ÷ eligible orders" /><Kpi title="Discounts applied" value={money(discounts)} detail="Eligible orders and completed POS" /></div>
    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><Panel title="Top products" eyebrow="Merchandising signal">{itemRows.length ? <div className="space-y-4">{itemRows.map((r: any, i: number) => <div key={r.name} className="flex items-center gap-3"><span className="w-5 font-mono text-xs text-slate-400">0{i + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{r.name}</span><span>{money(r.value)}</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#16877f]" style={{ width: `${Math.max(6, (r.value / itemRows[0].value) * 100)}%` }} /></div></div><span className="w-12 text-right text-xs text-slate-500">{r.qty} sold</span></div>)}</div> : <Empty title="No product activity" detail="Product rows appear when matching orders or POS transactions contain items." />}</Panel>
      <Panel title="Status mix" eyebrow="Operational pulse"><div className="h-64"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>{statusData.map((_: any, i: number) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip formatter={(value) => [value, "Records"]} /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer></div></Panel></div>
    <Panel title="Recent activity" eyebrow="Latest records"><Activity rows={recent} /></Panel></div>;
}
function Activity({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="pb-3">Reference</th><th className="pb-3">Customer / cashier</th><th className="pb-3">Source</th><th className="pb-3">Status</th><th className="pb-3 text-right">Value</th></tr></thead><tbody>{rows.map(r => <tr key={`${r.kind}-${r.ref}`} className="border-b border-slate-100 last:border-0"><td className="py-3 font-semibold">{r.ref}<div className="text-xs font-normal text-slate-400">{r.date ? new Date(r.date).toLocaleString() : "Date unavailable"}</div></td><td className="py-3 text-slate-600">{r.who || "Walk-in"}</td><td className="py-3 text-slate-500">{r.kind}</td><td className="py-3"><span className="rounded-full bg-[#e7f3f1] px-2.5 py-1 text-xs font-semibold text-[#126f69]">{label(r.status)}</span></td><td className="py-3 text-right font-semibold">{money(r.value)}</td></tr>)}</tbody></table></div>;
}

function Finance({ orders, allOrders, pos, completedPos, orderValue, posValue, methodData, eligibleOrderIds }: any) {
  const discounts = orders.reduce((s: number, o: Order) => s + o.discount, 0) + completedPos.reduce((s: number, p: PosRuntime) => s + p.discount, 0);
  const shipping = orders.reduce((s: number, o: Order) => s + o.shipping, 0);
  const ledger = [...allOrders.map((o: Order) => ({ ref: o.orderNumber, date: o.createdAt, source: "Order", gross: eligibleOrderIds.has(o.id) ? o.total : 0, method: o.paymentMethod, state: o.status })), ...pos.map((p: PosRuntime) => ({ ref: p.transactionNumber, date: p.createdAt, source: "POS", gross: isCompletedPos(p.status) && !p.convertedToOrderId ? p.total : 0, method: p.paymentMethod, state: p.status }))].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  return <div className="space-y-6"><div className="rounded-lg border border-[#e8d9ba] bg-[#fffaf0] px-4 py-3 text-sm leading-relaxed text-[#6d5734]"><strong>Read carefully:</strong> booked order value is not settled revenue. RedotPay payment state is not confirmed by order status. Cancelled/refunded orders and orders linked to non-completed POS records remain in the ledger at zero value. POS value includes only transactions with status exactly “completed” and no linked order.</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi title="Booked order value" value={money(orderValue)} detail={`${orders.length} eligible order records`} /><Kpi title="Completed POS sales" value={money(posValue)} detail={`${completedPos.length} eligible transactions`} /><Kpi title="Discounts" value={money(discounts)} detail="Eligible order and completed POS discounts" /><Kpi title="Shipping booked" value={money(shipping)} detail="Eligible order shipping charges only" /></div><div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Panel title="Value by payment method" eyebrow="Booked value"><div className="h-64"><ResponsiveContainer><BarChart data={methodData} layout="vertical" margin={{ left: 10, right: 18 }}><CartesianGrid horizontal={false} stroke="#e4ebed" /><XAxis type="number" tickFormatter={v => `${Math.round(v / 1000)}k`} /><YAxis type="category" dataKey="name" width={75} /><Tooltip formatter={(v) => [money(Number(v)), "Value"]} /><Bar dataKey="value" fill="#16877f" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></Panel><Panel title="Detailed ledger" eyebrow="Traceable records"><div className="max-h-[410px] overflow-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200"><th className="pb-3">Reference</th><th className="pb-3">Source</th><th className="pb-3">Method</th><th className="pb-3">State</th><th className="pb-3 text-right">Value</th></tr></thead><tbody>{ledger.map(r => <tr key={`${r.source}-${r.ref}`} className="border-b border-slate-100"><td className="py-3 font-semibold">{r.ref}<div className="text-xs font-normal text-slate-400">{r.date ? new Date(r.date).toLocaleDateString() : "Date unavailable"}</div></td><td className="py-3 text-slate-500">{r.source}</td><td className="py-3">{label(r.method)}</td><td className="py-3 text-slate-500">{label(r.state)}</td><td className="py-3 text-right font-semibold">{money(r.gross)}</td></tr>)}</tbody></table></div></Panel></div></div>;
}

function Charts({ trend, statusData, methodData }: any) {
  return <div className="space-y-6"><Panel title="Value and record trend" eyebrow="Filtered activity"><div className="h-[340px]"><ResponsiveContainer><LineChart data={trend} margin={{ left: 6, right: 20, top: 10 }}><CartesianGrid stroke="#e4ebed" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis yAxisId="value" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} /><YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(v, name) => [name === "value" ? money(Number(v)) : v, name === "value" ? "Value" : "Records"]} /><Legend /><Line yAxisId="value" type="monotone" dataKey="value" name="Booked value" stroke="#16877f" strokeWidth={3} dot={false} /><Line yAxisId="count" type="monotone" dataKey="count" name="Records" stroke="#c38d55" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>{!trend.length && <p className="text-center text-sm text-slate-500">No dated records are available for a trend.</p>}</Panel><div className="grid gap-6 lg:grid-cols-2"><Panel title="Status breakdown" eyebrow="Record count"><Breakdown data={statusData} /></Panel><Panel title="Payment breakdown" eyebrow="Value in MVR"><Breakdown data={methodData} money /></Panel></div></div>;
}
function Breakdown({ data, money: isMoney = false }: { data: any[]; money?: boolean }) {
  if (!data.length) return <Empty title="No breakdown available" detail="Matching records do not contain enough data for this chart." />;
  return <div className="h-64"><ResponsiveContainer><BarChart data={data} margin={{ left: 4, right: 12, bottom: 12 }}><CartesianGrid stroke="#e4ebed" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={!isMoney} tickFormatter={v => isMoney ? `${Math.round(v / 1000)}k` : v} tick={{ fontSize: 11 }} /><Tooltip formatter={v => [isMoney ? money(Number(v)) : v, isMoney ? "Value" : "Records"]} /><Bar dataKey="value" fill="#12334a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}