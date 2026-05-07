import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCart, formatNaira } from "@/lib/cart";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { getCatalogProducts, type CatalogProduct } from "@/lib/products.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/shop")({
  loader: () => getCatalogProducts(),
  component: ShopPage,
});

function ShopPage() {
  const catalog = Route.useLoaderData() as CatalogProduct[];
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const navigate = useNavigate();
  const liveProducts = catalog.filter((item) => item.active);
  const archiveProducts = catalog.filter((item) => item.archived);

  useEffect(() => {
    const firstLive = liveProducts[0] ?? null;
    setProduct(firstLive);
    setColor(firstLive?.colors[0] ?? "");
    setSize(firstLive?.sizes[0] ?? "");
    setQty(1);
  }, [catalog]);

  const handleAdd = (goCheckout: boolean) => {
    if (!product) {
      toast.error("No live product available right now");
      return;
    }
    if (!color || !size) { toast.error("Select color and size"); return; }
    add({
      product_id: product.id,
      product_name: product.name,
      color,
      size,
      qty,
      unit_price_kobo: product.price_kobo,
      image: product.images[0] ?? "",
    });
    toast.success("Added to cart");
    if (goCheckout) navigate({ to: "/checkout" });
  };

  return (
    <div>
      <SiteHeader />
      <div className="pt-24 px-6 lg:px-12 max-w-[1600px] mx-auto">
        {liveProducts.length > 1 && (
          <section className="border-b border-border py-8">
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4">Live Products</div>
            <div className="grid gap-4 md:grid-cols-3">
              {liveProducts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setProduct(item);
                    setColor(item.colors[0] ?? "");
                    setSize(item.sizes[0] ?? "");
                    setQty(1);
                  }}
                  className={`border p-4 text-left transition ${product?.id === item.id ? "border-[var(--gold)]" : "border-border hover:border-foreground"}`}
                >
                  <div className="aspect-[4/5] bg-card overflow-hidden mb-4">
                    <img src={item.images[0] ?? "/assets/pappy-hoodie.png"} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="font-display text-2xl">{item.name}</div>
                  <div className="font-mono text-sm mt-2">{formatNaira(item.price_kobo)}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {product ? (() => {
          const colorIdx = product.colors.indexOf(color);
          const activeImage = product.images[colorIdx] ?? product.images[0] ?? "/assets/pappy-hoodie.png";
          return (
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 py-12">
            <div className="aspect-[4/5] bg-[oklch(0.1_0_0)] overflow-hidden">
              <img src={activeImage} alt={`${product.name} in ${color}`} className="w-full h-full object-cover" />
            </div>

            <div>
              <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Edition 01 / 200</div>
              <h1 className="text-5xl md:text-6xl font-display mb-4">{product.name}</h1>
              <div className="font-mono text-2xl mb-8">{formatNaira(product.price_kobo)}</div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-10">{product.description}</p>

              <div className="mb-8">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Color</div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`px-4 py-2 border text-xs tracking-wider ${color === c ? "border-[var(--gold)] text-[var(--gold)]" : "border-border hover:border-foreground"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Size</div>
                <div className="flex gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`w-14 h-14 border text-sm font-mono ${size === s ? "border-[var(--gold)] text-[var(--gold)]" : "border-border hover:border-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-10">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Quantity</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 border border-border hover:border-foreground">−</button>
                  <span className="font-mono text-lg w-10 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="w-10 h-10 border border-border hover:border-foreground">+</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => handleAdd(false)} className="flex-1 border border-foreground py-4 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">
                  Add to Cart
                </button>
                <button onClick={() => handleAdd(true)} className="flex-1 bg-[var(--gold)] text-black py-4 text-[11px] tracking-[0.3em] uppercase hover:opacity-90 transition">
                  Buy Now →
                </button>
              </div>
            </div>
          </div>
          );
        })() : (
          <section className="py-20 text-center border-b border-border">
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4">Shop</div>
            <h1 className="text-4xl md:text-5xl font-display mb-4">No live products right now</h1>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">You can still browse the archive below while new drops are being prepared.</p>
          </section>
        )}

        <section id="archive" className="border-t border-border py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10">
            <div>
              <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-3">Archive</div>
              <h2 className="text-4xl md:text-5xl font-display">Previous drops</h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              Archived pieces stay visible for story and reference, while only live products can be added to cart.
            </p>
          </div>

          {archiveProducts.length === 0 ? (
            <div className="border border-border p-8 text-sm text-muted-foreground">No archived products yet.</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {archiveProducts.map((item) => (
                <article key={item.id} className="border border-border">
                  <div className="aspect-[4/5] bg-card overflow-hidden">
                    <img src={item.images[0] ?? "/assets/pappy-hoodie.png"} alt={`${item.name} archived product`} className="w-full h-full object-cover opacity-85" />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Archived</div>
                    <h3 className="text-3xl font-display">{item.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description ?? "Limited edition piece from the Pappy Clothings archive."}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                      {item.sizes.map((value) => (
                        <span key={value} className="border border-border px-3 py-2">{value}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
