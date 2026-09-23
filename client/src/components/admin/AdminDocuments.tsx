import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QuotationCatalogPicker } from "./QuotationCatalogPicker";
import { adminButtonClass } from "./admin-ui";
import { quotationTotals } from "@shared/quotation-totals";

type View = "Quotations" | "Purchase Orders";
type DocumentKind = "quotation" | "purchase_order";
type QuotationStatus = "draft" | "sent" | "accepted" | "declined";
type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";
type Item = { description: string; quantity: number; unitPrice: number };

type AdminDocument = {
  id: string | number;
  number: string;
  kind: DocumentKind;
  partyName: string;
  contact: string | null;
  notes: string | null;
  dueDate: string | null;
  status: QuotationStatus | PurchaseOrderStatus;
  items: Item[];
  discount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  partyName: string;
  contact: string;
  notes: string;
  dueDate: string;
  status: string;
  items: Item[];
  discount: number;
};

const quotationStatuses: QuotationStatus[] = ["draft", "sent", "accepted", "declined"];
const purchaseOrderStatuses: PurchaseOrderStatus[] = ["draft", "ordered", "received", "cancelled"];

const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) =>
  new Intl.NumberFormat("en-MV", { style: "currency", currency: "MVR", currencyDisplay: "code", minimumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
const dateLabel = (value?: string | null) => {
  if (!value) return "No due date";
  const parsed = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString("en-MV", { day: "numeric", month: "short", year: "numeric" });
};
const endpointFor = (view: View) => (view === "Quotations" ? "quotations" : "purchase-orders");
const kindFor = (view: View): DocumentKind => (view === "Quotations" ? "quotation" : "purchase_order");
const emptyItem = (): Item => ({ description: "", quantity: 1, unitPrice: 0 });

function emptyForm(view: View): FormState {
  return { partyName: "", contact: "", notes: "", dueDate: "", status: "draft", items: view === "Quotations" ? [] : [emptyItem()], discount: 0 };
}

function buttonClass(tone: "primary" | "quiet" | "danger" = "quiet") {
  return adminButtonClass(tone === "quiet" ? "outline" : tone);
}

function statusClass(status: string) {
  if (["accepted", "received"].includes(status)) return "border-[#b9ded8] bg-[#e8f5f2] text-[#126f69]";
  if (["sent", "ordered"].includes(status)) return "border-[#ead6aa] bg-[#fff8e9] text-[#805e1d]";
  if (["declined", "cancelled"].includes(status)) return "border-[#ebc4be] bg-[#fff0ee] text-[#a44539]";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function FormField({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}{required && <span className="text-[#a44539]"> *</span>}{children}</label>;
}

function DocumentForm({
  view, form, setForm, editing, saving, onSubmit, onCancel,
}: {
  view: View; form: FormState; setForm: (next: FormState) => void; editing: AdminDocument | null; saving: boolean;
  onSubmit: (event: FormEvent) => void; onCancel: () => void;
}) {
  const isQuotation = view === "Quotations";
  const { subtotal, total: previewTotal } = quotationTotals(form.items, isQuotation ? form.discount : 0);
  const invalidDiscount = isQuotation && (form.discount < 0 || form.discount > subtotal);
  const fieldClass = "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#12334a] outline-none transition placeholder:text-slate-400 focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/10";
  const updateItem = (index: number, patch: Partial<Item>) => setForm({ ...form, items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-[#b9ded8] bg-[#fbfdfc] p-4 shadow-[0_8px_25px_rgba(18,51,74,.06)] md:p-6" aria-labelledby="document-form-title">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#16877f]">{editing ? "Edit record" : "New record"}</p><h2 id="document-form-title" className="mt-1 font-serif text-2xl text-[#12334a]">{editing ? `Edit ${editing.number}` : `New ${isQuotation ? "quotation" : "purchase order"}`}</h2><p className="mt-1 text-xs text-slate-500">{isQuotation ? "A price offer for a customer or client." : "A supplier document for purchasing."} Values are MVR.</p></div>
        <button type="button" onClick={onCancel} className={buttonClass()}>Close form</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={isQuotation ? "Customer / party" : "Supplier / party"} required><input required value={form.partyName} onChange={(event) => setForm({ ...form, partyName: event.target.value })} className={fieldClass} /></FormField>
        <FormField label="Contact"><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className={fieldClass} placeholder="Email or phone" /></FormField>
        <FormField label={isQuotation ? "Valid until" : "Expected delivery"}><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={fieldClass} /></FormField>
        <FormField label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={fieldClass}>{(isQuotation ? quotationStatuses : purchaseOrderStatuses).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></FormField>
      </div>
      <FormField label="Notes"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#12334a] outline-none focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/10" /></FormField>
      <div className="mt-5">
        {isQuotation && <QuotationCatalogPicker disabled={form.items.length >= 50} onAdd={item => setForm({ ...form, items: [...form.items, item] })} />}
        <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Line items</h3><button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} className={buttonClass()} disabled={form.items.length >= 50}>Add custom line</button></div>
        <div className="space-y-2">
          {form.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">Choose a catalog product above or add a custom line to start your quotation.</p>}
          {form.items.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto] sm:items-end">
            <FormField label={`Description ${index + 1}`} required><input required value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} className={fieldClass} /></FormField>
            <FormField label="Quantity" required><input required min="0" step="any" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className={fieldClass} /></FormField>
            <FormField label="Unit price (MVR)" required><input required min="0" step="0.01" type="number" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} className={fieldClass} /></FormField>
            <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })} className={buttonClass("danger")} aria-label={`Remove line ${index + 1}`}>Remove</button>
          </div>)}
        </div>
        {isQuotation && <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:items-end">
          <p className="text-sm text-slate-600">Subtotal <span className="ml-3 font-semibold text-[#12334a]">{money(subtotal)}</span></p>
          <FormField label="Discount (MVR)"><input aria-label="Discount (MVR)" type="number" min="0" max={subtotal} step="0.01" value={form.discount} onChange={event => setForm({ ...form, discount: Number(event.target.value) })} className={`${fieldClass} w-full sm:w-40`} /></FormField>
          {invalidDiscount && <p role="alert" className="text-xs text-[#a44539]">Discount cannot exceed the subtotal.</p>}
        </div>}
        <div className={`${isQuotation ? "mt-3" : "mt-4 border-t border-slate-200 pt-4"} flex flex-wrap items-center justify-between gap-3`}><span className="text-xs text-slate-500">Total after discount · confirmed on save</span><strong className="font-serif text-xl text-[#12334a]">{money(previewTotal)}</strong></div>
      </div>
      <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row"><button type="button" onClick={onCancel} className={buttonClass()} disabled={saving}>Cancel</button><button type="submit" className={buttonClass("primary")} disabled={saving || invalidDiscount || form.items.length === 0}>{saving ? "Saving…" : editing ? "Save changes" : `Save ${isQuotation ? "quotation" : "purchase order"}`}</button></div>
    </form>
  );
}

function printDocument(document: AdminDocument) {
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
  const rows = document.items.map((item) => `<tr><td>${escape(item.description)}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.quantity * item.unitPrice)}</td></tr>`).join("");
  const title = document.kind === "quotation" ? "Quotation" : "Purchase Order";
  const discount = document.discount || 0;
  const discountRows = discount > 0 ? `<div class="total">Subtotal: ${escape(money(document.total + discount))}</div><div class="total">Discount: -${escape(money(discount))}</div>` : "";
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><title>${escape(title)} ${escape(document.number)}</title><style>body{font-family:Arial,sans-serif;color:#12334a;max-width:820px;margin:48px auto;padding:0 24px}h1{font-size:28px;margin:0 0 6px}p{color:#526572}.meta{border-top:2px solid #16877f;border-bottom:1px solid #d8e2e4;padding:18px 0;margin:24px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#607581}table{border-collapse:collapse;width:100%;margin-top:28px}th,td{padding:11px 8px;border-bottom:1px solid #d8e2e4;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:20px}.notes{white-space:pre-wrap;margin-top:32px}@media print{body{margin:0}}</style></head><body><p>INFINITE HOME</p><h1>${escape(title)}</h1><p>${escape(document.number)} · MVR</p><div class="meta"><div><div class="label">Party</div>${escape(document.partyName)}</div><div><div class="label">Contact</div>${escape(document.contact || "Not provided")}</div><div><div class="label">Status</div>${escape(statusLabel(document.status))}</div><div><div class="label">${document.kind === "quotation" ? "Valid until" : "Expected delivery"}</div>${escape(dateLabel(document.dueDate))}</div></div><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>${rows}</tbody></table>${discountRows}<div class="total">Total: ${escape(money(document.total))}</div>${document.notes ? `<div class="notes"><div class="label">Notes</div>${escape(document.notes)}</div>` : ""}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function AdminDocuments({ view }: { view: View }) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<AdminDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const endpoint = endpointFor(view);
  const statuses = view === "Quotations" ? quotationStatuses : purchaseOrderStatuses;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/${endpoint}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Could not load ${view.toLowerCase()} (HTTP ${response.status}).`);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(rows)) throw new Error(`Could not load ${view.toLowerCase()}: the server returned an unexpected response.`);
      setDocuments(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not load ${view.toLowerCase()}.`);
    } finally { setLoading(false); }
  }, [endpoint, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setForm(null); setEditing(null); setQuery(""); setStatusFilter("all"); }, [view]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => (statusFilter === "all" || document.status === statusFilter) && (!needle || `${document.number} ${document.partyName} ${document.contact || ""} ${document.notes || ""}`.toLowerCase().includes(needle)));
  }, [documents, query, statusFilter]);
  const openNew = () => { setEditing(null); setForm(emptyForm(view)); setError(""); };
  const openEdit = (document: AdminDocument) => {
    setEditing(document); setForm({ partyName: document.partyName, contact: document.contact || "", notes: document.notes || "", dueDate: document.dueDate || "", status: document.status, items: document.items.length ? document.items.map((item) => ({ ...item })) : [emptyItem()], discount: document.discount || 0 }); setError("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!form) return;
    setSaving(true); setError("");
    const body = { partyName: form.partyName.trim(), contact: form.contact.trim(), notes: form.notes.trim(), dueDate: form.dueDate || null, items: form.items.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })), discount: view === "Quotations" ? form.discount : 0, status: form.status };
    try {
      const response = await fetch(editing ? `/api/admin/${endpoint}/${encodeURIComponent(String(editing.id))}` : `/api/admin/${endpoint}`, { method: editing ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`Could not save ${view === "Quotations" ? "quotation" : "purchase order"} (HTTP ${response.status}).`);
      const saved = await response.json() as AdminDocument;
      if (!saved || saved.id === undefined) throw new Error("The server did not return the saved document.");
      setDocuments((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setForm(null); setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save document."); }
    finally { setSaving(false); }
  };
  const updateStatus = async (document: AdminDocument, status: string) => {
    setUpdatingId(document.id); setError("");
    try {
      const response = await fetch(`/api/admin/${endpoint}/${encodeURIComponent(String(document.id))}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error(`Could not update ${document.number} (HTTP ${response.status}).`);
      const saved = await response.json() as AdminDocument;
      if (!saved || saved.id === undefined) throw new Error("The server did not return the updated document.");
      setDocuments((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update status."); }
    finally { setUpdatingId(null); }
  };

  return <div className="w-full text-[#12334a]">
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#16877f]">Infinite Home / Documents</p><h1 className="font-serif text-3xl md:text-4xl">{view}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{view === "Quotations" ? "Price offers prepared for customers and clients. Status is marked manually; no messages are sent." : "Supplier documents for purchasing. Status is marked manually; receiving does not update inventory."} MVR only.</p></div><button type="button" onClick={openNew} className={buttonClass("primary")}>New {view === "Quotations" ? "quotation" : "purchase order"}</button></header>
    {error && <div role="alert" className="mb-5 flex flex-col justify-between gap-3 rounded-lg border border-[#ebc4be] bg-[#fff0ee] px-4 py-3 text-sm text-[#8f3f36] sm:flex-row sm:items-center"><span>{error}</span><button type="button" onClick={() => void load()} className="self-start text-xs font-bold uppercase tracking-[.08em] underline underline-offset-4">Retry</button></div>}
    {form && <div className="mb-6"><DocumentForm view={view} form={form} setForm={setForm} editing={editing} saving={saving} onSubmit={save} onCancel={() => { setForm(null); setEditing(null); }} /></div>}
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_25px_rgba(18,51,74,.05)]">
      <div className="flex flex-col gap-3 lg:flex-row"><label className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 px-3 focus-within:border-[#16877f]"><span className="sr-only">Search documents</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view.toLowerCase()}, party or contact`} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></label><label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal outline-none focus:border-[#16877f]"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></div>
      <div className="mt-4 flex items-center justify-between border-b border-slate-200 pb-3 text-xs text-slate-500"><span><strong className="text-[#12334a]">{filtered.length}</strong> of {documents.length} records</span><span>Persistent server records</span></div>
      {loading ? <div className="space-y-3 pt-4" aria-label="Loading documents"><div className="h-16 animate-pulse rounded-lg bg-slate-100" /><div className="h-16 animate-pulse rounded-lg bg-slate-100" /><div className="h-16 animate-pulse rounded-lg bg-slate-100" /></div> : error && !documents.length ? <div className="px-5 py-14 text-center text-sm text-slate-500">Documents could not be loaded. Retry to see current records.</div> :
        filtered.length === 0 ? <div className="px-5 py-14 text-center"><p className="font-serif text-xl text-[#12334a]">{documents.length ? "No documents match these filters" : `No ${view.toLowerCase()} yet`}</p><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{documents.length ? "Try clearing the search or selecting all statuses." : "Create a record to keep a persistent document history."}</p></div> :
        <div className="divide-y divide-slate-200">{filtered.map((document) => <article key={document.id} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto] md:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[#12334a]">{document.number}</strong><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${statusClass(document.status)}`}>{statusLabel(document.status)}</span></div><p className="mt-1 truncate text-sm">{document.partyName}</p><p className="truncate text-xs text-slate-500">{document.contact || "No contact provided"}</p></div>
           <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{view === "Quotations" ? "Valid until" : "Expected delivery"}</p><p className="mt-1 text-sm">{dateLabel(document.dueDate)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Total</p><p className="mt-1 font-semibold">{money(document.total)}</p></div>
           <div className="flex flex-wrap items-center gap-2 md:justify-end"><button type="button" onClick={() => { if (!printDocument(document)) setError("The browser blocked the print window. Allow pop-ups and try again."); }} className={buttonClass()}>Print</button><button type="button" onClick={() => openEdit(document)} className={buttonClass()}>Edit</button><select aria-label={`Update status for ${document.number}`} value={document.status} disabled={updatingId === document.id} onChange={(event) => void updateStatus(document, event.target.value)} className="h-10 min-w-[116px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#12334a] outline-none focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/20 disabled:opacity-50">{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
        </article>)}</div>}
    </section>
  </div>;
}

export default AdminDocuments;