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
  colorImages?: { [color: string]: string } | null;
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
  showOnStorefront?: boolean | null;
  lowStockThreshold?: number | null;
  sku?: string | null;
  barcode?: string | null;
  costPrice?: number | null;
  maxOrderQty?: number | null;
  productDetails?: string | null;
  materialsAndCare?: string | null;
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
  const variantStock = product.variantStock as { [key: string]: number } | null;
  
  if (!variantStock || Object.keys(variantStock).length === 0) {
    return 0;
  }
  
  const sizeKey = size || 'Standard';
  const colorKey = color || 'Default';
  const exactKey = `${sizeKey}-${colorKey}`;
  
  if (variantStock[exactKey] !== undefined) {
    return variantStock[exactKey];
  }
  
  const lowerKey = exactKey.toLowerCase();
  const matchingKey = Object.keys(variantStock).find(k => k.toLowerCase() === lowerKey);
  if (matchingKey) {
    return variantStock[matchingKey];
  }
  
  return 0;
}

export function getTotalVariantStock(product: Product): number {
  const variantStock = product.variantStock as { [key: string]: number } | null;
  if (!variantStock || typeof variantStock !== 'object') return 0;
  return Object.values(variantStock).reduce((sum, qty) => sum + (qty || 0), 0);
}

export const formatCurrency = (amount: number) => {
  return `MVR ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};
