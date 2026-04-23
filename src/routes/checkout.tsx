import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCart, formatNaira } from "@/lib/cart";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { createPendingOrder, validateReferralCode } from "@/lib/paystack.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

const WHATSAPP_PHONE = "2349064677372";

async function openWhatsappWithFallback(message: string) {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodedMessage}&type=phone_number&app_absent=0`;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      toast.success("Order details copied — opening WhatsApp");
    }
  } catch {
    toast.message("WhatsApp opened without auto-fill — copy the order details if needed");
  }

  window.location.assign(whatsappUrl);
}

function CheckoutPage() {
  const { items, subtotalKobo, remove, updateQty, count, clear } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [referralInput, setReferralInput] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [validatingRef, setValidatingRef] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "Nigeria",
  });

  const discountKobo = Math.floor((subtotalKobo * discountPct) / 100);
  const totalKobo = subtotalKobo - discountKobo;

  const checkReferral = async () => {
    if (!referralInput.trim()) return;
    setValidatingRef(true);
    try {
      const res = await validateReferralCode({ data: { code: referralInput.trim() } });
      if (res.valid) {
        setDiscountPct(res.discount_percent);
        toast.success(`${res.discount_percent}% discount applied`);
      } else {
        setDiscountPct(0);
        toast.error("Invalid or expired code");
      }
    } catch {
      toast.error("Failed to validate code");
    } finally {
      setValidatingRef(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/checkout" } });
      return;
    }
    if (items.length === 0) { toast.error("Cart is empty"); return; }
    for (const k of Object.keys(form) as (keyof typeof form)[]) {
      if (!form[k].trim()) { toast.error(`Fill in ${k.replace("_", " ")}`); return; }
    }
    setSubmitting(true);
    try {
      const res = await createPendingOrder({
        data: {
          items: items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            color: i.color,
            size: i.size,
            qty: i.qty,
          })),
          referral_code: referralInput.trim() || null,
          shipping_address: form,
        },
      });

      // Build a friendly WhatsApp message with full order details
      const orderRef = res.order_id.slice(0, 8).toUpperCase();
      const fmtNgnKobo = (kobo: number) =>
        `${formatNaira(kobo)} (${kobo.toLocaleString("en-NG")} kobo)`;
      const lines = [
        `Hi Pappy Clothings, I'd like to complete payment for my order.`,
        ``,
        `Order Ref: ${orderRef}`,
        ``,
        `— Customer —`,
        `Name: ${form.full_name}`,
        `Phone: ${form.phone}`,
        ``,
        `— Shipping Address —`,
        `${form.address}`,
        `${form.city}, ${form.state}`,
        `${form.country}`,
        ``,
        `— Items —`,
        ...items.map(
          (it) =>
            `• ${it.product_name} — Color: ${it.color}, Size: ${it.size} × ${it.qty} @ ${fmtNgnKobo(it.unit_price_kobo)}`,
        ),
        ``,
        `— Totals —`,
        `Subtotal: ${fmtNgnKobo(res.subtotal_kobo)}`,
        ...(res.discount_kobo > 0 ? [`Discount: -${fmtNgnKobo(res.discount_kobo)}`] : []),
        `Total: ${fmtNgnKobo(res.total_kobo)}`,
      ];
      const message = lines.join("\n");

      toast.success("Order placed — redirecting to WhatsApp");
      clear();
      setTimeout(() => {
        void openWhatsappWithFallback(message);
      }, 400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  return (
    <div>
      <SiteHeader />
      <div className="pt-28 pb-16 px-6 lg:px-12 max-w-[1400px] mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Checkout</div>
        <h1 className="text-5xl md:text-6xl font-display mb-12">Complete Order</h1>

        {count === 0 ? (
          <div className="py-24 text-center">
            <p className="text-muted-foreground mb-6">Your cart is empty.</p>
            <Link to="/shop" className="border border-foreground px-8 py-4 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">Shop →</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Forms */}
            <div className="lg:col-span-2 space-y-12">
              <Section title="Shipping">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
                  <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <div className="sm:col-span-2">
                    <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                  </div>
                  <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                  <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                  <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                </div>
              </Section>

              <Section title="Referral Code">
                <div className="flex gap-2">
                  <input
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    placeholder="PPY-XXXXXX"
                    className="flex-1 bg-transparent border-b border-border py-3 focus:outline-none focus:border-[var(--gold)] text-sm tracking-wider"
                  />
                  <button onClick={checkReferral} disabled={validatingRef} className="border border-foreground px-6 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition disabled:opacity-50">
                    {validatingRef ? "..." : "Apply"}
                  </button>
                </div>
                {discountPct > 0 && <p className="mt-3 text-xs text-[var(--gold)]">✓ {discountPct}% discount applied</p>}
              </Section>

              <Section title="Payment">
                <div className="border border-border p-6 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    After placing your order, you'll be redirected to WhatsApp to chat with our customer service rep and complete payment securely.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your order will be marked <span className="text-[var(--gold)]">pending</span> until payment is confirmed.
                  </p>
                </div>
              </Section>
            </div>

            {/* Summary */}
            <div className="border border-border p-8 h-fit space-y-6">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Order Summary</div>
              <div className="space-y-4">
                {items.map((it, i) => (
                  <div key={i} className="border-b border-border pb-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-sm">{it.product_name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{it.color} · {it.size}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQty(i, it.qty - 1)} className="w-6 h-6 border border-border text-xs">−</button>
                          <span className="font-mono text-xs w-6 text-center">{it.qty}</span>
                          <button onClick={() => updateQty(i, it.qty + 1)} className="w-6 h-6 border border-border text-xs">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatNaira(it.unit_price_kobo * it.qty)}</div>
                        <button onClick={() => remove(i)} className="text-[10px] text-muted-foreground hover:text-destructive mt-2 tracking-wider uppercase">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm font-mono">
                <Row label="Subtotal" value={formatNaira(subtotalKobo)} />
                {discountKobo > 0 && <Row label={`Discount (${discountPct}%)`} value={`− ${formatNaira(discountKobo)}`} accent />}
                <div className="border-t border-border pt-3 flex justify-between text-lg">
                  <span>Total</span>
                  <span>{formatNaira(totalKobo)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="w-full bg-[var(--gold)] text-black py-4 text-[11px] tracking-[0.3em] uppercase hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? "Placing order…" : user ? "Place Order & Chat on WhatsApp →" : "Sign in to Continue →"}
              </button>
              <p className="text-[10px] text-muted-foreground tracking-wider text-center">
                Payment arranged via WhatsApp with our rep
              </p>
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-6 pb-3 border-b border-border">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent border-b border-border py-3 focus:outline-none focus:border-[var(--gold)] text-sm" />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-[var(--gold)]" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
