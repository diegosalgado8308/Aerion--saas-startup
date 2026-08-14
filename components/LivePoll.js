"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 5000;

/**
 * The closest thing this app has to "multiplayer": silently keeps the
 * current page's server-rendered data fresh by calling router.refresh() on
 * an interval, so a teammate's change shows up within a few seconds without
 * anyone needing to reload. router.refresh() re-fetches the Server
 * Component tree's data but preserves client-side state (e.g. text already
 * typed into an uncommitted form field), so this doesn't clobber in-progress
 * input the way a full page reload would.
 *
 * Pauses while the tab is hidden — no point polling a background tab.
 * Renders nothing; drop it anywhere in a page that should stay live.
 */
export default function LivePoll({ intervalMs = DEFAULT_INTERVAL_MS }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
