"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header({ session }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className={`container nav${open ? " open" : ""}`}>
        <Link href="/" className="logo" onClick={close}>
          <img src="/assets/logo-mark.png" alt="Aerion Software" className="logo-mark" />
          <span className="logo-text">
            <span className="logo-title">Aerion</span>
            <span className="logo-subtitle">Software</span>
          </span>
        </Link>

        <nav className="nav-links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
              onClick={close}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={session ? "/portal/dashboard" : "/portal/login"}
            className={pathname.startsWith("/portal") ? "active" : ""}
            onClick={close}
          >
            Client Portal
          </Link>
        </nav>

        <div className="nav-cta">
          <Link href={session ? "/portal/dashboard" : "/portal/login"} className="btn btn-secondary">
            {session ? "Dashboard" : "Client Login"}
          </Link>
          <Link href="/contact" className="btn btn-primary">Start a project</Link>
        </div>

        <button className="nav-toggle" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </header>
  );
}
