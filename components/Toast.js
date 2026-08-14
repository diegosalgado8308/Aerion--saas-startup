"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 6000;

/**
 * message/type come from the server (?error=/?sent= query params, translated
 * to props by the page). Each occurrence needs a fresh remount even if the
 * text is identical to the last one — the parent passes a server-generated
 * key (see e.g. app/team/page.js) for exactly that reason, since two
 * identical error strings in a row wouldn't otherwise re-trigger this
 * component's effect.
 */
export default function Toast({ message, type = "error" }) {
  // Relies on the parent remounting this component (via a fresh `key`) for
  // each new occurrence, even if the message text repeats — so the initial
  // state here only needs to reflect "is there a message on mount," and the
  // effect only needs to own the auto-dismiss timer, not re-show anything.
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div
      className={`toast toast-${type}`}
      role="alert"
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      <button type="button" className="toast-dismiss" onClick={() => setVisible(false)} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
