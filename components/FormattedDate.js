"use client";

/**
 * Formats a date using the *visitor's* browser locale (Intl's default when
 * no locale is passed), not the server's. Rendered on the server first with
 * suppressHydrationWarning — the server-rendered text may briefly differ
 * from what the client re-renders once it knows the real locale, which is
 * expected and the standard way to handle locale-dependent formatting in a
 * server-rendered React tree (see React's own docs on this exact case).
 */
export default function FormattedDate({ date, withTime = false }) {
  const d = new Date(date);
  const text = withTime
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return <span suppressHydrationWarning>{text}</span>;
}
