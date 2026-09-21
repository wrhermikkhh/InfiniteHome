import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InventoryReconciliation() {
  const [kind, setKind] = useState("order");
  const [reference, setReference] = useState("");
  const [loadedKind, setLoadedKind] = useState("order");
  const [data, setData] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(path: string, body?: any) {
    const response = await fetch(`/api/inventory/reconcile/${path}`, {
      credentials: "same-origin", method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Inventory reconciliation failed");
    return result;
  }
  async function load() {
    setBusy(true); setMessage(""); setData(null); setApproved(false); setNote("");
    try {
      const result = await request(`${kind}/${encodeURIComponent(reference.trim())}`);
      setData(result); setLoadedKind(kind);
      setEntries(result.sale.items.filter((i: any) => i.productId).map((i: any) => ({
        productId: i.productId, name: i.name, sold: i.qty, preOrder: !!i.isPreOrder, qty: "", key: "", total: false,
      })));
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function save() {
    if (!window.confirm("Record your verified outstanding allocations? This does not change current stock. A subsequent cancellation WILL restore exactly these quantities. Empty quantities mean no stock remains to restore.")) return;
    setBusy(true); setMessage("");
    try {
      const allocations = entries.filter(e => e.qty !== "" && Number(e.qty) !== 0).map(e => ({
        productId: e.productId, preOrder: e.preOrder, qty: Number(e.qty), total: e.total, ...(e.key ? { key: e.key } : {}),
      }));
      const result = await request(`${loadedKind}/${encodeURIComponent(data.sale.id)}`, { approved, note, allocations });
      setMessage(result.message); setData(null);
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  const change = (index: number, patch: any) => setEntries(entries.map((e, i) => i === index ? { ...e, ...patch } : e));
  return <details className="border p-4 mb-6">
    <summary className="font-semibold cursor-pointer">Historical inventory reconciliation</summary>
    <div className="space-y-3 mt-3">
      <p className="text-sm">For historical COD/bank orders and POS sales without allocation records. Requires both inventory and order permissions. Verify the original deduction, any previous restoration, and physical stock before approval. This records outstanding allocations only; it never adjusts stock automatically. RedotPay uses its own reconciliation panel.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Sale type" className="border p-2" value={kind} onChange={e => setKind(e.target.value)}><option value="order">Order</option><option value="pos">POS</option></select>
        <input className="border p-2 flex-1 min-w-48" aria-label="Historical sale reference" placeholder="Full order / POS reference or ID" value={reference} onChange={e => setReference(e.target.value)} />
        <Button disabled={busy || !reference.trim()} variant="outline" onClick={() => void load()}>Load sale</Button>
      </div>
      {message && <p role="status" className="text-sm font-medium">{message}</p>}
      {data && <div className="space-y-3">
        <p>{data.sale.reference} — {data.sale.status}</p>
        {data.ledger ? <p>This sale already has an inventory ledger. It cannot be overwritten. {data.ledger.reconciliation_note}</p> :
          data.sale.status === "cancelled" || data.sale.payment_method === "redotpay" || data.sale.converted_to_order_id
            ? <p>This sale is cancelled, converted, or managed by RedotPay and cannot be reconciled here.</p>
            : <>
              <p className="text-sm font-medium">Enter only units still deducted and not previously restored. Leave quantity empty for no outstanding stock. Choose the exact stock bucket that was deducted, not a guess based on the item label.</p>
              {entries.map((entry, index) => {
                const product = data.products.find((p: any) => p.id === entry.productId);
                const map = product?.[entry.preOrder ? "pre_order_variant_stock" : "variant_stock"] || {};
                const total = product?.[entry.preOrder ? "pre_order_stock" : "stock"];
                return <div key={index} className="border p-3 space-y-2">
                  <p>{entry.name} · sold {entry.sold} · {entry.preOrder ? "pre-order" : "regular"}</p>
                  <p className="text-xs break-all">Product ID: {entry.productId}{!product && " — product missing; repair before allocating"}</p>
                  <label className="block text-sm">Units still deducted <input className="border p-1 ml-2 w-24" type="number" min="0" max={entry.sold} step="1" value={entry.qty} onChange={e => change(index, { qty: e.target.value })} /></label>
                  <label className="block text-sm">Exact variant bucket <select className="border p-1 ml-2" value={entry.key} onChange={e => change(index, { key: e.target.value, ...(!entry.preOrder && e.target.value ? { total: false } : {}) })}>
                    <option value="">No variant allocation</option>{Object.entries(map).map(([key, qty]) => <option key={key} value={key}>{key} (currently {String(qty)})</option>)}
                  </select></label>
                  <label className="block text-sm"><input type="checkbox" checked={entry.total} disabled={total == null || (!entry.preOrder && !!entry.key)} onChange={e => change(index, { total: e.target.checked })} /> Total/scalar bucket was also deducted (currently {total ?? "uncapped/unavailable"})</label>
                </div>;
              })}
              <label className="block text-sm">Audit note — evidence checked and why these quantities remain deducted (minimum 20 characters)
                <textarea className="border p-2 w-full" rows={3} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} />
              </label>
              <label className="block text-sm"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> I verified these outstanding deductions against original records and actual inventory, including any earlier restoration. Empty quantities explicitly mean nothing remains to restore.</label>
              <Button disabled={busy || !approved || note.trim().length < 20} onClick={() => void save()}>Approve verified allocations</Button>
            </>}
      </div>}
    </div>
  </details>;
}