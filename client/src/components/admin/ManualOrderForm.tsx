import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Product, getVariantSalePrice } from "@/lib/products";
import PosPayments, { PosPaymentLine, PosTaxType } from "./PosPayments";
import { adminButtonClass, adminControlClass } from "./admin-ui";

type ManualOrderSettings = { taxEnabled?: boolean; gstRate?: number; tgstRate?: number; usdToMvrRate?: number | null };
type ManualItem = { productId: string; size: string; color: string; qty: number };

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function idempotencyKey(payload: unknown): string {
  let hash = 2166136261;
  for (const char of stableStringify(payload)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `manual-${(hash >>> 0).toString(16)}`;
}

export default function ManualOrderForm({
  open,
  products,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  products: Product[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void> | void;
}) {
  const [settings, setSettings] = useState<ManualOrderSettings>({ taxEnabled: false, usdToMvrRate: 15.42 });
  const [settingsError, setSettingsError] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ManualItem[]>([{ productId: "", size: "Standard", color: "Default", qty: 1 }]);
  const [taxType, setTaxType] = useState<PosTaxType>("NONE");
  const [paymentLines, setPaymentLines] = useState<PosPaymentLine[]>([]);
  const [feeMvr, setFeeMvr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lastPayload = useRef("");
  const lastKey = useRef("");

  useEffect(() => {
    if (!open) return;
    setLoadingSettings(true);
    setSettingsError("");
    fetch("/api/admin/manual-orders/settings", { credentials: "same-origin" })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "Manual-order settings could not be loaded.");
        return body;
      })
       .then(value => setSettings({ taxEnabled: false, ...(value || {}), usdToMvrRate: value?.usdToMvrRate ?? 15.42 }))
      .catch(reason => setSettingsError(reason instanceof Error ? reason.message : "Manual-order settings could not be loaded."))
      .finally(() => setLoadingSettings(false));
  }, [open]);

  const selectedTotal = useMemo(() => items.reduce((sum, item) => {
    const product = products.find(candidate => candidate.id === item.productId);
    if (!product) return sum;
    const variant = product?.variants?.find(candidate => candidate.size === item.size);
    const price = variant ? getVariantSalePrice(product, variant.price) : getVariantSalePrice(product, product.price);
    return sum + price * Math.max(0, item.qty);
  }, 0), [items, products]);

  const updateItem = (index: number, patch: Partial<ManualItem>) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  // Manual orders are an admin workflow and may use catalog products hidden
  // from the public storefront; visibility is never changed by this form.
  const productOptions = products;

  const submit = async () => {
    setError("");
    if (settingsError || loadingSettings) return;
    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim() || !shippingAddress.trim() || items.some(item => !item.productId || item.qty < 1)) {
      setError("Customer name, email, phone, shipping address, products and positive quantities are required.");
      return;
    }
    if (!paymentLines.length) {
      setError("Add at least one payment tender.");
      return;
    }
    const payload = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress: shippingAddress.trim(),
      deliveryType: "male",
      notes: notes.trim() || null,
      items: items.map(item => ({ productId: item.productId, size: item.size, color: item.color, qty: item.qty })),
      taxType,
      paymentMethod: "cod",
      paymentLines: paymentLines.map(line => ({ method: line.method, currency: line.currency, amount: Number(line.amount), ...(line.usdToMvrRate ? { usdToMvrRate: Number(line.usdToMvrRate) } : {}), ...(line.reference ? { reference: line.reference } : {}) })),
      feeMvr: Number(feeMvr || 0),
    };
    const serialized = stableStringify(payload);
    if (serialized !== lastPayload.current) {
      lastPayload.current = serialized;
      lastKey.current = idempotencyKey(payload);
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/manual-orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": lastKey.current },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Manual order could not be created.");
      await onCreated();
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manual order could not be created. Retry without changing the form to reuse the idempotency key.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Create manual order</DialogTitle><DialogDescription>Admin-only order entry. The server rechecks catalog prices, stock and payment totals.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          {(settingsError || error) && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{settingsError || error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Name</Label><Input className={adminControlClass} value={customerName} onChange={event => setCustomerName(event.target.value)} /></div>
            <div><Label>Email</Label><Input className={adminControlClass} type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} /></div>
            <div><Label>Phone</Label><Input className={adminControlClass} value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} /></div>
          </div>
          <div><Label>Shipping address</Label><Textarea value={shippingAddress} onChange={event => setShippingAddress(event.target.value)} /></div>
          <div className="space-y-3"><div className="flex items-center justify-between"><Label>Catalog items</Label><Button type="button" variant="outline" onClick={() => setItems(current => [...current, { productId: "", size: "Standard", color: "Default", qty: 1 }])}>Add item</Button></div>
            {items.map((item, index) => {
              const product = products.find(candidate => candidate.id === item.productId);
              const sizes = product?.variants?.length ? product.variants.map(variant => variant.size) : ["Standard"];
              const colors = product?.colors?.length ? product.colors : ["Default"];
              return <Card key={index}><CardContent className="grid gap-2 p-3 sm:grid-cols-4">
                <select className={adminControlClass} value={item.productId} onChange={event => updateItem(index, { productId: event.target.value, size: "Standard", color: "Default" })}><option value="">Select product</option>{productOptions.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
                <select className={adminControlClass} value={item.size} onChange={event => updateItem(index, { size: event.target.value })}>{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select>
                <select className={adminControlClass} value={item.color} onChange={event => updateItem(index, { color: event.target.value })}>{colors.map(color => <option key={color} value={color}>{color}</option>)}</select>
                <Input type="number" min="1" className={adminControlClass} value={item.qty} onChange={event => updateItem(index, { qty: Number(event.target.value) })} />
                {product && <p className="text-xs text-muted-foreground sm:col-span-4">Catalog sale price preview: MVR {getVariantSalePrice(product, product.variants?.find(variant => variant.size === item.size)?.price ?? product.price).toFixed(2)} · server validates final price and stock.</p>}
              </CardContent></Card>;
            })}
          </div>
          <PosPayments currentTotalMvr={selectedTotal} taxType={taxType} onTaxTypeChange={setTaxType} initialSettings={settings} taxEnabled={settings.taxEnabled} gstRate={settings.gstRate} tgstRate={settings.tgstRate} splitLines={paymentLines} onSplitLinesChange={setPaymentLines} processingFeeMvr={feeMvr} onProcessingFeeMvrChange={setFeeMvr} />
          <div><Label>Order notes</Label><Textarea value={notes} onChange={event => setNotes(event.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" className={adminButtonClass("primary")} disabled={Boolean(settingsError) || loadingSettings || submitting} onClick={submit}>{submitting ? "Creating…" : "Create order"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}