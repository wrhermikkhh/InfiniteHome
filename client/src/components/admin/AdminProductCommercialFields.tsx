import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminButtonClass, adminControlClass } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export type AdminProductCommercialFields = {
  sku: string;
  costPrice: number | null;
  lowStockThreshold: number;
};

export type AdminProductVariantDraft = {
  size?: string;
  color?: string;
  /** A pre-combined key is accepted for callers that already use Standard-Default keys. */
  key?: string;
};

export type AdminProductVariantCommercial = {
  variantKey: string;
  sku: string;
  usdPrice: number | null;
  wholesaleCostMvr: number | null;
  supplierCostMvr: number | null;
};

export type AdminProductDetails = {
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  wholesaleCostMvr: number | null;
  supplierCostMvr: number | null;
  variants: AdminProductVariantCommercial[];
};

export type AdminProductCommercialFieldsProps = {
  productName: string;
  productId?: string | null;
  variants?: AdminProductVariantDraft[];
  productFields: AdminProductCommercialFields;
  onProductFieldsChange: (fields: AdminProductCommercialFields) => void;
  details?: Partial<AdminProductDetails>;
  onDetailsChange: (details: AdminProductDetails) => void;
  onSnapshotReadyChange?: (ready: boolean) => void;
  className?: string;
  disabled?: boolean;
};

const emptyDetails: AdminProductDetails = {
  weightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  wholesaleCostMvr: null,
  supplierCostMvr: null,
  variants: [],
};

function numericOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function variantKey(variant: AdminProductVariantDraft): string {
  if (variant.key?.trim()) return variant.key.trim();
  return `${variant.size?.trim() || "Standard"}-${variant.color?.trim() || "Default"}`;
}

function uniqueVariantKeys(variants: AdminProductVariantDraft[]): string[] {
  return Array.from(new Set(variants.map(variantKey).filter(Boolean)));
}

function skuFromName(name: string): string {
  const value = name
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return value || "PRODUCT";
}

function detailsWithDefaults(details?: Partial<AdminProductDetails>): AdminProductDetails {
  return {
    ...emptyDetails,
    ...details,
    variants: details?.variants ? details.variants.map(variant => ({ ...variant })) : [],
  };
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * A persisted edit must be based on a complete server snapshot. In particular,
 * do not turn a partial response into defaults and then PUT those defaults
 * back over metadata belonging to another variant.
 */
function completeDetails(value: unknown): AdminProductDetails {
  if (!value || typeof value !== "object") throw new Error("The server returned an invalid commercial-details snapshot.");
  const record = value as Record<string, unknown>;
  const required = ["weightKg", "lengthCm", "widthCm", "heightCm", "wholesaleCostMvr", "supplierCostMvr", "variants"];
  if (required.some(key => !hasOwn(record, key)) || !Array.isArray(record.variants)) {
    throw new Error("The server returned an incomplete commercial-details snapshot. Nothing was saved.");
  }
  if (record.variants.some(item => {
    if (!item || typeof item !== "object") return true;
    const variant = item as Record<string, unknown>;
    return ["variantKey", "sku", "usdPrice", "wholesaleCostMvr", "supplierCostMvr"].some(key => !hasOwn(variant, key));
  })) {
    throw new Error("The server returned incomplete variant commercial details. Nothing was saved.");
  }
  return detailsWithDefaults(value as Partial<AdminProductDetails>);
}

async function adminJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json().catch(() => null) as { message?: string; details?: T } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && body.message
      ? body.message
      : `The admin product details request failed (${response.status}).`;
    throw new Error(message);
  }
  return body && typeof body === "object" && "details" in body ? (body.details as T) : body as T;
}

/** Fetches server-only commercial metadata. Errors are intentionally thrown to callers. */
export async function getAdminProductDetails(productId: string): Promise<AdminProductDetails> {
  if (!productId.trim()) throw new Error("A product ID is required to load commercial details.");
  return completeDetails(await adminJson<AdminProductDetails>(`/api/admin/product-details/${encodeURIComponent(productId)}`));
}

/** Saves server-only commercial metadata. Errors are intentionally thrown to callers. */
export async function saveAdminProductDetails(productId: string, details: AdminProductDetails): Promise<AdminProductDetails> {
  if (!productId.trim()) throw new Error("A product ID is required to save commercial details.");
  return completeDetails(await adminJson<AdminProductDetails>(
    `/api/admin/product-details/${encodeURIComponent(productId)}`,
    { method: "PUT", body: JSON.stringify(details) },
  ));
}

function NumberField({
  label,
  value,
  onChange,
  min = "0",
  step = "0.01",
  disabled,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={event => onChange(numericOrNull(event.target.value))}
        disabled={disabled}
        className={cn(adminControlClass, "h-10")}
      />
    </div>
  );
}

export default function AdminProductCommercialFields({
  productName,
  productId,
  variants = [],
  productFields,
  onProductFieldsChange,
  details,
  onDetailsChange,
  onSnapshotReadyChange,
  className,
  disabled = false,
}: AdminProductCommercialFieldsProps) {
  const keys = useMemo(() => uniqueVariantKeys(variants), [variants]);
  const [localDetails, setLocalDetails] = useState(() => detailsWithDefaults(details));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [snapshotReady, setSnapshotReady] = useState(!productId);

  useEffect(() => {
    onSnapshotReadyChange?.(snapshotReady);
  }, [snapshotReady, onSnapshotReadyChange]);

  useEffect(() => {
    if (details) setLocalDetails(current => ({ ...current, ...details, variants: details.variants ? details.variants.map(item => ({ ...item })) : current.variants }));
  }, [details]);

  useEffect(() => {
    let cancelled = false;
    setSnapshotReady(!productId);
    if (!productId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getAdminProductDetails(productId)
      .then(next => {
        if (!cancelled) {
          setLocalDetails(next);
          onDetailsChange(next);
          setSnapshotReady(true);
        }
      })
      .catch(reason => {
        if (!cancelled) {
          setSnapshotReady(false);
          setError(reason instanceof Error ? reason.message : "Commercial details could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]); // Loading is tied to the saved product, not each controlled keystroke.

  const updateDetails = (patch: Partial<AdminProductDetails>) => {
    const next = detailsWithDefaults({ ...localDetails, ...patch });
    setLocalDetails(next);
    onDetailsChange(next);
  };

  const updateVariant = (key: string, patch: Partial<AdminProductVariantCommercial>) => {
    const current = localDetails.variants.find(item => item.variantKey === key);
    const nextVariant: AdminProductVariantCommercial = {
      variantKey: key,
      sku: "",
      usdPrice: null,
      wholesaleCostMvr: null,
      supplierCostMvr: null,
      ...current,
      ...patch,
    };
    updateDetails({ variants: [...localDetails.variants.filter(item => item.variantKey !== key), nextVariant] });
  };

  const generateSku = () => onProductFieldsChange({ ...productFields, sku: skuFromName(productName) });
  const detailsDisabled = disabled || Boolean(productId && !snapshotReady);

  const saveDetails = async () => {
    if (!productId) {
      setError("Save the product first; commercial details need its product ID.");
      return;
    }
    if (!snapshotReady) {
      setError("Commercial details are not ready to save. Reload the complete server snapshot first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveAdminProductDetails(productId, localDetails);
      setLocalDetails(saved);
      onDetailsChange(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Commercial details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cn("space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_25px_rgba(18,51,74,.05)]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-[#167b73]">
            <Sparkles size={12} /> Commercial controls
          </p>
          <h3 className="font-serif text-xl tracking-tight text-[#12334a]">Cost, stock & shipping</h3>
          <p className="mt-1 text-xs text-slate-500">Admin-only fields. Storefront pricing remains MVR and unchanged.</p>
        </div>
        {productId && (
          <Button type="button" onClick={saveDetails} disabled={disabled || saving || loading || !snapshotReady} className={adminButtonClass("primary")}>
            <Save size={14} /> {saving ? "Saving…" : "Save details"}
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#ebc4be] bg-[#fff7f5] p-3 text-xs text-[#a44539]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {loading && <p className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw size={13} className="animate-spin" /> Loading saved commercial details…</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Product SKU</Label>
          <div className="flex gap-2">
            <Input value={productFields.sku} onChange={event => onProductFieldsChange({ ...productFields, sku: event.target.value })} disabled={disabled} className={cn(adminControlClass, "h-10")} placeholder="IH-PRODUCT" />
            <Button type="button" variant="outline" onClick={generateSku} disabled={disabled || !productName.trim()} className="h-10 shrink-0 px-3" aria-label="Generate SKU"><Sparkles size={14} /></Button>
          </div>
        </div>
        <NumberField label="Cost price (MVR)" value={productFields.costPrice} onChange={costPrice => onProductFieldsChange({ ...productFields, costPrice })} disabled={disabled} />
        <NumberField label="Low-stock alert" value={productFields.lowStockThreshold} onChange={lowStockThreshold => onProductFieldsChange({ ...productFields, lowStockThreshold: lowStockThreshold ?? 0 })} disabled={disabled} step="1" />
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div><h4 className="text-sm font-semibold text-[#12334a]">Shipping dimensions</h4><p className="text-xs text-slate-500">Used by admin shipping and landed-cost workflows; these values are not sent to the storefront.</p></div>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField label="Weight (kg)" value={localDetails.weightKg} onChange={weightKg => updateDetails({ weightKg })} disabled={detailsDisabled} />
          <NumberField label="Length (cm)" value={localDetails.lengthCm} onChange={lengthCm => updateDetails({ lengthCm })} disabled={detailsDisabled} />
          <NumberField label="Width (cm)" value={localDetails.widthCm} onChange={widthCm => updateDetails({ widthCm })} disabled={detailsDisabled} />
          <NumberField label="Height (cm)" value={localDetails.heightCm} onChange={heightCm => updateDetails({ heightCm })} disabled={detailsDisabled} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Wholesale cost (MVR)" value={localDetails.wholesaleCostMvr} onChange={wholesaleCostMvr => updateDetails({ wholesaleCostMvr })} disabled={detailsDisabled} />
          <NumberField label="Supplier cost (MVR)" value={localDetails.supplierCostMvr} onChange={supplierCostMvr => updateDetails({ supplierCostMvr })} disabled={detailsDisabled} />
        </div>
      </div>

      {keys.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div><h4 className="text-sm font-semibold text-[#12334a]">Variant commercial metadata</h4><p className="text-xs text-slate-500">USD prices are for POS use only. Website variants continue using the existing MVR price fields.</p></div>
          <div className="space-y-3">
            {keys.map(key => {
              const item = localDetails.variants.find(variant => variant.variantKey === key);
              return (
                <div key={key} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4">
                  <div className="flex items-center text-xs font-semibold text-[#12334a]">{key}</div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase tracking-[.1em] text-slate-500">Variant SKU</Label><Input value={item?.sku || ""} onChange={event => updateVariant(key, { sku: event.target.value })} disabled={detailsDisabled} className={cn(adminControlClass, "h-9")} /></div>
                  <NumberField label="POS price (USD)" value={item?.usdPrice} onChange={usdPrice => updateVariant(key, { usdPrice })} disabled={detailsDisabled} />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Wholesale MVR" value={item?.wholesaleCostMvr} onChange={wholesaleCostMvr => updateVariant(key, { wholesaleCostMvr })} disabled={detailsDisabled} />
                    <NumberField label="Supplier MVR" value={item?.supplierCostMvr} onChange={supplierCostMvr => updateVariant(key, { supplierCostMvr })} disabled={detailsDisabled} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}