import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are "Pappy", the friendly checkout assistant for Pappy Clothings (a luxury Nigerian streetwear brand).

Your job is to walk the customer through manual bank-transfer checkout in a warm, concise way. Keep messages SHORT (1-3 sentences each). Use emojis sparingly.

Conversation flow:
1. GREET the customer warmly by name if you know it. Confirm their order total (it will be provided in the system message context).
2. SHARE the payment account details EXACTLY as below, formatted clearly:
   • Bank: Moniepoint
   • Account Number: 9064677372
   • Account Name: Ademuwagun Promise Adeyemi
   Tell them to transfer the exact total.
3. ASK them to upload a screenshot/photo of their payment receipt OR paste the transaction reference once payment is done. Tell them they can use the 📎 attach button below the chat.
4. When they upload a receipt or paste a reference, CONFIRM the order is booked, thank them warmly, and tell them they'll get a delivery update on WhatsApp/email shortly.
5. Answer any follow-up questions politely. Stay focused on completing checkout.

Rules:
- Never invent different account details.
- Never quote a different total than what's in the order context.
- If the customer hasn't uploaded a receipt yet, gently remind them.
- Always be polite, professional, and on-brand: luxury, calm, confident.`;

export const Route = createFileRoute("/api/checkout-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, orderContext } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const systemContent = `${SYSTEM_PROMPT}\n\nORDER CONTEXT:\n${orderContext ?? "(no order context)"}`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: systemContent }, ...(messages ?? [])],
              stream: true,
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(
                JSON.stringify({ error: "Too many requests, please wait a moment." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (response.status === 402) {
              return new Response(
                JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const t = await response.text();
            console.error("AI gateway error:", response.status, t);
            return new Response(JSON.stringify({ error: "AI service error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("checkout-chat error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
