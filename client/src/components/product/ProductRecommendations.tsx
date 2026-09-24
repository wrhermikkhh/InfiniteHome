import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { formatCurrency, getDisplayPrice, getProductVariants, getTotalVariantStock, type Product } from "@/lib/products";

export function ProductRecommendations({ product }: { product: Product }) {
  const { products, loading, error } = useProducts();
  const otherProducts = products.filter((item) =>
    item.id !== product.id && item.name?.trim() && item.image && getTotalVariantStock(item) > 0
  );
  const category = product.category?.trim().toLowerCase();
  const suggestions = [
    ...otherProducts.filter((item) => category && item.category?.trim().toLowerCase() === category),
    ...otherProducts.filter((item) => !category || item.category?.trim().toLowerCase() !== category),
  ].slice(0, 4);

  return (
    <section className="border-t border-[#c9c6bb] bg-[#f4f0e8] px-5 py-16 text-[#293329] sm:px-8 sm:py-20 lg:px-12" aria-labelledby="recommendations-title">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 flex items-end justify-between border-b border-[#c9c6bb] pb-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#687263]">Complete the room</p>
            <h2 id="recommendations-title" className="font-serif text-4xl font-light sm:text-5xl">You may also like</h2>
          </div>
          <span className="hidden text-[10px] uppercase tracking-[0.16em] text-[#7b8175] sm:block">Curated for you</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Loading recommendations">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square animate-pulse bg-[#dedbd1]" />)}
          </div>
        ) : error ? (
          <p className="text-sm text-[#687263]">Recommendations could not be loaded. <Link href="/shop" className="underline">Browse all products</Link></p>
        ) : suggestions.length === 0 ? (
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm underline">Browse all products <ArrowRight size={16} /></Link>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {suggestions.map((item) => {
              const variants = getProductVariants(item);
              const lowestPrice = Math.min(...variants.map((variant) => variant.price));
              const differentPrices = variants.some((variant) => variant.price !== variants[0].price);
              return (
                <Link key={item.id} href={`/product/${item.id}`} className="group block" data-testid={`recommendation-${item.id}`}>
                  <div className="aspect-square overflow-hidden bg-[#efede6]">
                    <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <p className="mt-3 text-sm leading-snug group-hover:underline">{item.name}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {differentPrices ? "From " : ""}{formatCurrency(getDisplayPrice(item, lowestPrice))}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}