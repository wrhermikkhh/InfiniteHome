import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getProductVariants, type Product } from "@/lib/products";
import { quoteLineFromProduct, type QuotationLine } from "@/lib/quotation-catalog";

export function QuotationCatalogPicker({ onAdd }: { onAdd: (item: QuotationLine) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.getProducts()
      .then(result => {
        if (!Array.isArray(result)) throw new Error("The catalog returned an unexpected response.");
        if (active) setProducts(result.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Catalog could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const selected = products.find(product => product.id === productId);
  const variants = selected ? getProductVariants(selected) : [];
  const colors = selected?.colors?.filter(Boolean) || [];
  const matches = products.filter(product =>
    `${product.name} ${product.sku || ""} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const line = selected ? quoteLineFromProduct(selected, size, color) : null;
  const fieldClass = "h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-[#12334a] outline-none focus:border-[#16877f] focus:ring-2 focus:ring-[#16877f]/10";

  return <section aria-label="Add catalog product" className="mb-5 rounded-lg border border-[#b9ded8] bg-white p-4">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-[#12334a]">Add from catalog</h3>
      <p className="mt-1 text-xs text-slate-500">Copies the current name and full price into an editable quotation line. This does not reserve stock or change existing quotes.</p>
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-[#a44539]">{error} <button type="button" className="font-semibold underline" onClick={() => setReload(value => value + 1)}>Retry</button></p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,.7fr)_minmax(0,.7fr)]">
      <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">Search products
        <input value={search} onChange={event => { setSearch(event.target.value); setProductId(""); }} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Name, SKU or category" className={fieldClass} />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">Product
        <select aria-label="Catalog product" value={productId} disabled={loading || !!error} onChange={event => {
          const product = products.find(item => item.id === event.target.value);
          setProductId(event.target.value);
          setSize(product ? getProductVariants(product)[0]?.size || "Standard" : "");
          setColor(product?.colors?.[0] || "");
        }} className={fieldClass}>
          <option value="">{loading ? "Loading catalog…" : matches.length ? "Select a product" : "No matching products"}</option>
          {matches.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}{product.showOnStorefront === false ? " (not on storefront)" : ""}</option>)}
        </select>
      </label>
      {variants.length > 1 && <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">Size
        <select aria-label="Product size" value={size} onChange={event => setSize(event.target.value)} className={fieldClass}>
          {variants.map(variant => <option key={variant.size} value={variant.size}>{variant.size}</option>)}
        </select>
      </label>}
      {colors.length > 1 && <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">Color
        <select aria-label="Product color" value={color} onChange={event => setColor(event.target.value)} className={fieldClass}>
          {colors.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{selected && (line ? `${selected.isPreOrder ? "Full pre-order price" : "Current catalog price"}: MVR ${line.unitPrice.toFixed(2)}` : "This product has no valid full price or description. Use a manual line.")}</span>
      <button type="button" disabled={!line} onClick={() => { if (line) onAdd(line); }} className="rounded-lg bg-[#12334a] px-4 py-2 text-xs font-bold uppercase tracking-[.08em] text-white hover:bg-[#0c283b] disabled:cursor-not-allowed disabled:opacity-50">Add product to quote</button>
    </div>
  </section>;
}