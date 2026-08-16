"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Below 900px, .header-nav and the desktop .header-actions are both hidden
 * by CSS (see globals.css) — this panel is the only way to reach
 * Projects/Team/Billing/sign-out at that width, not just a decorative extra.
 *
 * signOutSlot is SignOutButton rendered by the caller (Header.js, a Server
 * Component) and passed down as an element, not imported here — SignOutButton
 * defines an inline "use server" action, which Next.js doesn't allow inside a
 * Client Component's own module graph. Composition sidesteps that: this file
 * never imports SignOutButton, it just renders whatever JSX it's handed.
 */
export default function MobileNavToggle({ userName, signOutSlot }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="mobile-nav" ref={rootRef}>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mobile-nav-icon" aria-hidden="true" />
      </button>

      {open && (
        <div id="mobile-nav-panel" className="mobile-nav-panel" role="menu">
          <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)}>Projects</Link>
          <Link href="/team" role="menuitem" onClick={() => setOpen(false)}>Team</Link>
          <Link href="/billing" role="menuitem" onClick={() => setOpen(false)}>Billing</Link>
          <div className="mobile-nav-user">{userName}</div>
          {signOutSlot}
        </div>
      )}
    </div>
  );
}
