export interface ProductVariant {
  size: string;
  price: number;
}

export interface SizeGuideEntry {
  measurement: string;
  sizes: { [key: string]: string };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  images?: string[] | null;
  description?: string | null;
  rating?: number | null;
  reviews?: number | null;
  isNew?: boolean | null;
  isBestSeller?: boolean | null;
  colors?: string[] | null;
  variants?: ProductVariant[] | null;
  stock?: number | null;
  variantStock?: { [key: string]: number } | null;
  expressCharge?: number | null;
  sizeGuide?: SizeGuideEntry[] | null;
}

export function getVariantStockKey(size?: string, color?: string): string {
  return `${size || 'Standard'}-${color || 'Default'}`;
}

export function getVariantStock(product: Product, size?: string, color?: string): number {
  const key = getVariantStockKey(size, color);
  if (product.variantStock && product.variantStock[key] !== undefined) {
    return product.variantStock[key];
  }
  return product.stock || 0;
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MV', {
    style: 'currency',
    currency: 'MVR',
    minimumFractionDigits: 0,
  }).format(amount);
};
