import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getProductVariants, type Product } from "@/lib/products";
import { quoteLineFromProduct, type QuotationLine } from "@/lib/quotation-catalog";
import { adminControlClass } from "./admin-ui";

export function QuotationCatalogPicker({ onAdd, disabled = false }: { onAdd: (item: QuotationLine) => void; disabled?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState("");
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

  const matches = products.filter(product =>
    `${product.name} ${product.sku || ""} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const choices = matches.map(product => ({
    product,
    options: getProductVariants(product).flatMap((variant, variantIndex) =>
      (product.colors?.filter(Boolean).length ? product.colors.filter(Boolean) : [""]).map((color, colorIndex) => ({
        key: `${product.id}:${variantIndex}:${colorIndex}`,
        line: quoteLineFromProduct(product, variant.size, color),
      }))).filter(choice => choice.line !== null),
  }));
  const fieldClass = `${adminControlClass} w-full min-w-0`;

  return <section aria-label="Add catalog product" className="mb-5 rounded-xl border border-[#b9ded8] bg-white p-4">
    <h3 className="text-sm font-semibold text-[#12334a]">Products from catalog</h3>
    <p className="mb-3 mt-1 text-xs text-slate-500">Choose a product to add a priced line immediately. Adjust quantity or price in the line below.</p>
    {error && <p role="alert" className="mb-3 text-sm text-[#a44539]">{error} <button type="button" className="font-semibold underline" onClick={() => setReload(value => value + 1)}>Retry</button></p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-600">Search catalog
        <input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Name, SKU or category" className={fieldClass} />
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-600">Add a product
        <select aria-label="Add catalog product to quotation" value="" disabled={loading || !!error || disabled} onChange={event => {
          const choice = choices.flatMap(group => group.options).find(option => option.key === event.target.value);
          if (choice?.line) { onAdd(choice.line); setAdded(choice.line.description); }
        }} className={fieldClass}>
          <option value="">{disabled ? "Maximum of 50 lines" : loading ? "Loading catalog…" : choices.some(group => group.options.length) ? "Select a product and variant" : "No matching products"}</option>
          {choices.map(({ product, options }) => options.length > 0 && <optgroup key={product.id} label={`${product.name}${product.showOnStorefront === false ? " (not on storefront)" : ""}`}>
            {options.map(({ key, line }) => <option key={key} value={key}>{line!.description} · MVR {line!.unitPrice.toFixed(2)}</option>)}
          </optgroup>)}
        </select>
      </label>
    </div>
    {added && <p role="status" className="mt-3 text-xs font-medium text-[#126f69]">Added {added} to the quotation below.</p>}
  </section>;
}