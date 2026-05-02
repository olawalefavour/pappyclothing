import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";

const attachAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
});

/**
 * Attach a verified payment proof + transaction id to an existing order,
 * then notify the admin by email (best-effort).
 */
export const attachPaymentProof = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        proof: z.string().min(1).max(2000),
        transaction_id: z.string().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: order, error: fErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, items, total_kobo, created_at")
      .eq("id", data.order_id)
      .single();
    if (fErr || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Forbidden");

    const proofValue = data.transaction_id
      ? `${data.proof}|TXN:${data.transaction_id}`
      : data.proof;

    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_proof_url: proofValue, status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id);
    if (uErr) throw new Error(uErr.message);

    // Best-effort admin notification (won't fail the request if email isn't set up yet).
    try {
      await notifyAdmin({
        orderId: order.id,
        userId,
        items: order.items as unknown,
        totalKobo: Number(order.total_kobo ?? 0),
        transactionId: data.transaction_id ?? null,
        orderedAt: order.created_at as string,
      });
    } catch (e) {
      console.error("Admin notification failed (non-fatal):", e);
    }

    return { success: true };
  });

async function notifyAdmin(params: {
  orderId: string;
  userId: string;
  items: unknown;
  totalKobo: number;
  transactionId: string | null;
  orderedAt: string;
}) {
  // Look up customer info
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", params.userId)
    .maybeSingle();

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(params.userId);
  const customerEmail = authUser?.user?.email ?? "(unknown)";
  const customerName = profile?.full_name ?? authUser?.user?.user_metadata?.full_name ?? "(unknown)";

  // Find admin email(s)
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = (admins ?? []).map((r) => r.user_id);
  const adminEmails: string[] = [];
  for (const id of adminIds) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    if (u?.user?.email) adminEmails.push(u.user.email);
  }
  if (adminEmails.length === 0) {
    console.warn("No admin email found; skipping notification");
    return;
  }

  const items = Array.isArray(params.items) ? (params.items as any[]) : [];
  const itemsList = items
    .map(
      (it) =>
        `<li>${escapeHtml(it.product_name ?? "Item")} — ${escapeHtml(it.color ?? "")} ${escapeHtml(it.size ?? "")} ×${Number(it.qty ?? 1)}</li>`,
    )
    .join("");

  const totalNaira = (params.totalKobo / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
  });
  const orderedAt = new Date(params.orderedAt).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
  });

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
      <h2 style="color:#b8860b;margin:0 0 16px">New Paid Order — Pappy Clothing Store</h2>
      <p>A customer has uploaded a verified payment receipt.</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Customer</b></td><td>${escapeHtml(String(customerName))}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(customerEmail)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(profile?.phone ?? "")}</td></tr>
        <tr><td><b>Order ID</b></td><td>${escapeHtml(params.orderId)}</td></tr>
        <tr><td><b>Transaction ID</b></td><td>${escapeHtml(params.transactionId ?? "(not extracted)")}</td></tr>
        <tr><td><b>Total</b></td><td>${escapeHtml(totalNaira)}</td></tr>
        <tr><td><b>Ordered at</b></td><td>${escapeHtml(orderedAt)}</td></tr>
      </table>
      <h3>Items</h3>
      <ul>${itemsList || "<li>(no items)</li>"}</ul>
    </div>`.trim();

  // Try sending via Lovable Emails (transactional). If not yet provisioned, log and continue.
  const baseUrl =
    process.env.VITE_SUPABASE_URL ??
    process.env.SITE_URL ??
    "";
  // Send via the app's own transactional route. We loop one-by-one (1:1 sends).
  for (const to of adminEmails) {
    try {
      const resp = await fetch(
        `${process.env.PUBLIC_APP_URL ?? ""}/lovable/email/transactional/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "admin-new-order",
            recipientEmail: to,
            idempotencyKey: `admin-order-${params.orderId}`,
            templateData: {
              customerName,
              customerEmail,
              orderId: params.orderId,
              transactionId: params.transactionId ?? "(not extracted)",
              totalNaira,
              orderedAt,
              items: items.map((it) => ({
                name: it.product_name ?? "Item",
                color: it.color ?? "",
                size: it.size ?? "",
                qty: Number(it.qty ?? 1),
              })),
            },
          }),
        },
      );
      if (!resp.ok) {
        console.warn(
          `Admin email send returned ${resp.status} for ${to} (Lovable Emails may not be set up yet). HTML preview: ${html.slice(0, 200)}…`,
        );
      }
    } catch (e) {
      console.warn(`Admin email send failed for ${to}:`, e);
    }
  }
  // suppress unused warning
  void baseUrl;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
