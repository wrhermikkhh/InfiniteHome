export interface ProductVariant {
  size: string;
  price: number;
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
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MV', {
    style: 'currency',
    currency: 'MVR',
    minimumFractionDigits: 0,
  }).format(amount);
};
