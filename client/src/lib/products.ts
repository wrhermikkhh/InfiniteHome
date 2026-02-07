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
  salePercent?: number | null;
  productDetails?: string | null;
  materialsAndCare?: string | null;
}

export function getDiscountPercentage(product: Product): number | null {
  if (product.isOnSale && product.salePercent) {
    return Math.round(product.salePercent);
  }
  if (product.isOnSale && product.salePrice && product.salePrice < product.price) {
    return Math.round(((product.price - product.salePrice) / product.price) * 100);
  }
  return null;
}

export function getVariantSalePrice(product: Product, variantPrice: number): number {
  if (!product.isOnSale) return variantPrice;
  if (product.salePercent) {
    return Math.round(variantPrice * (1 - product.salePercent / 100) * 100) / 100;
  }
  if (product.salePrice && product.price > 0) {
    const derivedPercent = ((product.price - product.salePrice) / product.price) * 100;
    return Math.round(variantPrice * (1 - derivedPercent / 100) * 100) / 100;
  }
  return variantPrice;
}

export function getProductVariants(product: Product): ProductVariant[] {
  if (product.variants && product.variants.length > 0) return product.variants;
  const variantStock = product.variantStock as { [key: string]: number } | null;
  if (variantStock && Object.keys(variantStock).length > 0) {
    return Array.from(new Set(Object.keys(variantStock).map(k => k.split('-')[0]))).map(size => ({ size, price: product.price }));
  }
  return [{ size: 'Standard', price: product.price }];
}

export function getDisplayPrice(product: Product, variantPrice?: number): number {
  const basePrice = variantPrice ?? product.price;
  if (product.isOnSale) {
    return getVariantSalePrice(product, basePrice);
  }
  return basePrice;
}

export function getVariantStockKey(size?: string, color?: string): string {
  return `${size || 'Standard'}-${color || 'Default'}`;
}

export function getVariantStock(product: Product, size?: string, color?: string): number {
  const variantStock = product.variantStock as { [key: string]: number } | null;
  
  if (!variantStock || Object.keys(variantStock).length === 0) {
    return product.stock || 0;
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
  if (!variantStock || typeof variantStock !== 'object' || Object.keys(variantStock).length === 0) return product.stock || 0;
  return Object.values(variantStock).reduce((sum, qty) => sum + (qty || 0), 0);
}

export const formatCurrency = (amount: number) => {
  return `MVR ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};
