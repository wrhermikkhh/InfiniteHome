import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Save, Plus, ReceiptText, WalletCards } from "lucide-react";
import { adminButtonClass, adminControlClass } from "./admin-ui";

type CostingMethod = "FIFO" | "AVERAGE";
type Currency = "MVR" | "USD";
type FxSettlementSource = "pos" | "manual-order";
type Settings = {
  taxEnabled: boolean;
  gstRate: number;
  tgstRate: number;
  usdToMvrRate: number | null;
  costingMethod: CostingMethod;
};
type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: Currency;
  usdToMvrRate: number | null;
  amountMvr: number;
  isLanded: boolean;
  batchId: string | null;
  expenseDate: string;
};
type Report = {
  from: string;
  to: string;
  /** Planned backend field: booked value from online orders, not POS receipts. */
  bookedOrdersMvr?: number | null;
  collectedMvr: number;
  /** Paid manual/offline orders, kept separate from online bookings and POS. */
  manualCollectedMvr?: number | null;
  gst: { GST: TaxSummary; TGST: TaxSummary };
  tenderCurrencies: Record<Currency, { amount: number; amountMvr: number }>;
  cogs: { knownMvr: number; estimatedMvr: number; historicalUnknownMvr: number };
  overheadMvr: number;
  /** Operating overhead excludes landed batch costs when supplied by the backend. */
  landedCostMvr?: number | null;
  /** Realized only after an explicit USD cash settlement/revaluation. */
  realizedFxMvr?: number | null;
  /** Backend-supplied operating result including paid manual offline sales. */
  offlineOperatingResultMvr?: number | null;
  posOperatingResultMvr?: number | null;
  completeCostCoverage: boolean;
  profitMvr?: number | null;
  openReceivables?: { MVR: number; USD: number };
  /** Verified RedotPay receipts in native USD; never converted into MVR totals. */
  verifiedRedotPayReceiptsUsd?: number;
};
type TaxSummary = { taxableBaseMvr: number; taxAmountMvr: number };
type FxSettlement = { gainLossMvr?: number | null; realizedFxMvr?: number | null; fxVarianceMvr?: number | null };

export type AdminAccountingProps = {
  /** Accounting routes are super-admin only. Render false for ordinary admins. */
  isSuperAdmin: boolean;
  className?: string;
};

const emptySettings: Settings = {
  taxEnabled: false, gstRate: 0, tgstRate: 0, usdToMvrRate: 15.42, costingMethod: "FIFO",
};
const money = (value: number | null | undefined, currency = "MVR") =>
  `${currency === "USD" ? "$" : "MVR "}${(Number(value) || 0).toLocaleString("en-MV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
    <span className="uppercase tracking-[.1em] text-[10px] text-slate-500">{label}</span>{children}
  </label>;
}
function Panel({ title, kicker, children, action }: { title: string; kicker?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_25px_rgba(18,51,74,.05)]">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>{kicker && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#16877f]">{kicker}</p>}
        <h2 className="text-xl text-[#12334a]">{title}</h2></div>{action}
    </div>{children}
  </section>;
}

export default function AdminAccounting({ isSuperAdmin, className = "" }: AdminAccountingProps) {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fxSettlement, setFxSettlement] = useState({ source: "pos" as FxSettlementSource, id: "", settlementRate: "", reason: "" });
  const [fxResult, setFxResult] = useState<FxSettlement | null>(null);
  const [expense, setExpense] = useState({
    category: "Operations", description: "", amount: "", currency: "MVR" as Currency,
    usdToMvrRate: "", isLanded: false, batchId: "", supplierId: "", expenseDate: today(),
  });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextSettings, nextExpenses, nextReport] = await Promise.all([
        request<Settings>("/api/admin/accounting/settings"),
        request<Expense[]>("/api/admin/accounting/expenses"),
        request<Report>(`/api/admin/accounting/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ]);
       setSettings({ ...emptySettings, ...nextSettings, usdToMvrRate: nextSettings.usdToMvrRate ?? 15.42 });
      setExpenses(Array.isArray(nextExpenses) ? nextExpenses : []);
      setReport(nextReport);
    } catch (err) { setError(err instanceof Error ? err.message : "Accounting data could not be loaded."); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin, load]);

  const saveSettings = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await request<Settings>("/api/admin/accounting/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSettings({ ...emptySettings, ...saved }); setNotice("Accounting settings saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Settings could not be saved."); }
    finally { setSaving(false); }
  };
  const addExpense = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const created = await request<Expense>("/api/admin/accounting/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...expense, amount: Number(expense.amount), usdToMvrRate: expense.usdToMvrRate ? Number(expense.usdToMvrRate) : null,
          batchId: expense.batchId || null, supplierId: expense.supplierId || null,
        }),
      });
      setExpenses(current => [created, ...current]);
      setExpense(current => ({ ...current, description: "", amount: "", usdToMvrRate: "", batchId: "", supplierId: "" }));
      setNotice("Expense recorded."); void load();
    } catch (err) { setError(err instanceof Error ? err.message : "Expense could not be recorded."); }
    finally { setSaving(false); }
  };
  const downloadCsv = async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/accounting/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`CSV export failed (${response.status})`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `accounting-${from}-${to}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "CSV export failed."); }
  };
  const downloadTaxWorksheet = async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/accounting/tax-export.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`GST/TGST worksheet export failed (${response.status})`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `gst-tgst-worksheet-${from}-${to}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "GST/TGST worksheet export failed."); }
  };
  const settleUsdCash = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice(""); setFxResult(null);
    try {
      const endpoint = fxSettlement.source === "pos"
        ? `/api/admin/accounting/pos/${encodeURIComponent(fxSettlement.id.trim())}/fx-settlement`
        : `/api/admin/accounting/manual-orders/${encodeURIComponent(fxSettlement.id.trim())}/fx-settlement`;
      const result = await request<FxSettlement>(endpoint, {
        method: "POST",
        body: JSON.stringify({ settlementRate: Number(fxSettlement.settlementRate), reason: fxSettlement.reason.trim() }),
      });
      setFxResult(result);
      setFxSettlement({ source: fxSettlement.source, id: "", settlementRate: "", reason: "" });
      setNotice("USD cash settlement recorded and audited."); void load();
    } catch (err) { setError(err instanceof Error ? err.message : "USD cash settlement could not be recorded."); }
    finally { setSaving(false); }
  };

  const totalTax = useMemo(() => (report?.gst.GST.taxAmountMvr || 0) + (report?.gst.TGST.taxAmountMvr || 0), [report]);
  const operatingOverhead = report?.landedCostMvr == null ? null : report.overheadMvr;
  const trackedPosResult = report?.landedCostMvr == null ? null : (report.offlineOperatingResultMvr ?? report.posOperatingResultMvr ?? report.profitMvr);
  const includesPaidManualSales = report?.offlineOperatingResultMvr != null;
  if (!isSuperAdmin) return null;
  return <div className={`grid gap-6 ${className}`}>
    {error && <div role="alert" className="rounded-lg border border-[#ebc4be] bg-[#fff0ee] px-4 py-3 text-sm text-[#a44539]">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-[#b9ded8] bg-[#f1f8f7] px-4 py-3 text-sm text-[#126f69]">{notice}</div>}
    <Panel title="Accounting controls" kicker="Configuration" action={<button type="button" className={adminButtonClass("primary")} onClick={saveSettings} disabled={saving || loading}><Save size={15} /> Save settings</button>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#12334a]"><input type="checkbox" checked={settings.taxEnabled} onChange={e => setSettings({ ...settings, taxEnabled: e.target.checked })} className="accent-[#16877f]" /> Enable GST/TGST</label>
        <Field label="GST rate (%)"><input className={adminControlClass} type="number" min="0" max="100" step="0.01" value={settings.gstRate} onChange={e => setSettings({ ...settings, gstRate: Number(e.target.value) })} disabled={!settings.taxEnabled} /></Field>
        <Field label="TGST rate (%)"><input className={adminControlClass} type="number" min="0" max="100" step="0.01" value={settings.tgstRate} onChange={e => setSettings({ ...settings, tgstRate: Number(e.target.value) })} disabled={!settings.taxEnabled} /></Field>
         <Field label="USD → MVR rate for new sales"><input className={adminControlClass} type="number" min="0" step="0.000001" value={settings.usdToMvrRate ?? 15.42} onChange={e => setSettings({ ...settings, usdToMvrRate: e.target.value ? Number(e.target.value) : 15.42 })} /></Field>
        <Field label="Inventory costing"><select className={adminControlClass} value={settings.costingMethod} onChange={e => setSettings({ ...settings, costingMethod: e.target.value as CostingMethod })}><option value="FIFO">FIFO — first received</option><option value="AVERAGE">Average cost</option></select></Field>
      </div>
       <p className="mt-3 text-xs text-slate-500">Tax is disabled by default. The USD rate applies only to new RedotPay hosted USD quotes and new admin POS/manual orders and invoices; older orders and invoices retain their snapshots unchanged. FX settlement is recorded separately.</p>
    </Panel>

    <Panel title="Settle USD cash" kicker="Audited FX revaluation" action={<WalletCards size={20} className="text-[#16877f]" />}>
      <form onSubmit={settleUsdCash} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Settlement source"><select className={adminControlClass} value={fxSettlement.source} onChange={e => setFxSettlement({ ...fxSettlement, source: e.target.value as FxSettlementSource, id: "" })}><option value="pos">POS sale</option><option value="manual-order">Paid manual order</option></select></Field>
        <Field label={`${fxSettlement.source === "pos" ? "POS sale" : "Paid manual order"} ID`}><input required className={adminControlClass} value={fxSettlement.id} onChange={e => setFxSettlement({ ...fxSettlement, id: e.target.value })} placeholder={`${fxSettlement.source === "pos" ? "POS sale" : "Manual order"} UUID`} /></Field>
        <Field label="Final MVR per USD rate"><input required className={adminControlClass} type="number" min="0.000001" step="0.000001" value={fxSettlement.settlementRate} onChange={e => setFxSettlement({ ...fxSettlement, settlementRate: e.target.value })} placeholder="Manual final rate" /></Field>
        <Field label="Required reason"><input required minLength={3} className={adminControlClass} value={fxSettlement.reason} onChange={e => setFxSettlement({ ...fxSettlement, reason: e.target.value })} placeholder="Why is this cash being revalued?" /></Field>
        <div className="self-end"><button type="submit" className={adminButtonClass("primary")} disabled={saving}><Save size={15} /> Record settlement</button></div>
      </form>
      <p className="mt-3 text-xs text-slate-500">USD cash has no realized gain or loss until the cash is actually converted and this final rate is explicitly entered. This changes FX reporting only; it does not change the sale total or sales margin.</p>
      {fxResult && <div role="status" className="mt-4 rounded-lg border border-[#b9ded8] bg-[#f1f8f7] p-3 text-sm text-[#126f69]">Realized FX gain/loss: <strong>{money(fxResult.realizedFxMvr ?? fxResult.gainLossMvr ?? fxResult.fxVarianceMvr ?? 0)}</strong></div>}
    </Panel>

    <Panel title="Accounting report" kicker="Admin finance" action={<div className="flex flex-wrap gap-2"><button type="button" className={adminButtonClass("outline")} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button><button type="button" className={adminButtonClass("outline")} onClick={() => void downloadCsv()}><Download size={14} /> Summary CSV</button><button type="button" className={adminButtonClass("outline")} onClick={() => void downloadTaxWorksheet()}><Download size={14} /> GST/TGST worksheet</button></div>}>
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="From"><input className={adminControlClass} type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="To"><input className={adminControlClass} type="date" value={to} onChange={e => setTo(e.target.value)} /></Field></div>
       {report ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Open receivables (MVR)" value={report.openReceivables ? money(report.openReceivables.MVR, "MVR") : "Unavailable"} detail="Open / unverified MVR balances" /><Metric title="Open receivables (USD)" value={report.openReceivables ? money(report.openReceivables.USD, "USD") : "Unavailable"} detail="Open / unverified USD balances" /><Metric title="Verified RedotPay receipts (USD)" value={report.verifiedRedotPayReceiptsUsd == null ? "Unavailable" : money(report.verifiedRedotPayReceiptsUsd, "USD")} detail="Native USD only; excluded from MVR totals" />
          <Metric title="Collected POS (MVR equivalent)" value={money(report.collectedMvr)} detail="Completed POS receipts, reported as MVR equivalent" /><Metric title="Paid manual offline orders (MVR equivalent)" value={report.manualCollectedMvr == null ? "Unavailable" : money(report.manualCollectedMvr)} detail="Separate offline cashflow; not online bookings" /><Metric title="Booked online orders (MVR equivalent)" value={report.bookedOrdersMvr == null ? "Unavailable" : money(report.bookedOrdersMvr)} detail="Booked value; never added to collected cash" /><Metric title="GST / TGST" value={money(totalTax)} /><Metric title="Operating overhead" value={operatingOverhead == null ? "Unavailable" : money(operatingOverhead)} detail={report.landedCostMvr == null ? "Waiting for landed-cost separation" : `Excludes landed batch costs: ${money(report.landedCostMvr)}`} />
        <Metric title="MVR tenders" value={money(report.tenderCurrencies.MVR?.amountMvr)} detail={`${money(report.tenderCurrencies.MVR?.amount, "MVR")} entered`} /><Metric title="USD tenders" value={money(report.tenderCurrencies.USD?.amount, "USD")} detail={`${money(report.tenderCurrencies.USD?.amountMvr)} equivalent`} />
         <Metric title="Known COGS" value={money(report.cogs.knownMvr)} detail={`Estimated ${money(report.cogs.estimatedMvr)}`} /><Metric title="Realized FX" value={report.realizedFxMvr == null ? "None recorded" : money(report.realizedFxMvr)} detail="Only after USD cash settlement" /><Metric title={includesPaidManualSales ? "Tracked POS + paid manual offline result" : "Tracked POS operating result"} value={trackedPosResult === null ? "Unavailable" : money(trackedPosResult)} detail={report.landedCostMvr == null ? "Waiting for landed-cost separation" : report.completeCostCoverage ? "Tracked offline result; not all-business true net profit" : "Costs unknown; not all-business true net profit"} />
      </div> : <p className="text-sm text-slate-500">{loading ? "Loading report…" : "No report data for this period."}</p>}
       {report && <p className="mt-4 rounded-lg bg-[#f1f8f7] px-3 py-2 text-xs text-[#126f69]">POS collection is money received from completed, unconverted in-store sales. Booked online orders are a separate sales commitment and are not additive to POS collection or treated as cash received.{report.bookedOrdersMvr == null && " Online-booking data will appear when the accounting report backend is updated."}</p>}
       {report && <p className="mt-4 rounded-lg bg-[#f1f8f7] px-3 py-2 text-xs text-[#126f69]">POS collection and paid manual offline orders are separate cashflow streams from booked online orders; booked online value is never added to collected cash or profit. The tracked operating result is a POS-only metric unless the backend supplies paid manual offline sales, and is not all-business true net profit. Landed batch expenses belong in landed COGS, not ordinary operating overhead. USD cash has no realized FX result until a settlement is recorded above. The GST/TGST worksheet is a transaction-level export for MRA review, not an official filed format.</p>}
       {report && report.cogs.historicalUnknownMvr > 0 && <p className="mt-4 rounded-lg bg-[#fff8ed] px-3 py-2 text-xs text-[#8c5b22]">Profit is withheld because some historical COGS is unknown. Estimated COGS is shown separately.</p>}
    </Panel>

    <Panel title="Log an expense" kicker="Costs & landed COGS" action={<ReceiptText size={20} className="text-[#16877f]" />}>
      <form onSubmit={addExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Category"><input required className={adminControlClass} value={expense.category} onChange={e => setExpense({ ...expense, category: e.target.value })} /></Field>
        <Field label="Description"><input required className={adminControlClass} value={expense.description} onChange={e => setExpense({ ...expense, description: e.target.value })} placeholder="Supplier bill, customs, gateway fee…" /></Field>
        <Field label="Amount"><input required className={adminControlClass} type="number" min="0.01" step="0.01" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} /></Field>
        <Field label="Currency"><select className={adminControlClass} value={expense.currency} onChange={e => setExpense({ ...expense, currency: e.target.value as Currency })}><option>MVR</option><option>USD</option></select></Field>
        {expense.currency === "USD" && <Field label="Manual USD → MVR rate"><input required className={adminControlClass} type="number" min="0.000001" step="0.000001" value={expense.usdToMvrRate} onChange={e => setExpense({ ...expense, usdToMvrRate: e.target.value })} /></Field>}
        <Field label="Expense date"><input required className={adminControlClass} type="date" value={expense.expenseDate} onChange={e => setExpense({ ...expense, expenseDate: e.target.value })} /></Field>
        <Field label="Batch ID (optional)"><input className={adminControlClass} value={expense.batchId} onChange={e => setExpense({ ...expense, batchId: e.target.value })} placeholder="Link landed cost" /></Field>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#12334a]"><input type="checkbox" checked={expense.isLanded} onChange={e => setExpense({ ...expense, isLanded: e.target.checked })} className="accent-[#16877f]" /> Allocate to landed COGS</label>
        <div className="sm:col-span-2 lg:col-span-4"><button type="submit" className={adminButtonClass("primary")} disabled={saving}><Plus size={15} /> Record expense</button></div>
      </form>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="pb-2">Date</th><th className="pb-2">Description</th><th className="pb-2">Category</th><th className="pb-2">Amount</th><th className="pb-2">MVR equivalent</th></tr></thead><tbody>{expenses.slice(0, 12).map(item => <tr key={item.id} className="border-b border-slate-100"><td className="py-2 text-slate-500">{item.expenseDate}</td><td className="py-2 font-medium text-[#12334a]">{item.description}{item.isLanded && <span className="ml-2 rounded bg-[#e8f5f2] px-1.5 py-0.5 text-[10px] text-[#126f69]">LANDED</span>}</td><td className="py-2 text-slate-500">{item.category}</td><td className="py-2">{money(item.amount, item.currency)}</td><td className="py-2">{money(item.amountMvr)}</td></tr>)}{expenses.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No expenses recorded.</td></tr>}</tbody></table></div>
    </Panel>
    <p className="flex items-center gap-2 text-xs text-slate-500"><WalletCards size={14} className="text-[#16877f]" /> POS tenders, processing fees, GST/TGST, and COGS are recorded separately so collected money is not confused with booked sales.</p>
  </div>;
}

function Metric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{title}</p><p className="mt-1 text-lg font-semibold text-[#12334a]">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}