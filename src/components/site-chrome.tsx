import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { useState } from "react";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight uppercase">Pappy Clothings</Link>

        <nav className="hidden md:flex items-center gap-10 text-[11px] tracking-[0.25em] uppercase">
          <Link to="/" className="hover:text-[var(--gold)] transition">Home</Link>
          <Link to="/shop" className="hover:text-[var(--gold)] transition">Shop</Link>
          {user && <Link to="/dashboard" className="hover:text-[var(--gold)] transition">Account</Link>}
          {isAdmin && <Link to="/admin" className="text-[var(--gold)] hover:opacity-80 transition">Admin</Link>}
        </nav>

        <div className="flex items-center gap-6 text-[11px] tracking-[0.25em] uppercase">
          <Link to="/checkout" className="relative">
            Cart {count > 0 && <span className="ml-1 text-[var(--gold)]">({count})</span>}
          </Link>
          {user ? (
            <button onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="hover:text-[var(--gold)]">Logout</button>
          ) : (
            <Link to="/auth" className="hover:text-[var(--gold)]">Login</Link>
          )}
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="flex flex-col px-6 py-4 gap-4 text-[11px] tracking-[0.25em] uppercase">
            <Link to="/" onClick={() => setOpen(false)}>Home</Link>
            <Link to="/shop" onClick={() => setOpen(false)}>Shop</Link>
            {user && <Link to="/dashboard" onClick={() => setOpen(false)}>Account</Link>}
            {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="text-[var(--gold)]">Admin</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 grid md:grid-cols-4 gap-12">
        <div>
          <div className="font-display text-3xl font-bold uppercase">Pappy Clothings</div>
          <p className="mt-4 text-xs text-muted-foreground tracking-wider leading-relaxed">
            Born Above. Limited editions only.
          </p>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">Shop</div>
          <ul className="space-y-2 text-xs">
            <li><Link to="/shop" className="hover:text-[var(--gold)]">Hoodie</Link></li>
            <li><Link to="/checkout" className="hover:text-[var(--gold)]">Checkout</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">Account</div>
          <ul className="space-y-2 text-xs">
            <li><Link to="/auth" className="hover:text-[var(--gold)]">Login / Signup</Link></li>
            <li><Link to="/dashboard" className="hover:text-[var(--gold)]">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">Contact</div>
          <ul className="space-y-2 text-xs">
            <li>hello@pappy.clothing</li>
            <li>Lagos · NG</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        © {new Date().getFullYear()} Pappy Clothings
      </div>
    </footer>
  );
}
