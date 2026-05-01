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
 * Attach a payment proof (receipt URL or pasted reference text) to an existing order.
 * Called after the AI confirms the customer has uploaded/pasted proof.
 */
export const attachPaymentProof = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        proof: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: order, error: fErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id")
      .eq("id", data.order_id)
      .single();
    if (fErr || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Forbidden");

    const { error: uErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_proof_url: data.proof })
      .eq("id", order.id);
    if (uErr) throw new Error(uErr.message);

    return { success: true };
  });
