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
  salePrice?: number | null;
  isOnSale?: boolean | null;
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
  certifications?: string[] | null;
  isPreOrder?: boolean | null;
  preOrderPrice?: number | null;
  preOrderInitialPayment?: number | null;
  preOrderEta?: string | null;
}

export function getDiscountPercentage(product: Product): number | null {
  if (product.isOnSale && product.salePrice && product.salePrice < product.price) {
    return Math.round(((product.price - product.salePrice) / product.price) * 100);
  }
  return null;
}

export function getDisplayPrice(product: Product): number {
  if (product.isOnSale && product.salePrice) {
    return product.salePrice;
  }
  return product.price;
}

export function getVariantStockKey(size?: string, color?: string): string {
  return `${size || 'Standard'}-${color || 'Default'}`;
}

export function getVariantStock(product: Product, size?: string, color?: string): number {
  const key = getVariantStockKey(size, color);
  
  // If product has variant stock tracking enabled, use variant stock only
  if (product.variantStock && Object.keys(product.variantStock).length > 0) {
    // Return specific variant stock if exists, otherwise 0 (not available)
    return product.variantStock[key] !== undefined ? product.variantStock[key] : 0;
  }
  
  // Fall back to general stock only if no variant tracking
  return product.stock || 0;
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MV', {
    style: 'currency',
    currency: 'MVR',
    minimumFractionDigits: 0,
  }).format(amount);
};
