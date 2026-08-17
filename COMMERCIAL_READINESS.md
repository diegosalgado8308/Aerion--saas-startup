# Commercial Readiness Matrix

A living scorecard of what stands between Aerion Software today and Aerion Software as a
sellable product with paying customers. Every row is graded against what's actually in the
repo/infra right now, not aspiration — re-audit this after any change that touches auth,
billing, data handling, or ops.

**Status key**: ✅ Done &nbsp;|&nbsp; 🟡 Partial &nbsp;|&nbsp; ❌ Missing

Last audited: 2026-08-17.

## 1. Core Product & Multi-Tenancy

| Item | Status | Evidence / Gap |
|---|---|---|
| Workspace-based multi-tenancy | ✅ | `User` / `Workspace` / `WorkspaceMember` model; every query goes through `require*InWorkspace` guards in `lib/workspace.js`. |
| Core PM feature set | ✅ | Projects, Kanban tasks, comments, attachments, due-date reminders, goal-planning frameworks. |
| Economy simulation tool | ✅ | Machinations.io-style diagram builder with balance/bottleneck analysis. |
| Roles & permissions | 🟡 | Only two roles (`OWNER`, `MEMBER`) — no granular permissions (e.g. billing-only admin, read-only viewer). Fine for small teams, a ceiling for larger customers. |

## 2. Authentication & Account Security

| Item | Status | Evidence / Gap |
|---|---|---|
| Password auth with hashing | ✅ | NextAuth Credentials provider + `bcryptjs`. |
| Login rate limiting / lockout | ✅ | 8 failed attempts locks the account 24h (`lib/workspace.js`). |
| Session handling / sign-out | ✅ | JWT sessions via NextAuth; `SignOutButton` works. |
| Email verification | ❌ | Any email is accepted at signup with no confirmation loop — no proof the account owner controls that inbox. |
| Password reset / forgot password | ✅ | `/forgot-password` + `/reset-password` (`lib/passwordReset.js`) — hashed single-use token, 1h expiry, same "don't reveal why" enumeration protection as login. Also clears an active login lockout on success — the self-serve recovery path Section 2's gap called out. |
| 2FA / MFA | ❌ | Not implemented. |

## 3. Data Protection, Privacy & Legal

| Item | Status | Evidence / Gap |
|---|---|---|
| Encryption in transit | ✅ | TLS end-to-end (Vercel, Neon `sslmode=require`). |
| Backups / disaster recovery | 🟡 | Neon provides point-in-time restore by platform default, but no restore drill has been run or documented — unverified in practice. |
| Data export / portability | ❌ | No self-serve "export my data" for a workspace. |
| Account / workspace deletion | ❌ | No delete-account or delete-workspace flow — data is retained indefinitely with no user-triggered erasure path. |
| Privacy Policy / Terms of Service | ✅ | `/privacy` + `/terms`, linked from the footer and the signup disclaimer. Content reflects actual data practices/subprocessors (Neon, Vercel Blob, Resend, now Stripe) rather than boilerplate. Governing-law jurisdiction still needs a real value filled in, and neither page has had real legal review. |
| Cookie consent / GDPR-CCPA posture | ❌ | Not addressed — a blocker for EU/CA users specifically. |

## 4. Billing & Monetization

| Item | Status | Evidence / Gap |
|---|---|---|
| Pricing page | ✅ | `/pricing` — 3 tiers (Free/Pro/Business), flat per-workspace, monthly. |
| Payment processor integration | ✅ | Stripe, provisioned via the Vercel Marketplace integration (`lib/stripe.js`). Hosted Checkout + Customer Portal — no Stripe.js/Elements on-page, zero CSP changes needed. |
| Plan / subscription management | ✅ | `/billing` — upgrade via Checkout, manage/cancel via the Stripe Customer Portal, synced back via `app/api/webhooks/stripe`. Owner-only, re-checked server-side in `lib/billing.js`, not just hidden in the UI. |
| Usage limits / metering | ✅ | `lib/billing.js`'s `assertCanAddMember`/`assertCanCreateProject`/`assertStorageQuota`/`assertEconomyToolEntitlement` gate member count, project count, attachment storage, and the economy tool per plan. Never retroactive — a workspace that falls below a new lower limit keeps existing data, only new creation is blocked. |

Monetization is live: Free ($0: 3 members/3 projects/100MB, no economy tool), Pro ($19/mo: 10 members/20 projects/5GB, economy tool included), Business ($49/mo: unlimited members/projects, 50GB, economy tool included). Webhook secret registered and Customer Portal configured — fully wired end-to-end, not just code-complete.

## 5. Reliability & Observability

| Item | Status | Evidence / Gap |
|---|---|---|
| Web Vitals monitoring | ✅ | `@vercel/speed-insights` wired into `app/layout.js`. |
| Error tracking (Sentry/equivalent) | ✅ | Sentry, provisioned via the Vercel Marketplace integration — real org/project, source maps uploading, navigation tracing on. `app/global-error.js` catches root-layout failures specifically. Sentry's own issue alerts double as the "tell someone" channel. |
| Structured logging | ❌ | No logging library — relies on default `console`/platform logs. |
| Health-check endpoint | ✅ | `/api/health` — pings the DB with `SELECT 1`, public/unauthenticated but doesn't leak error detail (logs server-side instead). |
| Uptime monitoring / status page | ❌ | Nothing external is polling `/api/health` yet — the endpoint exists, nothing is watching it. |
| Alerting | 🟡 | Sentry alerts on new/regressed errors by default. No separate uptime/downtime alert channel (Slack/PagerDuty) exists yet. |

Down from "nobody gets told" to "errors are caught and alerted on; a real outage-monitor polling /api/health is the remaining piece."

## 6. Deployment, CI/CD & Environments

| Item | Status | Evidence / Gap |
|---|---|---|
| Live production deployment | ✅ | https://aerion-software.vercel.app — verified end-to-end via real Playwright run. |
| Environment separation | ✅ | Dedicated Neon branches per environment (`production`, `preview`, `development`, `ci`) as of 2026-08-15. |
| CI pipeline (lint/test/build) | 🟡 | `.github/workflows/ci.yml` is live and triggers on push, but still needs `DATABASE_URL`/`AUTH_SECRET` repo secrets added before it goes green. |
| Rollback strategy | 🟡 | Vercel supports one-click rollback to any prior deployment natively; this has not been exercised or documented as a runbook step. |
| Dependency vulnerability scanning | ✅ | `.github/dependabot.yml` — weekly checks on npm + github-actions, minor/patch grouped, majors surfaced individually, every PR gated by CI. |

**Real incident, found and fixed this session**: adding Sentry's source-map upload (`withSentryConfig` wrapping `next.config.mjs`) silently broke every production deploy — Turbopack build crashed trying to resolve a webpack-only loader file, since Sentry's Turbopack source-map support needs `useRunAfterProductionCompileHook: true` set explicitly rather than relying on its documented "defaults true under Turbopack" auto-detection, which didn't fire correctly in Vercel's build environment. Production kept serving the last good deploy the whole time (no user-facing outage), but every deploy attempt after that commit failed until this was caught and fixed. The practical lesson: a clean local build doesn't prove a Vercel build will succeed when the failure is gated behind env vars (`SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT`) that only exist on Vercel, not locally — verify build-affecting third-party config changes via an actual preview deploy, not just `npm run build`.

## 7. Testing & QA

| Item | Status | Evidence / Gap |
|---|---|---|
| Unit/integration test suite | ✅ | 7 Vitest suites (`workspace`, `tasks`, `projects`, `economy`, `economy-simulation`, `passwordReset`, `billing`) run against a real Neon DB — 175 tests. |
| Checked-in E2E test suite | ❌ | Verification this session used one-off Playwright scripts in the scratchpad, never committed to the repo — no regression safety net for user-facing flows. |
| Email / Blob integration coverage | ❌ | `lib/email.js` and `lib/blob.js` have zero test coverage by design (documented external-I/O boundary), which is a reasonable trade-off but still a real gap. |
| Load / performance testing | ❌ | Never done — no data on how the app behaves under concurrent load. |

## 8. Accessibility & Internationalization

| Item | Status | Evidence / Gap |
|---|---|---|
| Baseline a11y pass | ✅ | Skip link, `:focus-visible` styles, locale-aware date formatting shipped earlier this session. |
| Formal WCAG audit | ❌ | No third-party or automated (axe/Lighthouse CI) audit has been run. |
| Internationalization (i18n) | ❌ | English-only; no translation framework. |

## 9. Support & Documentation

| Item | Status | Evidence / Gap |
|---|---|---|
| Internal architecture docs | ✅ | `ARCHITECTURE.md` — extensive, continuously updated. |
| Basic SEO metadata | 🟡 | Per-page `<title>` + root description exist (`app/layout.js`); no Open Graph/social preview images, no `sitemap.xml`/`robots.txt`. |
| End-user documentation / help center | ❌ | Doesn't exist. |
| In-app support / contact channel | ❌ | No way for a confused or stuck user to reach anyone from inside the app. |
| Public API docs | ❌ | N/A today — no public API surface (Server Actions only), but worth noting if one ever ships. |

## 10. Branding & Growth

| Item | Status | Evidence / Gap |
|---|---|---|
| Logo & visual identity | ✅ | Applied this session (header, favicon, auth pages). |
| Typography system | ✅ | Inter / Montserrat / Fira Code, applied via `next/font`. |
| Marketing/landing site | ✅ | Separate `aerion-software` marketing project exists outside this app. |
| Product usage analytics | ❌ | Only performance (Speed Insights) is tracked — no funnel/activation/retention analytics. |

---

## Bottom line

Aerion Software has moved from **internal-tool-grade MVP** to **commercially sellable**: real
multi-tenancy, tested business logic (175 tests against a real DB), error tracking + a
health-check endpoint, self-serve password recovery, a real legal baseline, dependency-update
automation, and live Stripe billing across 3 tiers, fully wired end-to-end including the webhook
and Customer Portal configuration. A production-blocking build failure (Sentry source maps vs.
Turbopack) was also found and fixed this session — see Section 6.

What's left is narrower and entirely operational, not architectural:

1. **No account-recovery/legal completeness beyond the baseline** (Sections 2–3) — no email
   verification, no 2FA, no self-serve data export or account/workspace deletion, no formal
   GDPR/CCPA cookie-consent posture. The Privacy Policy is honest about these gaps rather than
   promising them.
2. **Observability has no external uptime watcher yet** (Section 5) — Sentry catches errors,
   but nothing is polling `/api/health` from outside the app to detect a full outage.
3. **No E2E test suite or load testing** (Section 7) — the Vitest suite is real integration
   coverage against a live DB, but there's no browser-level regression net and no data on
   concurrent-load behavior.
4. **CI secrets still unconfirmed** (Section 6) — `DATABASE_URL`/`AUTH_SECRET` need to be set as
   GitHub repository secrets before `.github/workflows/ci.yml` goes green; not verifiable from
   this environment (no `gh` CLI/token), so status here is carried forward, not re-checked.

None of these block charging real customers. Recommended next, roughly in order of value: an
external uptime monitor pointed at `/api/health` (cheap, closes the last real observability gap)
→ account/workspace deletion + data export (the two data-protection items most likely to matter
to an actual paying customer) → a checked-in E2E suite for the flows that would hurt most if they
silently broke (signup, login, billing checkout).
