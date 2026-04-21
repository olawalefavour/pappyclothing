import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "node:crypto";

export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const signature = request.headers.get("x-paystack-signature");
        const raw = await request.text();
        const computed = crypto.createHmac("sha512", secret).update(raw).digest("hex");

        if (signature !== computed) return new Response("Invalid signature", { status: 401 });

        let event: { event: string; data: { reference: string; status: string } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        if (event.event === "charge.success" && event.data?.reference) {
          const ref = event.data.reference;
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("paystack_reference", ref)
            .single();

          if (order && order.status !== "paid") {
            await supabaseAdmin
              .from("orders")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", order.id);

            if (order.referral_code_id) {
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
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
