import { getDisplayPrice, getProductVariants, type Product } from "./products";

export type QuotationLine = { description: string; quantity: number; unitPrice: number };

export function quoteLineFromProduct(product: Product, size: string, color: string): QuotationLine | null {
  const variant = getProductVariants(product).find(item => item.size === size);
  if (!variant) return null;

  // A quotation offers the full pre-order price, never the checkout deposit.
  const price = product.isPreOrder
    ? product.preOrderPrice
    : getDisplayPrice(product, variant.price);
  if (price == null || !Number.isFinite(price) || price < 0 || price > 10000000) return null;

  const options = [size !== "Standard" ? size : "", color !== "Default" ? color : ""].filter(Boolean);
  const description = `${product.name}${options.length ? ` (${options.join(" / ")})` : ""}`;
  if (description.length > 200) return null;
  return { description, quantity: 1, unitPrice: Math.round(price * 100) / 100 };
}