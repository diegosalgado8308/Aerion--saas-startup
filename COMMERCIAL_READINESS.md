# Commercial Readiness Matrix

A living scorecard of what stands between Aerion Software today and Aerion Software as a
sellable product with paying customers. Every row is graded against what's actually in the
repo/infra right now, not aspiration — re-audit this after any change that touches auth,
billing, data handling, or ops.

**Status key**: ✅ Done &nbsp;|&nbsp; 🟡 Partial &nbsp;|&nbsp; ❌ Missing

Last audited: 2026-08-15.

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
| Password reset / forgot password | ❌ | No flow exists. A locked-out or forgetful user has no self-serve recovery path today. |
| 2FA / MFA | ❌ | Not implemented. |

## 3. Data Protection, Privacy & Legal

| Item | Status | Evidence / Gap |
|---|---|---|
| Encryption in transit | ✅ | TLS end-to-end (Vercel, Neon `sslmode=require`). |
| Backups / disaster recovery | 🟡 | Neon provides point-in-time restore by platform default, but no restore drill has been run or documented — unverified in practice. |
| Data export / portability | ❌ | No self-serve "export my data" for a workspace. |
| Account / workspace deletion | ❌ | No delete-account or delete-workspace flow — data is retained indefinitely with no user-triggered erasure path. |
| Privacy Policy / Terms of Service | ❌ | No legal pages exist anywhere in the app. |
| Cookie consent / GDPR-CCPA posture | ❌ | Not addressed — a blocker for EU/CA users specifically. |

## 4. Billing & Monetization

| Item | Status | Evidence / Gap |
|---|---|---|
| Pricing page | ❌ | Doesn't exist. |
| Payment processor integration | ❌ | No Stripe (or equivalent) anywhere in `package.json` or the codebase. |
| Plan / subscription management | ❌ | Not implemented. |
| Usage limits / metering | ❌ | Not implemented — nothing gates a free vs. paid tier. |

The app currently has **zero monetization** — every feature is free and unmetered. This is the single largest gap between "working SaaS" and "commercial SaaS."

## 5. Reliability & Observability

| Item | Status | Evidence / Gap |
|---|---|---|
| Web Vitals monitoring | ✅ | `@vercel/speed-insights` wired into `app/layout.js`. |
| Error tracking (Sentry/equivalent) | ❌ | No error-tracking SDK. Runtime errors are only visible via manual `vercel logs` or ad hoc Playwright runs, not surfaced proactively. |
| Structured logging | ❌ | No logging library — relies on default `console`/platform logs. |
| Health-check endpoint | ❌ | No `/api/health` or equivalent for uptime monitors to poll. |
| Uptime monitoring / status page | ❌ | Nothing external is watching whether the site is up. |
| Alerting | ❌ | No alert channel (Slack/email/PagerDuty) configured for errors or downtime. |

If production breaks tonight, nobody — including you — gets told. This is the second-largest gap.

## 6. Deployment, CI/CD & Environments

| Item | Status | Evidence / Gap |
|---|---|---|
| Live production deployment | ✅ | https://aerion-software.vercel.app — verified end-to-end via real Playwright run. |
| Environment separation | ✅ | Dedicated Neon branches per environment (`production`, `preview`, `development`, `ci`) as of 2026-08-15. |
| CI pipeline (lint/test/build) | 🟡 | `.github/workflows/ci.yml` is live and triggers on push, but still needs `DATABASE_URL`/`AUTH_SECRET` repo secrets added before it goes green. |
| Rollback strategy | 🟡 | Vercel supports one-click rollback to any prior deployment natively; this has not been exercised or documented as a runbook step. |
| Dependency vulnerability scanning | ❌ | No Dependabot/Snyk config in `.github/`. |

## 7. Testing & QA

| Item | Status | Evidence / Gap |
|---|---|---|
| Unit/integration test suite | ✅ | 5 Vitest suites (`workspace`, `tasks`, `projects`, `economy`, `economy-simulation`) run against a real Neon DB. |
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

Aerion Software is a **solid, well-engineered internal-tool-grade MVP**: real multi-tenancy,
tested business logic, a live and monitored-for-performance deployment, environment hygiene
most side projects never bother with, and a finished visual identity. It is **not yet
commercially sellable**, for three concrete reasons, in priority order:

1. **No monetization** (Section 4) — there is currently no way to charge anyone anything.
2. **No observability or alerting** (Section 5) — a production outage would go silent.
3. **No account-recovery or legal baseline** (Sections 2–3) — no password reset, no email
   verification, no Privacy Policy/Terms of Service. Any of these will surface as a support
   fire or a compliance blocker the first week real customers show up.

Recommended order of attack when ready to pursue this: **(1) Privacy Policy + Terms of
Service** (cheap, unblocks everything else legally) → **(2) error tracking + a health-check
endpoint** (cheap, closes the "silent outage" risk) → **(3) password reset flow** → **(4)
billing integration**, roughly in that order, since each later item is more work than the one
before it.
