import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1).max(200),
  color: z.string().min(1).max(64),
  size: z.string().min(1).max(16),
  qty: z.number().int().min(1).max(100),
});

const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  referral_code: z.string().trim().max(64).optional().nullable(),
  shipping_address: z.object({
    full_name: z.string().min(1).max(120),
    phone: z.string().min(1).max(40),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(120),
    state: z.string().min(1).max(120),
    country: z.string().min(1).max(120).default("Nigeria"),
  }),
});

export const validateReferralCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().trim().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("validate_referral_code", { _code: data.code });
    if (error) return { valid: false, discount_percent: 0 };
    const row = (rows as Array<{ valid: boolean; discount_percent: number }>)?.[0];
    if (!row || !row.valid) return { valid: false, discount_percent: 0 };
    return { valid: true, discount_percent: row.discount_percent };
  });

/**
 * Creates a pending order (no payment gateway).
 * Customer is then redirected to WhatsApp to arrange payment with a rep.
 * Admin marks the order paid (fulfilled) or cancelled from /admin.
 */
export const createPendingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Re-fetch product prices server-side (NEVER trust client prices)
    const productIds = [...new Set(data.items.map((i) => i.product_id))];
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price_kobo, colors, sizes, active")
      .in("id", productIds);
    if (pErr || !products) throw new Error("Failed to load products");

    let subtotalKobo = 0;
    for (const item of data.items) {
      const p = products.find((x) => x.id === item.product_id);
      if (!p || !p.active) throw new Error(`Product unavailable: ${item.product_name}`);
      if (!p.colors.includes(item.color)) throw new Error(`Invalid color: ${item.color}`);
      if (!p.sizes.includes(item.size)) throw new Error(`Invalid size: ${item.size}`);
      subtotalKobo += p.price_kobo * item.qty;
    }

    // Validate referral code
    let discountKobo = 0;
    let referralCodeId: string | null = null;
    if (data.referral_code && data.referral_code.trim()) {
      const { data: rows } = await supabaseAdmin.rpc("validate_referral_code", { _code: data.referral_code.trim() });
      const row = (rows as Array<{ valid: boolean; code_id: string; discount_percent: number; owner_user_id: string }>)?.[0];
      if (row?.valid && row.owner_user_id !== userId) {
        discountKobo = Math.floor((subtotalKobo * row.discount_percent) / 100);
        referralCodeId = row.code_id;
      }
    }

    const totalKobo = subtotalKobo - discountKobo;

    const itemsWithPrice = data.items.map((it) => {
      const p = products.find((x) => x.id === it.product_id)!;
      return { ...it, unit_price_kobo: p.price_kobo };
    });

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        subtotal_kobo: subtotalKobo,
        discount_kobo: discountKobo,
        total_kobo: totalKobo,
        referral_code_id: referralCodeId,
        shipping_address: data.shipping_address,
        items: itemsWithPrice,
      })
      .select()
      .single();
    if (oErr || !order) throw new Error("Failed to create order");

    return {
      order_id: order.id,
      total_kobo: totalKobo,
      discount_kobo: discountKobo,
      subtotal_kobo: subtotalKobo,
    };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Error("Admin access required");

    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.product_id);
    if (error) throw new Error(error.message);

    return { success: true };
  });

/**
 * Admin action: mark order as paid (fulfilled) or cancelled.
 * On "paid", increments referral code usage if applicable.
 */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum(["paid", "cancelled", "pending", "failed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify caller is admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Admin access required");

    const { data: order, error: fErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .single();
    if (fErr || !order) throw new Error("Order not found");

    const wasPaid = order.status === "paid";
    const update: { status: typeof data.status; paid_at?: string | null } = { status: data.status };
    if (data.status === "paid" && !wasPaid) update.paid_at = new Date().toISOString();
    if (data.status !== "paid") update.paid_at = null;

    const { error: uErr } = await supabaseAdmin.from("orders").update(update).eq("id", order.id);
    if (uErr) throw new Error(uErr.message);

    // If transitioning to paid, record referral usage (idempotent)
    if (data.status === "paid" && !wasPaid && order.referral_code_id) {
      const { data: existing } = await supabaseAdmin
        .from("referral_uses")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("referral_uses").insert({
          code_id: order.referral_code_id,
          used_by_user_id: order.user_id,
          order_id: order.id,
          discount_applied_kobo: order.discount_kobo,
        });
        const { data: rc } = await supabaseAdmin
          .from("referral_codes")
          .select("uses_count")
          .eq("id", order.referral_code_id)
          .single();
        if (rc) {
          await supabaseAdmin
            .from("referral_codes")
            .update({ uses_count: rc.uses_count + 1 })
            .eq("id", order.referral_code_id);
        }
      }
    }

    return { success: true, status: data.status };
  });
