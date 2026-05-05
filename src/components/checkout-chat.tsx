import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { attachPaymentProof } from "@/lib/checkout-order.functions";
import { toast } from "sonner";
import { X, Send, Paperclip, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

interface CheckoutChatProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderContext: string;
  customerName?: string;
  onConfirmed: () => void;
}

export function CheckoutChat({
  open,
  onClose,
  orderId,
  orderContext,
  customerName,
  onConfirmed,
}: CheckoutChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      const greet = customerName ? `Hi, my name is ${customerName}.` : "Hi, I'm ready to checkout.";
      void send(greet, []);
    }
    if (!open) {
      startedRef.current = false;
      setMessages([]);
      setConfirmed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const stream = async (history: Msg[]) => {
    setIsStreaming(true);
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch("/api/checkout-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, orderContext }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        toast.error(errBody.error || "Chat unavailable");
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsertAssistant(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection error");
    } finally {
      setIsStreaming(false);
    }
  };

  const send = async (text: string, prior?: Msg[]) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...(prior ?? messages), userMsg];
    setMessages(next);
    setInput("");
    await stream(next);
  };

  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
  const MAX_BYTES = 5 * 1024 * 1024;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : result);
      };
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

  const pushAssistant = (content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const handleFile = async (file: File) => {
    if (!user) {
      toast.error("Please sign in to upload your receipt.");
      return;
    }
    // ── Client-side validation ──────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Receipt must be an image (JPG, PNG, WEBP, or HEIC). PDFs are not supported.");
      return;
    }
    if (file.size === 0) {
      toast.error("That file appears to be empty. Please pick another receipt.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Receipt must be under 5 MB (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }

    setUploading(true);
    try {
      // ── 1. AI verification BEFORE anything is saved ───────────────────
      pushAssistant("🔍 Verifying your receipt, one moment…");
      const base64 = await fileToBase64(file);
      const verifyRes = await fetch("/api/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || "Verification service is unavailable. Please try again.");
      }
      const verdict = await verifyRes.json();
      const verifiedAt = new Date().toISOString();

      if (!verdict.valid) {
        const reason =
          verdict.reason ||
          "We couldn't confirm this receipt belongs to our Moniepoint account (9064677372 — Ademuwagun Promise Adeyemi).";
        pushAssistant(
          `⚠️ ${reason}\n\nPlease upload a clear screenshot of the **Moniepoint transfer receipt** showing the recipient account 9064677372, the amount, the date, and a transaction reference.`,
        );
        toast.error("Receipt rejected — please upload the correct one.");
        return;
      }

      // ── 2. Upload to private bucket ──────────────────────────────────
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${orderId}-${Date.now()}.${ext}`;
      const uploadedAt = new Date().toISOString();
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(`Could not save receipt: ${upErr.message}`);

      // ── 3. Persist proof + transaction id, mark order paid, notify admin ─
      await attachPaymentProof({
        data: {
          order_id: orderId,
          proof: path,
          transaction_id: verdict.transactionId || undefined,
          uploaded_at: uploadedAt,
          verified_at: verifiedAt,
        },
      });

      setConfirmed(true);
      onConfirmed();

      const txnLine = verdict.transactionId
        ? `Transaction ID: \`${verdict.transactionId}\``
        : "";
      const userMsg: Msg = {
        role: "user",
        content: `✅ Uploaded my Moniepoint receipt (${file.name}). ${txnLine}`,
      };
      const next = [...messages, userMsg];
      setMessages(next);
      await stream(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      pushAssistant(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-background border border-border w-full sm:max-w-lg h-[85vh] sm:h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)]">
              Pappy Concierge
            </div>
            <div className="text-sm font-display mt-1">Checkout Assistant</div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages
            .filter((_, i) => !(i === 0 && messages[0]?.role === "user")) // hide synthetic greet
            .map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--gold)] text-black"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content || (isStreaming ? "…" : "")}
                </div>
              </div>
            ))}
          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-2.5 text-sm">…</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          {confirmed && (
            <div className="text-[10px] text-[var(--gold)] tracking-[0.2em] uppercase text-center mb-2">
              ✓ Receipt received — order booked
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isStreaming}
              className="p-2 text-muted-foreground hover:text-[var(--gold)] disabled:opacity-50"
              aria-label="Upload receipt"
              title="Upload receipt"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Type your message…"
              className="flex-1 bg-transparent border-b border-border py-2 px-1 text-sm focus:outline-none focus:border-[var(--gold)]"
              disabled={isStreaming}
            />
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || isStreaming}
              className="p-2 text-[var(--gold)] disabled:opacity-30"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
