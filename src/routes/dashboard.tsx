import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { formatNaira } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface Order {
  id: string;
  status: string;
  total_kobo: number;
  discount_kobo: number;
  created_at: string;
  items: Array<{ product_name: string; color: string; size: string; qty: number }>;
  paystack_reference: string | null;
}

interface ReferralCode {
  id: string;
  code: string;
  discount_percent: number;
  uses_count: number;
  active: boolean;
}

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth", search: { redirect: "/dashboard" } }); return; }

    Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("referral_codes").select("*"),
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    ]).then(([o, c, p]) => {
      setOrders((o.data ?? []) as Order[]);
      setCodes((c.data ?? []) as ReferralCode[]);
      setProfile(p.data);
      setLoading(false);
    });
  }, [user, authLoading, navigate]);

  if (authLoading || loading) return <div className="min-h-screen"><SiteHeader /><div className="pt-40 text-center text-sm text-muted-foreground">Loading…</div></div>;

  const myCode = codes[0];

  return (
    <div>
      <SiteHeader />
      <div className="pt-28 pb-16 px-6 lg:px-12 max-w-[1400px] mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Member</div>
        <h1 className="text-5xl md:text-6xl font-display mb-2">{profile?.full_name || "Welcome"}</h1>
        <p className="text-sm text-muted-foreground mb-12">{user?.email}</p>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {myCode && (
            <div className="border border-[var(--gold)] p-8 lg:col-span-1">
              <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-3">Your Referral Code</div>
              <div className="font-mono text-3xl mb-4 break-all">{myCode.code}</div>
              <div className="text-xs text-muted-foreground mb-4">{myCode.discount_percent}% off · used {myCode.uses_count} times</div>
              <button
                onClick={() => { navigator.clipboard.writeText(myCode.code); toast.success("Copied"); }}
                className="border border-foreground px-4 py-2 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition"
              >
                Copy Code
              </button>
            </div>
          )}
        </div>

        <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-6 pb-3 border-b border-border">Order History</div>
        {orders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground mb-6">No orders yet.</p>
            <Link to="/shop" className="border border-foreground px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">Shop →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="border border-border p-6 grid md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Order</div>
                  <div className="font-mono text-sm mt-1">{o.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Items</div>
                  {o.items.map((it, i) => (
                    <div key={i} className="text-sm mt-1">{it.product_name} · {it.color} · {it.size} × {it.qty}</div>
                  ))}
                </div>
                <div className="text-right">
                  <div className={`text-[10px] tracking-[0.3em] uppercase mb-2 ${o.status === "paid" ? "text-[var(--gold)]" : o.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{o.status}</div>
                  <div className="font-mono text-lg">{formatNaira(o.total_kobo)}</div>
                  {o.discount_kobo > 0 && <div className="text-[10px] text-muted-foreground">saved {formatNaira(o.discount_kobo)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
