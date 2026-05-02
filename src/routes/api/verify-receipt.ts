import { createFileRoute } from "@tanstack/react-router";

/**
 * Verifies an uploaded payment receipt using Lovable AI vision.
 * Checks recipient account number, recipient name, bank, and basic legitimacy.
 * Extracts the transaction/reference ID.
 *
 * Body: { imageBase64: string, mimeType: string, expectedAmountKobo?: number }
 * Returns: { valid: boolean, transactionId?: string, reason?: string, details?: object }
 */
export const Route = createFileRoute("/api/verify-receipt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { imageBase64, mimeType, expectedAmountKobo } = await request.json();
          if (!imageBase64 || !mimeType) {
            return json({ error: "Missing image" }, 400);
          }
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

          const expectedAmountNaira =
            typeof expectedAmountKobo === "number"
              ? (expectedAmountKobo / 100).toFixed(2)
              : null;

          const systemPrompt = `You are a strict payment-receipt verifier for a Nigerian fashion brand.

You will be given an image of a bank transfer receipt. The customer is supposed to have transferred funds to:
  - Bank: Moniepoint
  - Account Number: 9064677372
  - Account Name: Ademuwagun Promise Adeyemi
${expectedAmountNaira ? `  - Expected amount: ₦${expectedAmountNaira}` : ""}

Carefully inspect the receipt and decide:
1) Does the receipt clearly show the recipient account number "9064677372"? (Allow visual variants but not different numbers.)
2) Does it show recipient name matching "Ademuwagun Promise Adeyemi" (or close variant — "Ademuwagun Promise", "Promise Adeyemi", etc.)?
3) Is the bank/app clearly Moniepoint (logo, header text, or "Moniepoint" written)?
4) Does the receipt contain the standard fields you expect from a legitimate Moniepoint transfer receipt: a transaction reference / ID, a date/time, an amount, and recipient details?
5) Does the image look like an authentic screenshot/photo (not visibly edited, blurred-over, mismatched fonts, suspicious overlays)?

If ALL 5 checks pass, set valid=true and return the transaction reference exactly as it appears on the receipt (typically labelled "Transaction Reference", "Reference", "Session ID", "Transaction ID", or similar — pick the longest unique alphanumeric identifier).

If ANY check fails, set valid=false and write a short, polite reason that we can show to the customer (1 sentence, no jargon).

Always respond by calling the verify_receipt tool. Do not respond with plain text.`;

          const tools = [
            {
              type: "function",
              function: {
                name: "verify_receipt",
                description: "Return the verification verdict for the receipt image.",
                parameters: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean" },
                    transactionId: {
                      type: "string",
                      description:
                        "Transaction reference / session id from the receipt. Empty string if not found.",
                    },
                    reason: {
                      type: "string",
                      description:
                        "Short customer-facing explanation when valid=false. Empty string when valid=true.",
                    },
                    recipientAccount: { type: "string" },
                    recipientName: { type: "string" },
                    bank: { type: "string" },
                    amount: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["valid", "transactionId", "reason"],
                  additionalProperties: false,
                },
              },
            },
          ];

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Please verify this payment receipt." },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                    },
                  ],
                },
              ],
              tools,
              tool_choice: { type: "function", function: { name: "verify_receipt" } },
            }),
          });

          if (!resp.ok) {
            if (resp.status === 429)
              return json({ error: "Too many requests, please wait a moment." }, 429);
            if (resp.status === 402)
              return json({ error: "AI credits exhausted. Please contact support." }, 402);
            const t = await resp.text();
            console.error("AI verify error:", resp.status, t);
            return json({ error: "Verification service error" }, 500);
          }

          const payload = await resp.json();
          const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
          if (!call?.function?.arguments) {
            return json({ error: "Could not read receipt — please try a clearer image." }, 400);
          }
          let parsed: any;
          try {
            parsed = JSON.parse(call.function.arguments);
          } catch {
            return json({ error: "Verification failed — invalid response." }, 500);
          }

          return json({
            valid: !!parsed.valid,
            transactionId: parsed.transactionId || null,
            reason: parsed.reason || null,
            details: {
              recipientAccount: parsed.recipientAccount,
              recipientName: parsed.recipientName,
              bank: parsed.bank,
              amount: parsed.amount,
              date: parsed.date,
            },
          });
        } catch (e) {
          console.error("verify-receipt error:", e);
          return json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            500,
          );
        }
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
