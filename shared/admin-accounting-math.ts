/**
 * Pure, integer-minor-unit accounting helpers for the admin/POS layer.
 *
 * These functions deliberately do not know about products, databases, exchange
 * services, or the storefront. All monetary inputs are non-negative decimal
 * strings (numbers are accepted for route ergonomics) and all money outputs
 * are integer cents/fils in the named currency.
 */

export type MoneyInput = string | number;
export type TaxType = "NONE" | "GST" | "TGST";
export type TenderCurrency = "MVR" | "USD";
export type CostingMethod = "FIFO" | "AVERAGE";

const POW10 = (scale: number) => 10 ** scale;

function decimal(value: MoneyInput, name: string, maxScale: number, allowZero = true): number {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${name} must be finite`);
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
    throw new Error(`${name} must be a non-negative decimal`);
  }
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > maxScale) throw new Error(`${name} has too many decimal places`);
  const result = Number(whole) * POW10(maxScale) + Number((fraction + "0".repeat(maxScale)).slice(0, maxScale) || "0");
  if (!Number.isSafeInteger(result)) throw new Error(`${name} exceeds safe integer range`);
  if (!allowZero && result === 0) throw new Error(`${name} must be greater than zero`);
  return result;
}

function roundedDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error("division denominator must be positive");
  return Math.floor((numerator + denominator / 2) / denominator);
}

function asNumber(value: number, name: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} exceeds safe integer range`);
  return value;
}

/** Parse a non-negative decimal amount into integer cents. */
export function toMinorUnits(value: MoneyInput, name = "amount"): number {
  return asNumber(decimal(value, name, 2), name);
}

export function fromMinorUnits(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("minor units must be a non-negative safe integer");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export interface TenderConversionInput {
  currency: TenderCurrency;
  amount: MoneyInput;
  /** MVR per USD, entered manually by staff; never fetched or inferred. */
  rate?: MoneyInput;
}

export interface TenderConversion {
  currency: TenderCurrency;
  amountMinor: number;
  mvrMinor: number;
  rate: string | null;
}

/** Convert a POS tender to MVR cents using a manually entered rate. */
export function convertTenderToMvr(input: TenderConversionInput): TenderConversion {
  const amount = decimal(input.amount, "tender amount", 2);
  if (input.currency === "MVR") {
    return { currency: "MVR", amountMinor: asNumber(amount, "tender amount"), mvrMinor: asNumber(amount, "MVR amount"), rate: null };
  }
  if (input.currency !== "USD") throw new Error("tender currency must be MVR or USD");
  if (input.rate === undefined) throw new Error("USD tender requires a manual MVR/USD rate");
  const rate = decimal(input.rate, "MVR/USD rate", 6, false);
  // USD cents × (MVR/USD × 1e6), rounded to the nearest MVR cent.
  const mvr = roundedDivide(amount * rate, POW10(6));
  return { currency: "USD", amountMinor: asNumber(amount, "USD amount"), mvrMinor: asNumber(mvr, "MVR amount"), rate: String(input.rate) };
}

export interface PosTaxInput {
  subtotal: MoneyInput;
  discount?: MoneyInput;
  taxEnabled?: boolean;
  taxType?: TaxType;
  taxRate?: MoneyInput;
}

export interface PosTaxResult {
  subtotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxType: TaxType;
  taxRate: string;
}

/** Tax is disabled unless explicitly enabled; tax is calculated after discount. */
export function calculatePosTax(input: PosTaxInput): PosTaxResult {
  const subtotal = decimal(input.subtotal, "subtotal", 2);
  const discount = decimal(input.discount ?? 0, "discount", 2);
  if (discount > subtotal) throw new Error("discount cannot exceed subtotal");
  const type = input.taxType ?? "NONE";
  if (!["NONE", "GST", "TGST"].includes(type)) throw new Error("tax type must be NONE, GST, or TGST");
  const enabled = input.taxEnabled === true;
  const rate = decimal(input.taxRate ?? 0, "tax rate", 4);
  if (rate > 100 * POW10(4)) throw new Error("tax rate cannot exceed 100%");
  if (!enabled || type === "NONE") {
    if (type === "NONE" && rate !== 0) throw new Error("NONE tax type cannot have a tax rate");
    return { subtotalMinor: asNumber(subtotal, "subtotal"), discountMinor: asNumber(discount, "discount"), taxableMinor: asNumber(subtotal - discount, "taxable amount"), taxMinor: 0, totalMinor: asNumber(subtotal - discount, "total"), taxType: type, taxRate: "0" };
  }
  // rate has four decimal places representing percent; divide by 100% and 1e4.
  const tax = roundedDivide((subtotal - discount) * rate, 100 * POW10(4));
  return { subtotalMinor: asNumber(subtotal, "subtotal"), discountMinor: asNumber(discount, "discount"), taxableMinor: asNumber(subtotal - discount, "taxable amount"), taxMinor: asNumber(tax, "tax"), totalMinor: asNumber(subtotal - discount + tax, "total"), taxType: type, taxRate: String(input.taxRate ?? 0) };
}

export interface SplitTenderLine extends TenderConversionInput {
  method: string;
}

export interface SplitTenderResult {
  lines: TenderConversion[];
  totalTenderedMvrMinor: number;
  changeMvrMinor: number;
}

/** Require exact settlement, except a positive overpayment may be MVR cash change. */
export function settleSplitTender(total: MoneyInput, tenders: SplitTenderLine[]): SplitTenderResult {
  const due = decimal(total, "total", 2);
  if (!tenders.length) throw new Error("at least one tender is required");
  const lines = tenders.map(convertTenderToMvr);
  const sum = lines.reduce((value, line) => value + line.mvrMinor, 0);
  const over = sum - due;
  if (over < 0) throw new Error("tenders do not cover total");
  if (over > 0 && !lines.some((line, index) => tenders[index].currency === "MVR" && tenders[index].method.toLowerCase() === "cash")) {
    throw new Error("overpayment is only allowed as MVR cash change");
  }
  return { lines, totalTenderedMvrMinor: asNumber(sum, "tender total"), changeMvrMinor: asNumber(over, "change") };
}

/** Processing fees are operational expenses and never increase customer total. */
export function processingFee(value: MoneyInput, customerTotal: MoneyInput = 0): { feeMinor: number; customerTotalMinor: number; operationalExpenseMinor: number } {
  const fee = decimal(value, "processing fee", 2);
  const total = decimal(customerTotal, "customer total", 2);
  return { feeMinor: asNumber(fee, "processing fee"), customerTotalMinor: asNumber(total, "customer total"), operationalExpenseMinor: asNumber(fee, "processing fee") };
}

/** FX is recognized only when an explicit book and settlement valuation exist. */
export function explicitFxGainLoss(bookMvr: MoneyInput, settlementMvr: MoneyInput): { bookMvrMinor: number; settlementMvrMinor: number; gainLossMvrMinor: number } {
  const book = decimal(bookMvr, "book valuation", 2);
  const settlement = decimal(settlementMvr, "settlement valuation", 2);
  return { bookMvrMinor: asNumber(book, "book valuation"), settlementMvrMinor: asNumber(settlement, "settlement valuation"), gainLossMvrMinor: asNumber(settlement - book, "FX gain/loss") };
}

export interface LandedCostInput {
  quantity: number;
  purchaseUnitCost: MoneyInput;
  landedCosts?: MoneyInput[];
}

export function landedUnitCost(input: LandedCostInput): { quantity: number; totalCostMinor: number; unitCostMinor: number } {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("batch quantity must be a positive integer");
  const purchase = decimal(input.purchaseUnitCost, "purchase unit cost", 2);
  const landed = (input.landedCosts ?? []).map((cost, i) => decimal(cost, `landed cost ${i + 1}`, 2));
  const total = purchase * input.quantity + landed.reduce((a, b) => a + b, 0);
  return { quantity: input.quantity, totalCostMinor: asNumber(total, "batch total cost"), unitCostMinor: asNumber(roundedDivide(total, input.quantity), "landed unit cost") };
}

export interface CostLayer { quantity: number; unitCostMinor: number }
export interface CostConsumption { costMinor: number; remaining: CostLayer[] }

/** Consume inventory layers in FIFO or prospective moving-average order. */
export function consumeCostLayers(layers: CostLayer[], quantity: number, method: CostingMethod = "FIFO"): CostConsumption {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("consumption quantity must be a positive integer");
  if (!["FIFO", "AVERAGE"].includes(method)) throw new Error("costing method must be FIFO or AVERAGE");
  const clean = layers.map((layer, i) => {
    if (!Number.isSafeInteger(layer.quantity) || layer.quantity <= 0 || !Number.isSafeInteger(layer.unitCostMinor) || layer.unitCostMinor < 0) throw new Error(`invalid cost layer ${i + 1}`);
    return { ...layer };
  });
  if (clean.reduce((sum, layer) => sum + layer.quantity, 0) < quantity) throw new Error("insufficient cost-layer quantity");
  if (method === "AVERAGE") {
    const totalQty = clean.reduce((sum, layer) => sum + layer.quantity, 0);
    const average = Math.round(clean.reduce((sum, layer) => sum + layer.quantity * layer.unitCostMinor, 0) / totalQty);
    return { costMinor: average * quantity, remaining: [{ quantity: totalQty - quantity, unitCostMinor: average }] };
  }
  let remainingQty = quantity;
  let cost = 0;
  const remaining: CostLayer[] = [];
  for (const layer of clean) {
    const used = Math.min(remainingQty, layer.quantity);
    cost += used * layer.unitCostMinor;
    remainingQty -= used;
    if (layer.quantity > used) remaining.push({ quantity: layer.quantity - used, unitCostMinor: layer.unitCostMinor });
  }
  return { costMinor: cost, remaining };
}