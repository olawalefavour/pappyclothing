import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site-chrome";
import { toast } from "sonner";

type SearchParams = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate({ to: search.redirect ?? "/dashboard" });
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error); return; }
        toast.success("Welcome back");
        navigate({ to: search.redirect ?? "/dashboard" });
      } else {
        if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        if (!fullName.trim()) { toast.error("Full name required"); return; }
        const { error } = await signUp(email, password, fullName, phone);
        if (error) { toast.error(error); return; }
        toast.success("Account created. You can sign in now.");
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="pt-32 pb-16 px-6 max-w-md mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[var(--gold)] mb-4">Members</div>
        <h1 className="text-5xl font-display mb-2">{mode === "login" ? "Sign In" : "Create Account"}</h1>
        <p className="text-sm text-muted-foreground mb-10">
          {mode === "login" ? "Access your orders and referral code." : "Join the circle. Receive your personal referral code."}
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          {mode === "signup" && (
            <>
              <Field label="Full Name" value={fullName} onChange={setFullName} required />
              <Field label="Phone" value={phone} onChange={setPhone} />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-foreground py-4 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground hover:text-background transition disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground tracking-wider"
        >
          {mode === "login" ? "No account? Create one →" : "Have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground block mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-transparent border-b border-border py-3 focus:outline-none focus:border-[var(--gold)] text-sm"
      />
    </div>
  );
}
