import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { formatNaira } from "@/lib/cart";
import { deleteProduct, updateOrderStatus } from "@/lib/paystack.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tab = "products" | "referrals" | "orders" | "users";

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", search: { redirect: "/admin" } }); return; }
    if (!isAdmin) { toast.error("Admin access required"); navigate({ to: "/" }); }
  }, [user, isAdmin, loading, navigate]);

  if (loading || !isAdmin) return <div className="min-h-screen"><SiteHeader /><div className="pt-40 text-center text-sm text-muted-foreground">Loading…</div></div>;

  return (
    <div>
      <SiteHeader />
      <div className="pt-28 pb-16 px-6 lg:px-12 max-w-[1600px] mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Admin</div>
        <h1 className="text-5xl md:text-6xl font-display mb-12">Control</h1>

        <div className="flex gap-1 mb-12 border-b border-border">
          {(["products", "referrals", "orders", "users"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-[11px] tracking-[0.3em] uppercase border-b-2 transition ${tab === t ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "products" && <ProductsTab />}
        {tab === "referrals" && <ReferralsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "users" && <UsersTab />}
      </div>
      <SiteFooter />
    </div>
  );
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  colors: string[];
  sizes: string[];
  images: string[];
  active: boolean;
  archived: boolean;
}

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = () => supabase.from("products").select("*").order("created_at").then(({ data }) => setProducts((data ?? []) as Product[]));
  useEffect(() => { load(); }, []);

  const removeProduct = async (product: Product) => {
    const confirmed = window.confirm(`Remove ${product.name}? This cannot be undone.`);
    if (!confirmed) return;
    setRemovingId(product.id);
    try {
      await deleteProduct({ data: { product_id: product.id } });
      toast.success("Product removed");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove product");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <button onClick={() => { setEditing(null); setShowForm(true); }} className="mb-6 border border-foreground px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">+ New Product</button>
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="border border-border p-6 grid md:grid-cols-5 gap-4 items-center">
            <div className="md:col-span-2">
              <div className="font-display text-xl">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.colors.join(" · ")}</div>
            </div>
            <div className="font-mono">{formatNaira(p.price_kobo)}</div>
            <div className="space-y-1 text-[10px] tracking-[0.3em] uppercase">
              <div className={p.active ? "text-[var(--gold)]" : "text-muted-foreground"}>{p.active ? "Live" : "Not live"}</div>
              {p.archived && <div className="text-muted-foreground">Archive</div>}
            </div>
            <div className="flex items-center justify-end gap-4">
              <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-[10px] tracking-[0.3em] uppercase hover:text-[var(--gold)]">Edit</button>
              <button onClick={() => void removeProduct(p)} disabled={removingId === p.id} className="text-[10px] tracking-[0.3em] uppercase text-destructive disabled:opacity-40">
                {removingId === p.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {showForm && <ProductForm product={editing} onClose={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceNaira, setPriceNaira] = useState(product ? String(product.price_kobo / 100) : "45000");
  const [colors, setColors] = useState((product?.colors ?? []).join(", "));
  const [sizes, setSizes] = useState((product?.sizes ?? ["S", "M", "L", "XL"]).join(", "));
  const [imageList, setImageList] = useState<string[]>(product?.images ?? []);
  const [active, setActive] = useState(product?.active ?? true);
  const [archived, setArchived] = useState(product?.archived ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
        if (error) { toast.error(error.message); continue; }
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setImageList((prev) => [...prev, ...uploaded]);
      if (uploaded.length) toast.success(`Uploaded ${uploaded.length} image(s)`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      name,
      description,
      price_kobo: Math.round(parseFloat(priceNaira) * 100),
      colors: colors.split(",").map((s) => s.trim()).filter(Boolean),
      sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean),
      images: imageList,
      active,
      archived,
    };
    const res = product
      ? await supabase.from("products").update(payload as never).eq("id", product.id)
      : await supabase.from("products").insert(payload as never);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Saved"); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5">
        <div className="font-display text-3xl">{product ? "Edit Product" : "New Product"}</div>
        <Input label="Name" value={name} onChange={setName} />
        <div>
          <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-transparent border border-border p-3 text-sm focus:outline-none focus:border-[var(--gold)]" />
        </div>
        <Input label="Price (Naira)" value={priceNaira} onChange={setPriceNaira} type="number" />
        <Input label="Colors (comma-separated)" value={colors} onChange={setColors} />
        <Input label="Sizes (comma-separated)" value={sizes} onChange={setSizes} />
        <div>
          <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">Product Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onUpload}
            disabled={uploading}
            className="block w-full text-xs file:mr-4 file:py-2 file:px-4 file:border file:border-border file:bg-transparent file:text-foreground file:text-[10px] file:tracking-[0.3em] file:uppercase hover:file:bg-secondary disabled:opacity-50"
          />
          {uploading && <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-2">Uploading…</div>}
          {imageList.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {imageList.map((url, i) => (
                <div key={`${url}-${i}`} className="relative group border border-border aspect-square overflow-hidden">
                  <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageList((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/80 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--gold)]" />
            Live in shop
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="accent-[var(--gold)]" />
            Show in archive
          </label>
        </div>
        <div className="flex gap-3 pt-4">
          <button onClick={save} disabled={saving} className="flex-1 bg-[var(--gold)] text-black py-3 text-[10px] tracking-[0.3em] uppercase disabled:opacity-50">{saving ? "..." : "Save"}</button>
          <button onClick={onClose} className="flex-1 border border-border py-3 text-[10px] tracking-[0.3em] uppercase">Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface ReferralRow {
  id: string;
  code: string;
  owner_user_id: string;
  discount_percent: number;
  uses_count: number;
  max_uses: number | null;
  active: boolean;
}

function ReferralsTab() {
  const [codes, setCodes] = useState<ReferralRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("referral_codes").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as ReferralRow[];
    setCodes(list);
    const userIds = [...new Set(list.map((c) => c.owner_user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.full_name ?? p.id.slice(0, 8); });
      setEmails(map);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (c: ReferralRow) => {
    await supabase.from("referral_codes").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  return (
    <div>
      <button onClick={() => setShowForm(true)} className="mb-6 border border-foreground px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition">+ Assign Code to Influencer</button>
      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="border border-border p-4 grid md:grid-cols-6 gap-4 items-center text-sm">
            <div className="font-mono md:col-span-2">{c.code}</div>
            <div className="text-xs text-muted-foreground">{emails[c.owner_user_id] ?? c.owner_user_id.slice(0, 8)}</div>
            <div className="font-mono">{c.discount_percent}%</div>
            <div className="text-xs">{c.uses_count}{c.max_uses ? `/${c.max_uses}` : ""} uses</div>
            <button onClick={() => toggleActive(c)} className={`text-[10px] tracking-[0.3em] uppercase text-right ${c.active ? "text-[var(--gold)]" : "text-muted-foreground"}`}>
              {c.active ? "Active" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
      {showForm && <AssignCodeForm onClose={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function AssignCodeForm({ onClose }: { onClose: () => void }) {
  const [searchEmail, setSearchEmail] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [results, setResults] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const search = async () => {
    if (!searchEmail.trim()) return;
    const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${searchEmail}%`).limit(10);
    setResults(data ?? []);
  };

  const save = async () => {
    if (!selected) { toast.error("Select a user"); return; }
    if (!code.trim()) { toast.error("Code required"); return; }
    const { error } = await supabase.from("referral_codes").insert({
      code: code.trim().toUpperCase(),
      owner_user_id: selected.id,
      discount_percent: parseInt(discount, 10),
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Code assigned"); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border p-8 max-w-lg w-full space-y-5">
        <div className="font-display text-3xl">Assign Referral Code</div>
        <div>
          <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">Search User by Name</label>
          <div className="flex gap-2">
            <input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} className="flex-1 bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-[var(--gold)]" />
            <button onClick={search} className="border border-border px-4 text-[10px] tracking-[0.3em] uppercase">Search</button>
          </div>
          {results.length > 0 && (
            <div className="mt-3 border border-border max-h-40 overflow-y-auto">
              {results.map((r) => (
                <button key={r.id} onClick={() => setSelected({ id: r.id, name: r.full_name ?? r.id })} className={`block w-full text-left px-3 py-2 text-sm hover:bg-secondary ${selected?.id === r.id ? "bg-secondary text-[var(--gold)]" : ""}`}>
                  {r.full_name ?? r.id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
          {selected && <div className="mt-2 text-xs text-[var(--gold)]">Selected: {selected.name}</div>}
        </div>
        <Input label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
        <Input label="Discount %" value={discount} onChange={setDiscount} type="number" />
        <Input label="Max Uses (blank = unlimited)" value={maxUses} onChange={setMaxUses} type="number" />
        <div className="flex gap-3 pt-4">
          <button onClick={save} className="flex-1 bg-[var(--gold)] text-black py-3 text-[10px] tracking-[0.3em] uppercase">Assign</button>
          <button onClick={onClose} className="flex-1 border border-border py-3 text-[10px] tracking-[0.3em] uppercase">Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface AdminOrder {
  id: string;
  user_id: string;
  status: string;
  total_kobo: number;
  discount_kobo: number;
  created_at: string;
  updated_at?: string | null;
  paid_at?: string | null;
  receipt_uploaded_at?: string | null;
  receipt_verified_at?: string | null;
  payment_proof_url?: string | null;
  paystack_reference: string | null;
  shipping_address: { full_name: string; phone: string; address: string; city: string; state: string };
  items: Array<{ product_name: string; color: string; size: string; qty: number }>;
}

function parseProof(value: string | null | undefined): { path: string | null; txn: string | null } {
  if (!value) return { path: null, txn: null };
  const idx = value.indexOf("|TXN:");
  if (idx === -1) return { path: value, txn: null };
  return { path: value.slice(0, idx), txn: value.slice(idx + 5) };
}

function fmt(ts: string | null | undefined) {
  if (!ts) return null;
  try { return new Date(ts).toLocaleString("en-NG", { timeZone: "Africa/Lagos" }); } catch { return ts; }
}

function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter as "paid" | "pending" | "failed" | "cancelled");
    q.then(({ data }) => setOrders((data ?? []) as unknown as AdminOrder[]));
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (status: "paid" | "cancelled" | "pending") => {
    if (!open) return;
    setUpdating(true);
    try {
      await updateOrderStatus({ data: { order_id: open.id, status } });
      toast.success(status === "paid" ? "Marked as fulfilled" : status === "cancelled" ? "Order cancelled" : "Marked as pending");
      setOpen({ ...open, status });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "pending", "paid", "cancelled", "failed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-[10px] tracking-[0.3em] uppercase border ${filter === f ? "border-[var(--gold)] text-[var(--gold)]" : "border-border"}`}>{f === "paid" ? "fulfilled" : f}</button>
        ))}
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <button key={o.id} onClick={() => setOpen(o)} className="w-full border border-border p-4 grid md:grid-cols-5 gap-4 items-center text-left hover:border-foreground transition text-sm">
            <div className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</div>
            <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
            <div className="text-xs">{o.shipping_address?.full_name}</div>
            <div className={`text-[10px] tracking-[0.3em] uppercase ${o.status === "paid" ? "text-[var(--gold)]" : o.status === "cancelled" || o.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{o.status === "paid" ? "fulfilled" : o.status}</div>
            <div className="font-mono text-right">{formatNaira(o.total_kobo)}</div>
          </button>
        ))}
        {orders.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">No orders.</div>}
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 overflow-y-auto" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border p-8 max-w-2xl w-full space-y-4 my-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-3xl">Order {open.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(open.created_at).toLocaleString()}</div>
              </div>
              <div className={`text-[10px] tracking-[0.3em] uppercase px-3 py-1 border ${open.status === "paid" ? "text-[var(--gold)] border-[var(--gold)]" : open.status === "cancelled" || open.status === "failed" ? "text-destructive border-destructive" : "text-muted-foreground border-border"}`}>
                {open.status === "paid" ? "Fulfilled" : open.status}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">Items</div>
              {open.items.map((it, i) => <div key={i} className="text-sm">{it.product_name} · {it.color} · {it.size} × {it.qty}</div>)}
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">Shipping</div>
              <div className="text-sm">{open.shipping_address.full_name} · {open.shipping_address.phone}</div>
              <div className="text-sm text-muted-foreground">{open.shipping_address.address}, {open.shipping_address.city}, {open.shipping_address.state}</div>
            </div>
            <div className="border-t border-border pt-4 grid grid-cols-3 gap-4 text-sm font-mono">
              <div><div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Discount</div>{formatNaira(open.discount_kobo)}</div>
              <div><div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Total</div>{formatNaira(open.total_kobo)}</div>
              <div><div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Ref</div><div className="text-xs break-all">{open.paystack_reference ?? "—"}</div></div>
            </div>

            {/* Order timeline */}
            {(() => {
              const { path, txn } = parseProof(open.payment_proof_url);
              const uploadedAt = open.payment_proof_url ? open.updated_at ?? open.paid_at : null;
              const events = [
                { label: "Order placed", at: open.created_at, detail: null as string | null },
                { label: "Receipt uploaded", at: uploadedAt, detail: path ? path.split("/").pop() ?? null : null },
                { label: "Receipt verified", at: open.paid_at, detail: txn ? `TXN: ${txn}` : null },
                { label: "Marked paid", at: open.paid_at, detail: null },
              ];
              return (
                <div className="border-t border-border pt-4">
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Timeline</div>
                  <ol className="space-y-3">
                    {events.map((e, i) => {
                      const done = !!e.at;
                      return (
                        <li key={i} className="flex gap-3 items-start text-sm">
                          <span className={`mt-1 inline-block w-2 h-2 rounded-full ${done ? "bg-[var(--gold)]" : "bg-border"}`} />
                          <div className="flex-1">
                            <div className={done ? "" : "text-muted-foreground"}>{e.label}</div>
                            {e.detail && <div className="text-xs font-mono text-[var(--gold)] break-all">{e.detail}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{fmt(e.at) ?? "—"}</div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })()}

            {/* Admin actions */}
            <div className="border-t border-border pt-6">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Actions</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatus("paid")}
                  disabled={updating || open.status === "paid"}
                  className="flex-1 min-w-[140px] bg-[var(--gold)] text-black py-3 text-[10px] tracking-[0.3em] uppercase disabled:opacity-40"
                >
                  ✓ Mark Fulfilled
                </button>
                <button
                  onClick={() => setStatus("cancelled")}
                  disabled={updating || open.status === "cancelled"}
                  className="flex-1 min-w-[140px] border border-destructive text-destructive py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-destructive hover:text-background transition disabled:opacity-40"
                >
                  × Cancel Order
                </button>
                {open.status !== "pending" && (
                  <button
                    onClick={() => setStatus("pending")}
                    disabled={updating}
                    className="flex-1 min-w-[140px] border border-border py-3 text-[10px] tracking-[0.3em] uppercase hover:border-foreground transition disabled:opacity-40"
                  >
                    Reset to Pending
                  </button>
                )}
              </div>
            </div>

            <button onClick={() => setOpen(null)} className="w-full text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground pt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  roles: string[];
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    });
    setUsers((profs ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: "admin" | "influencer", has: boolean) => {
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    load();
  };

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="border border-border p-4 grid md:grid-cols-5 gap-4 items-center text-sm">
          <div className="md:col-span-2">
            <div>{u.full_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{u.phone ?? ""}</div>
          </div>
          <div className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
          <div className="flex gap-2">
            {(["admin", "influencer"] as const).map((r) => {
              const has = u.roles.includes(r);
              return (
                <button key={r} onClick={() => toggleRole(u.id, r, has)} className={`px-3 py-1 text-[10px] tracking-[0.3em] uppercase border ${has ? "border-[var(--gold)] text-[var(--gold)]" : "border-border text-muted-foreground"}`}>
                  {r}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground text-right">{u.roles.join(", ") || "customer"}</div>
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-[var(--gold)]" />
    </div>
  );
}
