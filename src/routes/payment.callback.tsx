import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { verifyPayment } from "@/lib/paystack.functions";
import { useCart } from "@/lib/cart";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

type SearchParams = { reference?: string; trxref?: string };

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    reference: typeof s.reference === "string" ? s.reference : undefined,
    trxref: typeof s.trxref === "string" ? s.trxref : undefined,
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const search = useSearch({ from: "/payment/callback" });
  const ref = search.reference || search.trxref;
  const { clear } = useCart();
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) { setStatus("failed"); return; }
    verifyPayment({ data: { reference: ref } })
      .then((res) => {
        if (res.success && res.status === "paid") {
          setStatus("success");
          setOrderId(res.order_id ?? null);
          clear();
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, [ref, clear]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          {status === "verifying" && (
            <>
              <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Processing</div>
              <h1 className="text-5xl font-display mb-4">Verifying payment…</h1>
              <p className="text-sm text-muted-foreground">Please wait. Do not close this window.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Confirmed</div>
              <h1 className="text-5xl font-display mb-4">Order received</h1>
              <p className="text-sm text-muted-foreground mb-2">Your pre-order is locked in. You will receive shipping updates by email.</p>
              {orderId && <p className="text-xs font-mono text-muted-foreground mb-8">Reference: {orderId.slice(0, 8).toUpperCase()}</p>}
              <div className="flex gap-3 justify-center">
                <Link to="/dashboard" className="border border-foreground px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">View Orders</Link>
                <Link to="/" className="border border-border px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:border-foreground transition">Home</Link>
              </div>
            </>
          )}
          {status === "failed" && (
            <>
              <div className="text-[10px] tracking-[0.4em] uppercase text-destructive mb-4">Failed</div>
              <h1 className="text-5xl font-display mb-4">Payment not completed</h1>
              <p className="text-sm text-muted-foreground mb-8">Your card was not charged. Try again from checkout.</p>
              <Link to="/checkout" className="border border-foreground px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">Back to Checkout</Link>
            </>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
