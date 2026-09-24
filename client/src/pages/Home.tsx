import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ui/product-card";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";
import beddingImage from "@assets/generated_images/stack_of_folded_premium_white_bedding.png";
import furnitureImage from "@assets/generated_images/minimalist_luxury_furniture_in_bright_room.png";
import appliancesImage from "@assets/generated_images/elegant_high-end_kitchen_appliances_in_modern_home.png";

const categories = [
  { name: "Bedding", image: beddingImage, href: "/shop?category=Bedding" },
  { name: "Furniture", image: furnitureImage, href: "/shop?category=Furniture" },
  { name: "Appliances", image: appliancesImage, href: "/shop?category=Appliances" },
];

export default function Home() {
  const { products, loading } = useProducts();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f0e8] text-[#293329]">
      <Navbar />

      <main>
        <section className="relative min-h-[620px] h-[92vh] overflow-hidden bg-[#465247]">
          <img
            src={heroImage}
            alt="Luxury Bedroom"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#172119]/30" />
          <div className="relative mx-auto flex h-full max-w-[1440px] flex-col justify-end px-5 pb-14 text-[#f6f3eb] sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl"
            >
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#ece8dc]">
                The World&apos;s Softest Bedding
              </p>
              <h1 className="max-w-2xl font-serif text-[clamp(4rem,10vw,9.3rem)] font-light leading-[0.82] tracking-[-0.045em]">
                Sleep like<br /><em>never before.</em>
              </h1>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/shop">
                  <Button
                    size="lg"
                    className="h-auto rounded-none bg-[#f4f0e8] px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#293329] hover:bg-white"
                    data-testid="button-shop-now"
                  >
                    Shop Now <ArrowRight className="ml-3 inline" size={14} />
                  </Button>
                </Link>
                <Link href="/bamboo-bedding">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-auto rounded-none border-[#f4f0e8]/80 px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f4f0e8] hover:bg-[#f4f0e8]/10"
                    data-testid="button-explore"
                  >
                    Explore
                  </Button>
                </Link>
              </div>
            </motion.div>
            <p className="absolute bottom-8 right-5 hidden max-w-[150px] text-right text-xs leading-5 text-white/75 sm:block lg:right-12">
              A quieter approach<br />to the everyday.
            </p>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-12 flex flex-col justify-between gap-4 md:mb-16 md:flex-row md:items-end">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#687263]">
                  The collection
                </p>
                <h2 className="font-serif text-5xl font-light leading-none sm:text-6xl">Shop by category</h2>
              </div>
              <p className="max-w-xs text-sm leading-6 text-[#687263]">
                Discover our curated collection of premium home essentials tailored for your lifestyle.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5 lg:gap-8">
              {categories.map((category, index) => (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: index * 0.1 }}
                  className={index === 1 ? "sm:mt-16" : undefined}
                >
                  <Link href={category.href}>
                    <div className="group cursor-pointer">
                      <div className="relative aspect-[0.82] overflow-hidden bg-[#dedbd1]">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 bg-[#293329]/0 transition-colors duration-500 group-hover:bg-[#293329]/15" />
                      </div>
                      <div className="flex items-center justify-between border-b border-[#c9c6bb] py-4">
                        <h3 className="font-serif text-3xl font-medium">{category.name}</h3>
                        <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#e4e0d5] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-12 flex items-end justify-between">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#687263]">
                  A considered edit
                </p>
                <h2 className="font-serif text-5xl font-light leading-none sm:text-6xl">Best sellers</h2>
                <p className="mt-4 text-sm text-[#687263]">Our most loved products.</p>
              </div>
              <Link href="/shop" className="hidden sm:flex">
                <Button variant="link" className="h-auto p-0 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#293329] hover:no-underline">
                  View All <ArrowRight size={15} className="ml-2" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse bg-[#d2cec2]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4 lg:gap-8">
                {products.slice(0, 4).map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: index * 0.1 }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            )}
            <Link href="/shop" className="mt-10 flex items-center text-[10px] font-semibold uppercase tracking-[0.17em] sm:hidden">
              View All <ArrowRight size={15} className="ml-2" />
            </Link>
          </div>
        </section>

        <section className="bg-[#293329] px-5 py-16 text-center text-[#f4f0e8] sm:py-20">
          <p className="mb-5 text-[10px] uppercase tracking-[0.25em] text-[#aeb5a5]">Infinite Home</p>
          <h2 className="mx-auto max-w-3xl font-serif text-4xl font-light leading-tight sm:text-6xl">
            Make room for the way<br /><em>you want to live.</em>
          </h2>
        </section>
      </main>

      <Footer />
    </div>
  );
}