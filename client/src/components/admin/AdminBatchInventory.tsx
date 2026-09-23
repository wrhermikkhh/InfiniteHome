import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { adminActionRowClass, adminButtonClass, adminControlClass } from "./admin-ui";

type Supplier = { id: string; name: string; contact?: string | null };
type Batch = {
  id: string; product_id: string; variant_key?: string | null; quantity_received: number;
  quantity_remaining: number; supplier_name?: string | null; unit_landed_cost_mvr?: string | number;
  arrived_at?: string; reference?: string | null;
};
type Movement = {
  id: string; product_id: string; variant_key?: string | null; quantity_delta: number;
  quantity_before: number; quantity_after: number; kind: string; reason: string;
  actor_name?: string | null; created_at?: string;
};

export type AdminBatchInventoryProps = {
  products: Product[];
  onProductsChanged?: () => Promise<void> | void;
};

const inputClass = `${adminControlClass} w-full`;
const labelClass = "flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500";
const cardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_25px_rgba(18,51,74,.05)]";
const errorText = (error: unknown) => error instanceof Error ? error.message : "Inventory request failed";

function variants(product?: Product) {
  if (!product) return [];
  const keys = Object.keys((product as any).variantStock || {});
  return keys.length ? keys : ["Standard-Default"];
}

function productName(products: Product[], id: string) {
  return products.find(product => product.id === id)?.name || "Unknown product";
}

export function AdminBatchInventory({ products, onProductsChanged }: AdminBatchInventoryProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [variantKey, setVariantKey] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierCost, setSupplierCost] = useState("");
  const [costCurrency, setCostCurrency] = useState<"MVR" | "USD">("MVR");
  const [exchangeRate, setExchangeRate] = useState("");
  const [landedCostMvr, setLandedCostMvr] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [reference, setReference] = useState("");
  const [receiptKey, setReceiptKey] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustReference, setAdjustReference] = useState("");
  const [adjustments, setAdjustments] = useState<Array<{ productId: string; variantKey: string; expectedBalance: string; targetBalance: string; delta: string }>>([
    { productId: products[0]?.id || "", variantKey: "", expectedBalance: "", targetBalance: "", delta: "" },
  ]);

  const selectedProduct = useMemo(() => products.find(product => product.id === productId), [products, productId]);
  const selectedVariants = useMemo(() => variants(selectedProduct), [selectedProduct]);
  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id);
  }, [productId, products]);
  useEffect(() => {
    if (variantKey && !selectedVariants.includes(variantKey)) setVariantKey("");
  }, [variantKey, selectedVariants]);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "Inventory request failed");
    return body;
  }

  async function loadData() {
    try {
      const [supplierRows, batchRows, movementRows] = await Promise.all([
        request("/api/admin/inventory/suppliers"),
        request("/api/admin/inventory/batches"),
        request("/api/admin/inventory/movements"),
      ]);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
      setBatches(Array.isArray(batchRows) ? batchRows : []);
      setMovements(Array.isArray(movementRows) ? movementRows : []);
    } catch (caught) {
      setError(errorText(caught));
    }
  }
  useEffect(() => { void loadData(); }, []);

  async function submitSupplier(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const created = await request("/api/admin/inventory/suppliers", { method: "POST", body: JSON.stringify({ name: supplierName, contact: supplierContact || null }) });
      setSuppliers(previous => [...previous.filter(item => item.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(created.id); setSupplierName(""); setSupplierContact(""); setMessage("Supplier saved.");
    } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); }
  }

  async function receiveBatch(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm("Record this receipt and increase the selected stock balance?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = {
        productId, variantKey: variantKey || null, quantity: Number(quantity), supplierId: supplierId || undefined,
        supplierCost: Number(supplierCost), costCurrency, exchangeRate: costCurrency === "USD" ? Number(exchangeRate) : undefined,
        landedCostMvr: landedCostMvr ? Number(landedCostMvr) : undefined, reference: reference || null, receiptKey,
        ...(arrivalDate ? { arrivedAt: arrivalDate } : {}),
      };
      const result = await request("/api/admin/inventory/receipts", { method: "POST", body: JSON.stringify(body) });
      await loadData(); await onProductsChanged?.();
      setQuantity(""); setSupplierCost(""); setExchangeRate(""); setLandedCostMvr(""); setReceiptKey(""); setMessage(result.idempotent ? "Receipt already recorded; no stock was changed." : "Batch received and stock updated.");
    } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); }
  }

  function updateAdjustment(index: number, patch: Partial<typeof adjustments[number]>) {
    setAdjustments(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }
  async function submitAdjustments(event: React.FormEvent) {
    event.preventDefault();
    if (!adjustReason.trim() || adjustments.some(row => !row.productId || row.expectedBalance === "" || (row.targetBalance === "" && row.delta === ""))) {
      setError("Select a product, expected balance, target or delta, and a reason for every adjustment."); return;
    }
    if (!window.confirm("Review the rows carefully. Apply these inventory adjustments?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const rows = adjustments.map(row => ({
        productId: row.productId, variantKey: row.variantKey || null, expectedBalance: Number(row.expectedBalance),
        ...(row.targetBalance !== "" ? { targetBalance: Number(row.targetBalance) } : { delta: Number(row.delta) }),
      }));
      const result = await request("/api/admin/inventory/bulk-adjustments", { method: "POST", body: JSON.stringify({ reason: adjustReason, reference: adjustReference || null, rows }) });
      await loadData(); await onProductsChanged?.();
      setMessage(`${result.changes?.length || 0} adjustment${result.changes?.length === 1 ? "" : "s"} applied.`);
      setAdjustments([{ productId: products[0]?.id || "", variantKey: "", expectedBalance: "", targetBalance: "", delta: "" }]); setAdjustReason(""); setAdjustReference("");
    } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); }
  }

  const balanceFor = (row: typeof adjustments[number]) => {
    const product = products.find(item => item.id === row.productId);
    if (!product) return 0;
    return row.variantKey ? Number(((product as any).variantStock || {})[row.variantKey] || 0) : Number(product.stock || 0);
  };

  return (
    <section className="space-y-5" aria-label="Batch inventory tools">
      {(error || message) && <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-[#ebc4be] bg-[#fff0ee] text-[#a44539]" : "border-[#b9ded8] bg-[#e8f5f2] text-[#126f69]"}`}>{error || message}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,.7fr)]">
        <form onSubmit={receiveBatch} className={`${cardClass} space-y-4`}>
          <div><p className="admin-kicker">Receiving ledger</p><h2 className="mt-1 text-2xl text-[#12334a]">Receive inventory batch</h2><p className="mt-1 text-sm text-slate-500">Adds stock atomically and keeps a supplier cost layer for FIFO or average-cost reporting.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Product<select className={inputClass} value={productId} onChange={event => { setProductId(event.target.value); setVariantKey(""); }}>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <label className={labelClass}>Variant bucket<select className={inputClass} value={variantKey} onChange={event => setVariantKey(event.target.value)}><option value="">Scalar / total stock</option>{selectedVariants.map(key => <option key={key} value={key}>{key}</option>)}</select></label>
            <label className={labelClass}>Quantity<input className={inputClass} type="number" min="1" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
            <label className={labelClass}>Arrival date<input className={inputClass} type="date" value={arrivalDate} onChange={event => setArrivalDate(event.target.value)} /></label>
            <label className={labelClass}>Supplier<select className={inputClass} value={supplierId} onChange={event => setSupplierId(event.target.value)} required><option value="">Choose supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className={labelClass}>Supplier cost<input className={inputClass} type="number" min="0" step="0.0001" required value={supplierCost} onChange={event => setSupplierCost(event.target.value)} /></label>
            <label className={labelClass}>Cost currency<select className={inputClass} value={costCurrency} onChange={event => setCostCurrency(event.target.value as "MVR" | "USD")}><option>MVR</option><option>USD</option></select></label>
            {costCurrency === "USD" && <label className={labelClass}>Manual USD → MVR rate<input className={inputClass} type="number" min="0.000001" step="0.000001" required value={exchangeRate} onChange={event => setExchangeRate(event.target.value)} /></label>}
            <label className={labelClass}>Landed unit cost in MVR (optional)<input className={inputClass} type="number" min="0" step="0.0001" value={landedCostMvr} onChange={event => setLandedCostMvr(event.target.value)} placeholder="Uses supplier cost if blank" /></label>
            <label className={labelClass}>Reference<input className={inputClass} value={reference} onChange={event => setReference(event.target.value)} placeholder="Invoice or shipment ref" /></label>
            <label className={`${labelClass} sm:col-span-2`}>Receipt key (unique)<input className={inputClass} required value={receiptKey} onChange={event => setReceiptKey(event.target.value)} placeholder="e.g. SUPPLIER-INV-2025-001" /><span className="normal-case tracking-normal text-slate-400">Retrying the same key is safe and will not add stock twice.</span></label>
          </div>
          <div className={adminActionRowClass}><button type="submit" disabled={busy || !products.length} className={adminButtonClass("primary")}>{busy ? "Saving…" : "Record receipt"}</button></div>
        </form>
        <form onSubmit={submitSupplier} className={`${cardClass} space-y-4 self-start`}>
          <div><p className="admin-kicker">Supplier directory</p><h2 className="mt-1 text-2xl text-[#12334a]">Add supplier</h2></div>
          <label className={labelClass}>Supplier name<input className={inputClass} required value={supplierName} onChange={event => setSupplierName(event.target.value)} /></label>
          <label className={labelClass}>Contact<input className={inputClass} value={supplierContact} onChange={event => setSupplierContact(event.target.value)} /></label>
          <div className={adminActionRowClass}><button type="submit" disabled={busy} className={adminButtonClass("outline")}>Save supplier</button></div>
          <div className="border-t border-slate-100 pt-3 text-sm text-slate-500">{suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} available</div>
        </form>
      </div>

      <form onSubmit={submitAdjustments} className={`${cardClass} space-y-4`}>
        <div><p className="admin-kicker">Controlled stock changes</p><h2 className="mt-1 text-2xl text-[#12334a]">Bulk adjustment review</h2><p className="mt-1 text-sm text-slate-500">Expected balances prevent stale edits. Failed requests leave stock unchanged.</p></div>
        <div className="space-y-3">
          {adjustments.map((row, index) => {
            const product = products.find(item => item.id === row.productId);
            return <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[1.35fr_1fr_.8fr_.8fr_.8fr_auto] md:items-end">
              <label className={labelClass}>Product<select className={inputClass} value={row.productId} onChange={event => updateAdjustment(index, { productId: event.target.value, variantKey: "" })}>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className={labelClass}>Variant<select className={inputClass} value={row.variantKey} onChange={event => updateAdjustment(index, { variantKey: event.target.value })}><option value="">Scalar ({balanceFor(row)})</option>{variants(product).map(key => <option key={key} value={key}>{key}</option>)}</select></label>
              <label className={labelClass}>Expected<input className={inputClass} type="number" min="0" step="1" required value={row.expectedBalance} onChange={event => updateAdjustment(index, { expectedBalance: event.target.value })} placeholder={String(balanceFor(row))} /></label>
              <label className={labelClass}>Target<input className={inputClass} type="number" min="0" step="1" value={row.targetBalance} onChange={event => updateAdjustment(index, { targetBalance: event.target.value, delta: "" })} /></label>
              <label className={labelClass}>Or delta<input className={inputClass} type="number" step="1" value={row.delta} onChange={event => updateAdjustment(index, { delta: event.target.value, targetBalance: "" })} /></label>
              <button type="button" disabled={adjustments.length === 1} onClick={() => setAdjustments(rows => rows.filter((_, rowIndex) => rowIndex !== index))} className={adminButtonClass("danger")}>Remove</button>
            </div>;
          })}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>Required reason<textarea className={`${inputClass} h-20 py-2`} required minLength={3} maxLength={500} value={adjustReason} onChange={event => setAdjustReason(event.target.value)} placeholder="Explain the count, damage, loss, or correction" /></label>
          <label className={labelClass}>Reference<textarea className={`${inputClass} h-20 py-2`} value={adjustReference} onChange={event => setAdjustReference(event.target.value)} placeholder="Optional count sheet or incident reference" /></label>
        </div>
        <div className={adminActionRowClass}><button type="button" className={adminButtonClass("quiet")} onClick={() => setAdjustments(rows => [...rows, { productId: products[0]?.id || "", variantKey: "", expectedBalance: "", targetBalance: "", delta: "" }])}>+ Add row</button><button type="submit" disabled={busy || !products.length} className={adminButtonClass("primary")}>Review and apply</button></div>
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cardClass}><div className="mb-3"><p className="admin-kicker">Cost layers</p><h2 className="mt-1 text-2xl text-[#12334a]">Batch balances</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-200"><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Batch</th><th className="py-2 pr-3">Remaining</th><th className="py-2">Landed / MVR</th></tr></thead><tbody>{batches.slice(0, 100).map(batch => <tr key={batch.id} className="border-b border-slate-100"><td className="py-2 pr-3 font-medium text-[#12334a]">{productName(products, batch.product_id)}{batch.variant_key && <span className="block text-slate-400">{batch.variant_key}</span>}</td><td className="py-2 pr-3 text-slate-500">{batch.supplier_name || "Supplier"}<span className="block">{batch.reference || batch.id.slice(0, 8)}</span></td><td className="py-2 pr-3">{batch.quantity_remaining} / {batch.quantity_received}</td><td className="py-2">{batch.unit_landed_cost_mvr ?? "—"}</td></tr>)}</tbody></table>{!batches.length && <p className="py-5 text-sm text-slate-500">No received batches yet.</p>}</div></section>
        <section className={cardClass}><div className="mb-3"><p className="admin-kicker">Audit trail</p><h2 className="mt-1 text-2xl text-[#12334a]">Recent movements</h2></div><div className="max-h-72 space-y-2 overflow-y-auto">{movements.slice(0, 100).map(movement => <div key={movement.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-xs"><div><p className="font-semibold text-[#12334a]">{productName(products, movement.product_id)} {movement.variant_key && `· ${movement.variant_key}`}</p><p className="text-slate-500">{movement.reason} · {movement.actor_name || "Admin"}</p></div><div className={`shrink-0 font-bold ${movement.quantity_delta < 0 ? "text-[#a44539]" : "text-[#126f69]"}`}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}<span className="block text-right font-normal text-slate-400">{movement.quantity_after} balance</span></div></div>)}{!movements.length && <p className="py-5 text-sm text-slate-500">No movements yet.</p>}</div></section>
      </div>
    </section>
  );
}

export default AdminBatchInventory;