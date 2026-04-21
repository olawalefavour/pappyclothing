import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAPPY Clothing — Born Above | Limited Edition Hoodie" },
      { name: "description", content: "The debut limited-edition hoodie from PAPPY Clothing. 200 units worldwide. Pre-order now." },
      { property: "og:title", content: "PAPPY Clothing — Born Above" },
      { property: "og:description", content: "The debut hoodie. Limited to 200 units." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll(".fade-up");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <SiteHeader />

      {/* HERO */}
      <section className="min-h-screen flex flex-col justify-center pt-24 pb-16 px-6 lg:px-12 relative">
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-8">Chapter 01 — The Debut</div>
          <h1 className="text-[18vw] md:text-[14vw] leading-[0.85] font-display">
            Born<br /><span className="italic font-light">Above</span>
          </h1>
          <div className="mt-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              The inaugural drop. A single hoodie. 200 units worldwide. Heavyweight 500gsm fleece, oversized architecture, embroidered crest. For those who arrived already ascended.
            </p>
            <Link to="/shop" className="inline-flex items-center gap-3 border border-foreground px-8 py-4 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition self-start md:self-end">
              Pre-order →
            </Link>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee border-y border-border py-6 bg-background">
        <div className="marquee__track text-[var(--gold)] font-display text-3xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="px-12">BORN ABOVE · LIMITED TO 200 · BORN ABOVE · LIMITED TO 200 ·&nbsp;</span>
          ))}
        </div>
      </div>

      {/* MANIFESTO */}
      <section className="py-32 px-6 lg:px-12 fade-up">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-12 gap-8">
          <div className="md:col-span-3 text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Manifesto</div>
          <div className="md:col-span-9">
            <p className="font-display text-3xl md:text-5xl leading-tight">
              We do not chase trends. We do not over-produce. Each piece is numbered, finite, and built to outlast the noise.
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      <section className="py-24 px-6 lg:px-12 fade-up bg-[oklch(0.04_0_0)]">
        <div className="max-w-[1600px] mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="aspect-[4/5] bg-[oklch(0.1_0_0)] flex items-center justify-center overflow-hidden">
            <img src="/site/assets/pappy-hoodie.png" alt="BORN ABOVE Hoodie" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-6">Edition 01 / 200</div>
            <h2 className="text-6xl font-display mb-6">The Hoodie</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              500gsm brushed fleece. Oversized cut. Embroidered crest at chest. Numbered satin tag. Three colorways: Heather Charcoal, Oxblood Burgundy, Emerald.
            </p>
            <div className="flex items-center gap-8 mb-10">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Price</div>
                <div className="font-mono text-2xl mt-1">₦45,000</div>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Edition</div>
                <div className="font-mono text-2xl mt-1">200</div>
              </div>
            </div>
            <Link to="/shop" className="inline-flex items-center gap-3 border border-foreground px-8 py-4 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">
              Configure & Pre-order →
            </Link>
          </div>
        </div>
      </section>

      {/* SPECS */}
      <section className="py-32 px-6 lg:px-12 fade-up">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-12">Specifications</div>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {[
              { k: "Weight", v: "500 gsm" },
              { k: "Composition", v: "100% Cotton Fleece" },
              { k: "Cut", v: "Oversized" },
              { k: "Crest", v: "Hand-embroidered" },
              { k: "Tag", v: "Numbered satin" },
              { k: "Origin", v: "Made in Lagos" },
            ].map((s) => (
              <div key={s.k} className="bg-background p-8">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{s.k}</div>
                <div className="font-display text-2xl mt-2">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
