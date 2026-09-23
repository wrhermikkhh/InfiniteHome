import { useEffect, useMemo } from "react";
import { Banknote, CreditCard, DollarSign, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { adminButtonClass, adminControlClass } from "./admin-ui";

export type PosTaxType = "NONE" | "GST" | "TGST";
export type PosTenderMethod = "cash" | "bml_transfer" | "card" | "usd_cash";
export type PosTenderCurrency = "MVR" | "USD";

export interface PosPaymentLine {
  id: string;
  method: PosTenderMethod;
  currency: PosTenderCurrency;
  amount: string;
  /** Required only for USD cash; entered manually by the operator. */
  usdToMvrRate?: string;
  reference?: string;
}

export interface PosAccountingSettings {
  /** Tax is deliberately false when no settings have been loaded. */
  taxEnabled?: boolean;
  gstRate?: number;
  tgstRate?: number;
  usdToMvrRate?: number | null;
}

export interface PosPaymentsProps {
  /** Customer amount before this component's optional GST/TGST calculation. */
  currentTotalMvr: number;
  taxType: PosTaxType;
  onTaxTypeChange: (value: PosTaxType) => void;
  taxEnabled?: boolean;
  gstRate?: number;
  tgstRate?: number;
  /** Optional settings may be supplied by a POS-safe parent route. No settings fetch is performed here. */
  initialSettings?: PosAccountingSettings;
  splitLines: PosPaymentLine[];
  onSplitLinesChange: (lines: PosPaymentLine[]) => void;
  processingFeeMvr: string;
  onProcessingFeeMvrChange: (value: string) => void;
  onUsdTenderAmountChange?: (value: string) => void;
  onUsdToMvrRateChange?: (value: string) => void;
  className?: string;
}

/**
 * Controlled POS tender editor.
 *
 * The parent can send the following additional fields with its existing
 * POST /api/pos/transactions payload:
 *
 * {
 *   taxType: "NONE" | "GST" | "TGST",
 *   paymentTenders: [{ method, currency, amount, usdToMvrRate?, reference? }],
 *   feeMvr: number
 * }
 *
 * `amount` is entered in the line's currency. USD lines must include a
 * manually entered `usdToMvrRate`; this component never calls an exchange-rate
 * service. `paymentTenders` must settle the server-calculated MVR total. The
 * processing fee is an operational expense and is not added to that total.
 */
export function PosPayments({
  currentTotalMvr,
  taxType,
  onTaxTypeChange,
  taxEnabled,
  gstRate = 0,
  tgstRate = 0,
  initialSettings,
  splitLines,
  onSplitLinesChange,
  processingFeeMvr,
  onProcessingFeeMvrChange,
  onUsdTenderAmountChange,
  onUsdToMvrRateChange,
  className = "",
}: PosPaymentsProps) {
  const enabled = taxEnabled ?? initialSettings?.taxEnabled ?? false;
  const effectiveUsdRate = initialSettings?.usdToMvrRate ?? 15.42;
  const effectiveGst = gstRate || initialSettings?.gstRate || 0;
  const effectiveTgst = tgstRate || initialSettings?.tgstRate || 0;
  const rate = taxType === "GST" ? effectiveGst : taxType === "TGST" ? effectiveTgst : 0;
  const taxableMvr = Math.max(0, Number.isFinite(currentTotalMvr) ? currentTotalMvr : 0);
  const taxMvr = enabled ? Math.round(taxableMvr * rate) / 100 : 0;
  const amountDueMvr = Math.round((taxableMvr + taxMvr) * 100) / 100;

  useEffect(() => {
    if (!effectiveUsdRate) return;
    const next = splitLines.map(line => line.currency === "USD" && !line.usdToMvrRate
      ? { ...line, usdToMvrRate: String(effectiveUsdRate) } : line);
    if (next.some((line, index) => line.usdToMvrRate !== splitLines[index]?.usdToMvrRate)) onSplitLinesChange(next);
  }, [effectiveUsdRate, splitLines, onSplitLinesChange]);

  const preview = useMemo(() => {
    let settledMvr = 0;
    let invalid = "";
    for (const line of splitLines) {
      const amount = Number(line.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        if (line.amount) invalid = "Enter valid tender amounts.";
        continue;
      }
      if (line.currency === "USD") {
        const usdRate = Number(line.usdToMvrRate);
        if (amount > 0 && (!Number.isFinite(usdRate) || usdRate <= 0)) {
          invalid = "Enter a manual USD-to-MVR rate for USD cash.";
          continue;
        }
        settledMvr += amount * (amount > 0 ? usdRate : 0);
      } else {
        settledMvr += amount;
      }
    }
    const roundedSettled = Math.round(settledMvr * 100) / 100;
    return {
      settledMvr: roundedSettled,
      differenceMvr: Math.round((roundedSettled - amountDueMvr) * 100) / 100,
      changeMvr: Math.max(0, Math.round((roundedSettled - amountDueMvr) * 100) / 100),
      invalid,
    };
  }, [amountDueMvr, splitLines]);

  const addLine = (method: PosTenderMethod, currency: PosTenderCurrency) => {
    onSplitLinesChange([
      ...splitLines,
      { id: `${method}-${Date.now()}-${splitLines.length}`, method, currency, amount: "", usdToMvrRate: currency === "USD" ? String(effectiveUsdRate) : undefined },
    ]);
  };
  const updateLine = (id: string, patch: Partial<PosPaymentLine>) => {
    onSplitLinesChange(splitLines.map(line => line.id === id ? { ...line, ...patch } : line));
    if (patch.amount !== undefined && patch.amount !== "" && splitLines.find(line => line.id === id)?.currency === "USD") onUsdTenderAmountChange?.(patch.amount);
    if (patch.usdToMvrRate !== undefined) onUsdToMvrRateChange?.(patch.usdToMvrRate);
  };

  const money = (value: number) => `MVR ${value.toLocaleString("en-MV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatRate = (value: number) => value.toLocaleString("en-MV", { maximumFractionDigits: 6 });
  const methodLabel: Record<PosTenderMethod, string> = { cash: "MVR Cash", bml_transfer: "BML Transfer", card: "Card", usd_cash: "USD Cash" };
  const methodIcon: Record<PosTenderMethod, typeof Banknote> = { cash: Banknote, bml_transfer: Wallet, card: CreditCard, usd_cash: DollarSign };

  return (
    <Card className={`pos-payment-editor rounded-xl border-slate-200 bg-white shadow-none ${className}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-kicker">Settlement</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-[#12334a]"><Receipt size={17} /> Payment &amp; tax</h3>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Amount due</p>
            <p className="text-xl font-bold text-[#12334a]">{money(amountDueMvr)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label htmlFor="pos-tax-type">Tax mode</Label>
            <select id="pos-tax-type" className={`${adminControlClass} mt-1 w-full`} value={enabled ? taxType : "NONE"} onChange={event => onTaxTypeChange(event.target.value as PosTaxType)} disabled={!enabled}>
              <option value="NONE">No tax</option>
              <option value="GST">GST{effectiveGst ? ` (${effectiveGst}%)` : ""}</option>
              <option value="TGST">TGST{effectiveTgst ? ` (${effectiveTgst}%)` : ""}</option>
            </select>
            {!enabled && <p className="mt-1 text-xs text-slate-500">Tax is disabled in accounting settings.</p>}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Tax</span><span>{money(taxMvr)}</span></div>
            <div className="mt-1 flex justify-between font-semibold text-[#12334a]"><span>Total</span><span>{money(amountDueMvr)}</span></div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Payment lines</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" className={adminButtonClass("quiet")} onClick={() => addLine("cash", "MVR")}><Plus size={13} /> MVR cash</Button>
              <Button type="button" className={adminButtonClass("quiet")} onClick={() => addLine("bml_transfer", "MVR")}><Plus size={13} /> BML</Button>
              <Button type="button" className={adminButtonClass("quiet")} onClick={() => addLine("card", "MVR")}><Plus size={13} /> Card</Button>
              <Button type="button" className={adminButtonClass("quiet")} onClick={() => addLine("usd_cash", "USD")}><Plus size={13} /> USD cash</Button>
            </div>
          </div>
          {splitLines.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">Add one or more payment methods.</p>}
          {splitLines.map(line => {
            const Icon = methodIcon[line.method];
            return (
              <div key={line.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
                <div><Label htmlFor={`pos-method-${line.id}`}>Method</Label><div id={`pos-method-${line.id}`} className="mt-1 flex h-10 items-center gap-2 px-2 text-sm font-semibold text-[#12334a]"><Icon size={15} />{methodLabel[line.method]}</div></div>
                <div><Label htmlFor={`pos-amount-${line.id}`}>{line.currency} amount</Label><Input id={`pos-amount-${line.id}`} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1" value={line.amount} onChange={event => updateLine(line.id, { amount: event.target.value })} /></div>
                  {line.currency === "USD" ? <div><Label htmlFor={`pos-rate-${line.id}`}>Sale rate (MVR/USD)</Label><Input id={`pos-rate-${line.id}`} type="number" readOnly aria-readonly="true" className="mt-1 bg-slate-100" value={formatRate(Number(line.usdToMvrRate || effectiveUsdRate))} /></div> : <div className="hidden sm:block" />}
                <Button type="button" variant="ghost" aria-label={`Remove ${methodLabel[line.method]} payment line`} className="h-10 text-[#a44539] hover:bg-red-50" onClick={() => onSplitLinesChange(splitLines.filter(item => item.id !== line.id))}><Trash2 size={16} /></Button>
                  {line.currency === "USD" && Number(line.amount) > 0 && Number(line.usdToMvrRate) > 0 && <p className="text-xs text-slate-500 sm:col-span-4">USD {Number(line.amount).toFixed(2)} ≈ {money(Number(line.amount) * Number(line.usdToMvrRate))} at {formatRate(Number(line.usdToMvrRate))} MVR/USD. FX settlement is separate.</p>}
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
          <div><Label htmlFor="pos-processing-fee">Processing fee (MVR)</Label><Input id="pos-processing-fee" type="number" min="0" step="0.01" inputMode="decimal" className="mt-1" value={processingFeeMvr} onChange={event => onProcessingFeeMvrChange(event.target.value)} /><p className="mt-1 text-xs text-slate-500">Tracked as an operating expense; not added to the customer total.</p></div>
           <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Settled (MVR equivalent)</span><span>{money(preview.settledMvr)}</span></div>
              <div className="mt-1 flex justify-between text-slate-500"><span>MVR price → USD quote</span><span>USD {(amountDueMvr / effectiveUsdRate).toFixed(2)} @ {formatRate(effectiveUsdRate)} MVR/USD</span></div>
            <div className="mt-1 flex justify-between font-semibold text-[#12334a]"><span>{preview.differenceMvr >= 0 ? "Change" : "Remaining"}</span><span>{money(preview.differenceMvr >= 0 ? preview.changeMvr : Math.abs(preview.differenceMvr))}</span></div>
          </div>
        </div>
        {(preview.invalid || (preview.differenceMvr < 0 && splitLines.length > 0)) && <p role="alert" className="rounded-lg border border-[#ebc4be] bg-[#fff0ee] px-3 py-2 text-xs text-[#a44539]">{preview.invalid || "Payment lines do not cover the amount due."}</p>}
      </CardContent>
    </Card>
  );
}

export default PosPayments;