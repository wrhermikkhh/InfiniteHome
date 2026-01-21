import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Product } from "@/lib/products";
import { Ruler } from "lucide-react";
import { Link } from "wouter";

export default function SizeGuide() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
  });

  const productsWithSizeGuide = products.filter(
    (product: Product) => 
      product.sizeGuide && 
      Array.isArray(product.sizeGuide) && 
      product.sizeGuide.length > 0
  );

  const groupedByCategory = productsWithSizeGuide.reduce((acc: { [key: string]: Product[] }, product: Product) => {
    const category = product.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <Ruler className="mx-auto mb-4 text-primary" size={48} />
          <h1 className="text-4xl font-serif mb-4">Size Guide</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Find your perfect fit with our comprehensive size charts. Measurements are in centimeters (cm) unless otherwise noted.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading size guides...</p>
          </div>
        ) : productsWithSizeGuide.length === 0 ? (
          <div className="text-center py-12 bg-secondary/10 border border-border">
            <p className="text-muted-foreground mb-4">No size guides available yet.</p>
            <Link href="/shop" className="text-primary hover:underline">
              Browse our products
            </Link>
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(groupedByCategory).map(([category, categoryProducts]) => (
              <section key={category}>
                <h2 className="text-2xl font-serif mb-6 pb-2 border-b border-border">{category}</h2>
                <div className="space-y-10">
                  {(categoryProducts as Product[]).map((product) => {
                    const sizeGuide = product.sizeGuide || [];
                    if (sizeGuide.length === 0) return null;

                    const allSizes = new Set<string>();
                    sizeGuide.forEach((entry) => {
                      Object.keys(entry.sizes).forEach((size) => allSizes.add(size));
                    });
                    const sizeColumns = Array.from(allSizes);

                    return (
                      <div key={product.id} className="bg-secondary/5 border border-border p-6">
                        <div className="flex items-center gap-4 mb-6">
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-16 h-16 object-cover bg-secondary/20"
                          />
                          <div>
                            <h3 className="font-serif text-xl">{product.name}</h3>
                            <Link 
                              href={`/product/${product.id}`} 
                              className="text-xs text-primary hover:underline uppercase tracking-widest"
                            >
                              View Product
                            </Link>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-secondary/30">
                                <th className="border border-border p-3 text-left font-medium text-sm">Measurement</th>
                                {sizeColumns.map((size) => (
                                  <th key={size} className="border border-border p-3 text-center font-medium text-sm">
                                    {size}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sizeGuide.map((entry, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "" : "bg-secondary/10"}>
                                  <td className="border border-border p-3 text-sm font-medium">
                                    {entry.measurement}
                                  </td>
                                  {sizeColumns.map((size) => (
                                    <td key={size} className="border border-border p-3 text-center text-sm text-muted-foreground">
                                      {entry.sizes[size] || "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-16 bg-primary/5 p-6 border border-primary/20">
          <h2 className="text-2xl font-serif mb-4">How to Measure</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-medium text-foreground mb-2">For Bedding</h3>
              <ul className="space-y-1">
                <li>• Measure your mattress length, width, and depth</li>
                <li>• Add 10-15cm for sheets to allow for tucking</li>
                <li>• For duvet covers, measure your duvet or comforter</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">For Furniture</h3>
              <ul className="space-y-1">
                <li>• Measure the space where furniture will be placed</li>
                <li>• Allow clearance for doors and walkways</li>
                <li>• Consider ceiling height for tall items</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">
            Need help finding the right size? Contact our team.
          </p>
          <p className="text-sm">
            <strong>Email:</strong> <a href="mailto:support@infinitehome.mv" className="text-primary hover:underline">support@infinitehome.mv</a>
            <span className="mx-3">|</span>
            <strong>Phone:</strong> 7840001
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
