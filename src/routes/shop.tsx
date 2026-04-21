import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatNaira } from "@/lib/cart";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { toast } from "sonner";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
});

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  colors: string[];
  sizes: string[];
  images: string[];
}

function ShopPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).limit(1).single().then(({ data }) => {
      if (data) {
        setProduct(data as Product);
        setColor(data.colors[0] ?? "");
        setSize(data.sizes[0] ?? "");
      }
    });
  }, []);

  if (!product) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="pt-40 px-6 text-center text-sm text-muted-foreground tracking-wider">Loading…</div>
      </div>
    );
  }

  const handleAdd = (goCheckout: boolean) => {
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
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 py-12">
          <div className="aspect-[4/5] bg-[oklch(0.1_0_0)] overflow-hidden">
            <img src={product.images[0] ?? "/assets/pappy-hoodie.png"} alt={product.name} className="w-full h-full object-cover" />
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
      </div>
      <SiteFooter />
    </div>
  );
}
