import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";
import beddingImage from "@assets/generated_images/stack_of_folded_premium_white_bedding.png";
import bathImage from "@assets/generated_images/plush_white_towels_in_spa_bathroom.png";
import apparelImage from "@assets/generated_images/woman_in_beige_loungewear_reading.png";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: "Bedding" | "Bath" | "Apparel" | "Accessories";
  image: string;
  description: string;
  rating: number;
  reviews: number;
  isNew?: boolean;
  isBestSeller?: boolean;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Bamboo Sheet Set",
    price: 4500,
    category: "Bedding",
    image: beddingImage,
    description: "The world's softest bamboo sheets, temperature regulating and moisture wicking.",
    rating: 4.9,
    reviews: 5432,
    isBestSeller: true,
  },
  {
    id: "2",
    name: "Premium Waffle Bath Towel",
    price: 1200,
    category: "Bath",
    image: bathImage,
    description: "Ultra-absorbent waffle weave towels that bring the spa experience home.",
    rating: 4.8,
    reviews: 1240,
    isBestSeller: true,
  },
  {
    id: "3",
    name: "Ultra-Soft Lounge Set",
    price: 2800,
    category: "Apparel",
    image: apparelImage,
    description: "Luxurious stretch-knit loungewear perfect for relaxing in style.",
    rating: 5.0,
    reviews: 890,
    isNew: true,
  },
  {
    id: "4",
    name: "Silk Pillowcase",
    price: 950,
    category: "Bedding",
    image: heroImage, // Reusing hero for context, ideally would have specific image
    description: "Protect your hair and skin while you sleep with 100% mulberry silk.",
    rating: 4.7,
    reviews: 320,
  },
  {
    id: "5",
    name: "Bamboo Duvet Cover",
    price: 5200,
    category: "Bedding",
    image: beddingImage,
    description: "Silky soft duvet cover that keeps you cool in summer and warm in winter.",
    rating: 4.9,
    reviews: 2100,
    isBestSeller: true,
  },
  {
    id: "6",
    name: "Ribbed Bath Robe",
    price: 2100,
    category: "Bath",
    image: bathImage,
    description: "The ultimate cozy robe for your morning routine.",
    rating: 4.8,
    reviews: 650,
  }
];

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MV', {
    style: 'currency',
    currency: 'MVR',
    minimumFractionDigits: 0,
  }).format(amount);
};
