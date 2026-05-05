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
        <Link to="/" style={{ fontFamily: "'Pacifico', cursive" }} className="text-3xl font-bold text-[var(--gold)] tracking-tight normal-case">Pappy Clothings</Link>

        <nav className="hidden md:flex items-center gap-10 text-[11px] tracking-[0.25em] uppercase">
          <Link to="/" className="hover:text-[var(--gold)] transition">Home</Link>
          <Link to="/shop" className="hover:text-[var(--gold)] transition">Shop</Link>
          <Link to="/shop" hash="archive" className="hover:text-[var(--gold)] transition">Archive</Link>
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
            <Link to="/shop" hash="archive" onClick={() => setOpen(false)}>Archive</Link>
            {user && <Link to="/dashboard" onClick={() => setOpen(false)}>Account</Link>}
            {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="text-[var(--gold)]">Admin</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}

export function WhatsAppFloat() {
  return (
    <a
      href="https://wa.link/hpm3sc"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.555-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.594 5.301l-.999 3.648 3.894-.948zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414z"/>
      </svg>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 grid md:grid-cols-4 gap-12">
        <div>
          <div style={{ fontFamily: "'Pacifico', cursive" }} className="text-4xl font-bold text-[var(--gold)]">Pappy Clothings</div>
          <p className="mt-4 text-xs text-muted-foreground tracking-wider leading-relaxed">
            Born Above. Limited editions only.
          </p>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">Shop</div>
          <ul className="space-y-2 text-xs">
            <li><Link to="/shop" className="hover:text-[var(--gold)]">Hoodie</Link></li>
            <li><Link to="/shop" hash="archive" className="hover:text-[var(--gold)]">Archive</Link></li>
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
