import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Product } from "@/lib/products";

export function ProductSizeGuideDialog({ product }: { product: Product }) {
  const measurements = (product.sizeGuide || [])
    .map((entry) => ({
      name: entry.measurement,
      sizes: Object.entries(entry.sizes || {}).filter(([, value]) => value?.trim()),
    }))
    .filter((entry) => entry.name?.trim() && entry.sizes.length > 0);

  if (measurements.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 border-b border-[#293329] text-sm text-[#293329] transition-opacity hover:opacity-60"
          data-testid="link-size-guide"
        >
          Size Guide
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-y-auto rounded-none border-0 bg-[#f7f5ef] px-6 py-8 text-[#293329] shadow-2xl sm:px-10"
        data-testid="dialog-product-size-guide"
      >
        <DialogHeader className="pr-8 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#687263]">{product.name}</p>
          <DialogTitle className="font-serif text-4xl font-light">Find your fit</DialogTitle>
          <DialogDescription className="sr-only">Size measurements for {product.name}</DialogDescription>
        </DialogHeader>
        <div className="mt-7 space-y-6 text-sm leading-6">
          {measurements.map((entry, index) => (
            <section key={`${entry.name}-${index}`}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">{entry.name}</h3>
              <ul className="list-disc space-y-1 pl-5 text-[#687263]">
                {entry.sizes.map(([size, value]) => (
                  <li key={size}><span className="font-medium text-[#293329]">{size}</span> · {value}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}