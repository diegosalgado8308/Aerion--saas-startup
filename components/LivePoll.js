"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_INTERVAL_MS = 5000; // user present and interacting recently
const SAVE_DATA_INTERVAL_MS = 20000; // browser signals a data-saving preference
const IDLE_INTERVAL_MS = 30000; // no interaction for a while — furthest back-off
const IDLE_AFTER_MS = 60000; // how long without interaction counts as "idle"
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart"];

function prefersReducedData() {
  return typeof navigator !== "undefined" && navigator.connection?.saveData === true;
}

/**
 * The closest thing this app has to "multiplayer": silently keeps the
 * current page's server-rendered data fresh by calling router.refresh() on
 * an interval, so a teammate's change shows up within a few seconds without
 * anyone needing to reload. router.refresh() re-fetches the Server
 * Component tree's data but preserves client-side state (e.g. text already
 * typed into an uncommitted form field), so this doesn't clobber in-progress
 * input the way a full page reload would.
 *
 * Power/battery aware rather than a flat interval: polls at `intervalMs`
 * (default 5s) while the user is actively present, backs off to a slower
 * cadence once they've been idle for a minute or the browser signals a
 * data-saving preference (navigator.connection.saveData — Chromium-only;
 * unsupported browsers just don't get this particular back-off), and skips
 * the network call entirely whenever the tab is hidden. Refreshes
 * immediately on regaining visibility instead of waiting out a full
 * interval, so switching back to the tab doesn't show a stale view.
 *
 * `router` and `intervalMs` are read through refs (kept current by a small
 * separate effect) rather than as the polling effect's own dependencies —
 * router.refresh() triggers a re-render, and if the polling effect depended
 * on `router` directly, that re-render would tear down and rebuild it every
 * single poll cycle, resetting the idle clock back to "now" each time and
 * permanently defeating the idle back-off this component exists to provide.
 *
 * Renders nothing; drop it anywhere in a page that should stay live.
 */
export default function LivePoll({ intervalMs = ACTIVE_INTERVAL_MS }) {
  const router = useRouter();
  const routerRef = useRef(router);
  const intervalMsRef = useRef(intervalMs);
  const lastActivityRef = useRef(null);

  // Ref writes belong in an effect, not during render — but this one has no
  // cleanup to run, so re-running it every time `router`/`intervalMs` change
  // is cheap. The polling effect below stays dependency-free specifically so
  // *that* one (which owns a timer and event listeners) never tears down.
  useEffect(() => {
    routerRef.current = router;
    intervalMsRef.current = intervalMs;
  }, [router, intervalMs]);

  useEffect(() => {
    if (lastActivityRef.current === null) lastActivityRef.current = Date.now();

    function markActive() {
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        markActive();
        routerRef.current.refresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let timeoutId;
    function scheduleNext() {
      const isIdle = Date.now() - lastActivityRef.current >= IDLE_AFTER_MS;
      const nextInterval = isIdle ? IDLE_INTERVAL_MS : prefersReducedData() ? SAVE_DATA_INTERVAL_MS : intervalMsRef.current;
      timeoutId = setTimeout(() => {
        if (document.visibilityState === "visible") routerRef.current.refresh();
        scheduleNext();
      }, nextInterval);
    }
    scheduleNext();

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
    };
    // Deliberately empty: router/intervalMs are read via refs above so this
    // effect runs once on mount and never tears itself down mid-poll.
  }, []);

  return null;
}
