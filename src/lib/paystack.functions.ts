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

const initSchema = z.object({
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
  callback_url: z.string().url(),
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

export const initializePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payment gateway not configured");

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
      if (row?.valid) {
        if (row.owner_user_id === userId) {
          // self-referral disallowed
        } else {
          discountKobo = Math.floor((subtotalKobo * row.discount_percent) / 100);
          referralCodeId = row.code_id;
        }
      }
    }

    const totalKobo = subtotalKobo - discountKobo;

    // Get user email for Paystack
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) throw new Error("User email not found");

    // Create pending order
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

    // Initialize Paystack
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: totalKobo,
        currency: "NGN",
        callback_url: data.callback_url,
        metadata: { order_id: order.id, user_id: userId },
      }),
    });
    const psJson = await paystackRes.json();
    if (!paystackRes.ok || !psJson.status) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw new Error(psJson.message || "Payment initialization failed");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        paystack_reference: psJson.data.reference,
        paystack_access_code: psJson.data.access_code,
      })
      .eq("id", order.id);

    return {
      authorization_url: psJson.data.authorization_url as string,
      reference: psJson.data.reference as string,
      order_id: order.id,
      total_kobo: totalKobo,
      discount_kobo: discountKobo,
    };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { reference: string }) =>
    z.object({ reference: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payment gateway not configured");

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await res.json();
    if (!res.ok || !json.status) return { success: false, status: "failed" as const };

    const txStatus = json.data.status;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("paystack_reference", data.reference)
      .single();
    if (!order) return { success: false, status: "failed" as const };

    if (txStatus === "success") {
      // Idempotent: only update if not already paid
      if (order.status !== "paid") {
        await supabaseAdmin
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id);

        if (order.referral_code_id) {
          await supabaseAdmin.from("referral_uses").insert({
            code_id: order.referral_code_id,
            used_by_user_id: order.user_id,
            order_id: order.id,
            discount_applied_kobo: order.discount_kobo,
          });
          // increment uses_count via RPC-less update
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
      return { success: true, status: "paid" as const, order_id: order.id };
    } else {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return { success: false, status: "failed" as const };
    }
  });
