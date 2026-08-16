# Architecture

Engineering reference for how Aerion Software is put together: the layers requests pass through, and the external pieces the app depends on.

## Core Architectural Layers

### 1. Presentation (App Router UI)

- Next.js 16 App Router under `app/`, mixing React Server Components (default) with the client components under `components/` (`Header`, `SignOutButton`, `EconomyDiagramView`, `SimulationChart`, `BalanceReport`, `DiagramExportButtons`, `Toast`, `FormattedDate`, `LivePoll`).
- Pages are `async` Server Components that fetch their own data directly (`app/dashboard/page.js`, `app/projects/[id]/economy/[diagramId]/page.js`, etc.) — no client-side data-fetching layer sits in front of them.
- Branding: `public/logo-icon.png` (a manually-cropped square icon, no external image-processing dependency — cropped once via .NET's `System.Drawing` at asset-creation time, not at runtime) is the header brand mark (44px) and the favicon source (`app/icon.png`, Next's App Router auto-detected icon convention), and appears again at 112px above the heading on the login/signup pages. `public/logo-full.png` is the original wordmark asset, unused in the app itself so far. Both go through `next/image`, which is *why* the proxy static-asset bug (see **Routing & request gating**) surfaced — `next/image`'s optimizer fetches the source internally and got redirected HTML instead of image bytes.
- Typography: three Google Fonts, self-hosted via `next/font/google` (downloaded at build time, no runtime request to Google's CDN, no font-swap layout shift) — Inter for body/UI text (`--font`), Montserrat 700/800 for headings (`--font-heading`, applied to `h1`–`h4`), Fira Code for `code`/`pre` (`--font-mono`). Each is exposed as a CSS variable via `className` on `<html>` in `app/layout.js`, with the existing system-font stack kept as the fallback chain on each variable rather than replaced outright.
- One-time action feedback (`?error=`/`?sent=` query params set by a redirecting Server Action) renders via `<Toast>`, not a static page banner. Every page passes a server-generated `key={crypto.randomUUID()}` alongside the message — without it, two identical error strings in a row (e.g. retrying a failed login) wouldn't remount the component, so the already-dismissed/expired toast from the first occurrence would just stay hidden on the second.
- `<LivePoll>` (`app/projects/[id]/page.js` only, so far) calls `router.refresh()` on an interval — the app's stand-in for real-time multiplayer collaboration, since Vercel's serverless model has no long-lived connection to push updates through. `router.refresh()` re-fetches the Server Component tree's data but preserves client-side state (e.g. text already typed into the "new task" field), so a background poll doesn't clobber in-progress input. It's power-aware, not a flat interval: 5s while the user is actively present, backing off to 20s if the browser signals a data-saving preference or 30s after 60s of no interaction, skipping the network call entirely while the tab is hidden and refreshing immediately on regaining visibility instead of waiting out an interval. `router`/`intervalMs` are read through refs kept current by their own small effect, not as the polling effect's own dependencies — depending on `router` directly caused a real bug during development: `router.refresh()` triggers a re-render, which tore the effect down and rebuilt it every single poll cycle, resetting the idle clock back to "now" each time and silently defeating the back-off entirely (all polls stayed at 5s forever, no error, no crash — only caught by explicitly logging the internal state and watching it over a 70s+ run).

### 2. Routing & request gating

- File-based routing via the App Router (`app/<route>/page.js`, dynamic segments like `[id]`, `[diagramId]`, `[taskId]`).
- `proxy.js` is the auth gate for session-based routes: it runs `auth()` from NextAuth and redirects to `/login` for any path not in `PUBLIC_PATHS` (`/`, `/login`, `/signup`). Separately, `config.matcher` excludes a few paths from the proxy *entirely* — those routes have no user session to check in the first place and enforce their own auth instead: `api/auth` (NextAuth's own handlers) and `api/cron` (bearer-token-secured, see below). It also excludes any request for an actual static file (`.*\.\w+$` — logo images, the generated favicon route, `robots.txt`, etc.), added after a real bug: before this, a `public/` asset referenced by a *public* page (e.g. the header logo, visible on the logged-out `/login`/`/signup` pages) got 302-redirected to `/login` for logged-out visitors instead of served — not an error, just a broken image, which is why it went unnoticed until the app's first real `public/` asset (the logo) was added. The placeholder SVGs `create-next-app` ships with were never actually referenced by anything, so this had no prior chance to surface.
- Three API routes exist today: `app/api/auth/[...nextauth]` (NextAuth's credentials sign-in handlers), `app/api/economy/[diagramId]/export` (JSON diagram export, session-gated via `proxy.js` like any other page), and `app/api/cron/task-reminders` (the due-date reminder sweep, gated by `CRON_SECRET` instead of a session since it's triggered by Vercel Cron, not a browser).

### 3. Mutation boundary (Server Actions)

- Writes go through `"use server"` functions defined inline in each page (e.g. `handleCreateProject`, `handleAddNode`, `handleAddConnection` in the economy diagram page).
- Each action re-derives the session, delegates to a `lib/` domain function, and either `revalidatePath`s the current route or `redirect`s — pages never call Prisma directly.

### 4. Domain logic (`lib/`)

- `workspace.js`, `projects.js`, `tasks.js`, `economy.js` — validation and workspace-scoped CRUD, all raising a shared `ValidationError` that pages translate into `?error=` redirects.
- `economy-simulation.js` — pure, DB-free functions (`runSimulation`, `analyzeBalance`) with no side effects, which is why they're the most exhaustively unit-tested part of the codebase (`lib/__tests__/economy-simulation.test.js`).
- This is the layer that owns business rules; everything above it is either presentation or plumbing.

### 5. Data access

- `lib/prisma.js` constructs a single `PrismaClient`, cached on `globalThis` in development to survive hot reload.
- All workspace-scoped reads/writes go through Prisma — no raw SQL elsewhere in the app.

### 6. Persistence

- PostgreSQL, hosted on Neon (serverless Postgres), schema-managed by Prisma (`prisma/schema.prisma`, `prisma/migrations/`).
- Core entities: `Workspace` → `User`/`Project` → `Task` (→ `Comment`/`Attachment`) / `EconomyDiagram` → `EconomyNode`/`EconomyConnection`/`EconomyLayer`, all scoped by `workspaceId` at the top of the tree.
- `Project.goalFramework`/`goalStageValues` are the one place a `Json` column is used — see **Goal frameworks**, below, for why a free-form column fit better here than a relational table.

## Essential Integrations & Add-ons

Quick reference — details for each follow below.

| Integration | Role |
|---|---|
| **Neon Postgres** (`@neondatabase/serverless`) | Serverless Postgres — the actual database. |
| **`@prisma/adapter-neon`** | Driver adapter routing Prisma over Neon's connection, using `ws` as the WebSocket implementation (`neonConfig.webSocketConstructor = ws` in `lib/prisma.js`) since Neon's serverless driver needs WebSockets outside the browser. |
| **Prisma ORM 7** | Schema, migrations, and the generated client (output to `app/generated/prisma`, not the default `node_modules` location). Config lives in `prisma.config.ts`, not `schema.prisma`'s old `generator`/`datasource` block alone. |
| **NextAuth v5 (beta)** | Auth — Credentials provider only (email + bcrypt-hashed password), JWT session strategy, session enriched with `workspaceId`/`role` via the `jwt`/`session` callbacks in `lib/auth.config.js`. |
| **bcryptjs** | Password hashing for the Credentials provider. |
| **Vitest** | Unit tests (`lib/__tests__/`); `postinstall` runs `prisma generate` so the generated client is always present before tests/build. |
| **ESLint 9 + `eslint-config-next`** | Linting, flat config (`eslint.config.mjs`). |
| **Prisma skills** (`.claude/skills/`, `.agents/skills/`) | Bundled reference docs for Prisma CLI, Client API, Postgres setup, and v7 migration — available to any agent working in this repo. |
| **Resend** (`resend`) | Transactional email — workspace invites and due-date task reminders (`lib/email.js`). |
| **Vercel Blob** (`@vercel/blob`) | File storage for task attachments (`lib/blob.js`). |
| **Vercel Cron** (`vercel.json`) | Triggers the daily due-date reminder sweep — see `app/api/cron/task-reminders`. Only takes effect once deployed to Vercel; there's no local equivalent. |
| **Sentry** (`@sentry/nextjs`) | Error tracking + source maps, provisioned via the Vercel Marketplace integration. `instrumentation.js`/`instrumentation-client.js`/`sentry.server.config.js`/`sentry.edge.config.js`. |
| **Stripe** (`stripe`) | Subscription billing — hosted Checkout + Customer Portal, no Stripe.js on-page (`lib/stripe.js`, `lib/billing.js`), also provisioned via the Vercel Marketplace integration. |

### 1. Neon Postgres

- The database itself: serverless, branchable Postgres. There is no locally-run Postgres in this project — even `npm run dev` talks to a real hosted Neon instance over the network via `DATABASE_URL`.
- Because it's serverless, connections aren't a static TCP socket held open the way a traditional Postgres client expects — which is why it needs its own driver rather than the standard `pg` client (see the adapter below).

### 2. `@prisma/adapter-neon` + `ws`

- Prisma ORM 7 moved to a **driver adapter** model: Prisma no longer opens its own connection from a `url` in `schema.prisma` — notice `datasource db { provider = "postgresql" }` in `prisma/schema.prisma` has no `url` field at all. Instead, `lib/prisma.js` constructs a `PrismaNeon` adapter directly (`new PrismaNeon({ connectionString: process.env.DATABASE_URL })`) and hands it to `new PrismaClient({ adapter })`.
- `PrismaNeon` talks to Neon over WebSockets, which Node doesn't provide as a global by default — hence `ws` as a real runtime dependency, and `neonConfig.webSocketConstructor = ws` wiring it in before the client is created.
- The CLI (`prisma migrate`, `prisma studio`, etc.) doesn't go through this adapter — it reads `DATABASE_URL` directly via `prisma.config.ts`'s `datasource.url`. So there are, deliberately, two separate paths to the same database: the adapter for the running app, the config file for tooling.

### 3. Prisma ORM 7

- Schema lives in `prisma/schema.prisma`; migrations are timestamped folders under `prisma/migrations/` (currently: init, add-indexes, add-economy-diagrams, add-economy-layers, add-task-comments, add-task-due-reminder-sent-at, add-task-attachments — each migration name describes the feature that motivated it).
- The generated client is emitted to `app/generated/prisma` (set via `generator client { output = "../app/generated/prisma" }`), not `node_modules/@prisma/client`. `lib/prisma.js` imports from that path explicitly. `postinstall: "prisma generate"` in `package.json` guarantees this generated code exists after every `npm install`, even though it's not hand-written or (typically) hand-edited.

### 4. NextAuth v5 (beta)

- Split across two files on purpose: `lib/auth.config.js` exports a **provider-less** `authConfig` (session strategy, JWT/session callbacks, sign-in page) safe to import anywhere, while `lib/auth.js` wraps it with the actual `Credentials` provider (which needs `bcrypt` and Prisma — both Node-only).
- `proxy.js` imports only `authConfig` and calls `NextAuth(authConfig)` itself to get a lightweight `auth()` for route gating, deliberately avoiding pulling `bcryptjs`/Prisma into whatever runtime `proxy.js` executes in. Any new provider (OAuth, magic link, etc.) belongs in `lib/auth.js`, not `lib/auth.config.js`.
- Session strategy is JWT, not database-backed sessions — there's no `Session` table in `schema.prisma`. Everything the app needs from a session (`id`, `workspaceId`, `role`) is copied into the token at sign-in via the `jwt` callback and read back out via the `session` callback, so a session is only as fresh as the token — updating a user's `role` after login won't be reflected until they get a new token.

### 5. bcryptjs

- Pure-JavaScript bcrypt implementation (as opposed to the native-binding `bcrypt` package) — used both to hash passwords on signup (`lib/workspace.js`) and to verify them in the Credentials provider's `authorize` (`lib/auth.js`). Being pure JS avoids native-module build/runtime compatibility issues, at some cost to hashing speed versus the native package.

### 6. Vitest

- The test runner for everything under `lib/__tests__/`. Configured for a real-database, integration-style workflow rather than isolated unit mocking — see **Testing strategy** below for how that shapes the tests themselves.

### 7. ESLint 9 + `eslint-config-next`

- Flat config (`eslint.config.mjs`) — ESLint 9's config format, not the older `.eslintrc`. `eslint-config-next` layers in Next.js's recommended rules (React hooks, App Router conventions, etc.) on top.

### 8. Prisma skills bundle

- `.claude/skills/` and `.agents/skills/` ship the same set of Prisma reference skills twice, once per agent-tooling convention (Claude Code vs. the more general `.agents/skills` layout some tools read). They cover CLI usage, the Client API, Postgres setup, Compute deployment, driver-adapter implementation, and the v6→v7 migration — background knowledge any agent should pull in before touching `prisma/` or `lib/prisma.js` rather than guessing at v7 syntax from older training data.

### 9. Resend

- `lib/email.js` wraps two email types: `sendInviteEmail` (workspace invites, triggered from `app/team/page.js`) and `sendTaskDueReminder` (triggered from the cron route). Both share one lazily-constructed `Resend` client and one `FROM` address (`RESEND_FROM_EMAIL`, defaulting to Resend's own sandbox address so sending works before a custom domain is verified).
- Deliberately fails loud with a plain `Error` — not a `ValidationError` — when `RESEND_API_KEY` is missing, since a missing API key is a configuration problem, not user input. Callers (`handleInviteByEmail`, the cron route) catch it generically alongside `ValidationError` rather than letting it crash the request, since "email didn't send" shouldn't take down the page that triggered it.
- Untested by the Vitest suite, same as Vercel Blob below — sending a real email is an external side effect outside what the DB-backed integration tests exercise. Confirmed working end-to-end manually instead: the invite flow and the cron route both correctly show a graceful failure message when `RESEND_API_KEY` isn't set, which is the only path that's actually exercisable without a real key.

### 10. Vercel Blob

- `lib/blob.js` wraps `put`/`del` from `@vercel/blob` for task attachments. Uploads go through a plain `<form action={serverAction}>` on the task detail page — the file arrives as a `File` inside `FormData`, no separate token-endpoint/client-upload flow needed, since attachments are expected to be small enough for a normal Server Action body.
- That's *why* `next.config.mjs` raises `experimental.serverActions.bodySizeLimit` to `10mb` — Server Actions default to a much smaller limit, and it needs to stay in sync with `MAX_ATTACHMENT_BYTES` in `lib/blob.js` (both are commented pointing at each other).
- Files are stored with `access: "public"` — anyone with the URL can fetch it, no auth check at the Blob layer. The access control is entirely at the *listing* level: only workspace members can see a task's attachment URLs in the first place, via the same `require*InWorkspace` pattern as everything else.
- Deleting an attachment deletes the DB row first, then the Blob file as a best-effort follow-up (`.catch(() => {})` in the page's action) — so a Blob-side failure never leaves a dangling DB reference, at the cost of occasionally orphaning a file in storage.

### 11. Vercel Cron

- `vercel.json` schedules `GET /api/cron/task-reminders` once daily (`0 13 * * *`). This is inert locally and in any non-Vercel deployment — cron triggering is a Vercel platform feature, not something `next dev`/`next start` provide on their own. Trigger it manually (e.g. `curl` with the `Authorization: Bearer $CRON_SECRET` header) to test the sweep outside of Vercel.
- The route has no session — Vercel's cron trigger doesn't carry a user cookie — so it sits outside `proxy.js`'s auth gate entirely (excluded via `config.matcher`) and checks `CRON_SECRET` itself instead. See the **Routing & request gating** constraint above.

### 12. Sentry

- Provisioned via `npx vercel integration add sentry` (Vercel Marketplace), not hand-created — this auto-generates a real Sentry org/project and writes `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` into Vercel's env vars for all three environments (a sandbox-claim step in the browser was needed once, mirroring how Stripe's install works — see below).
- `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ... })` is called unconditionally in `sentry.server.config.js`/`sentry.edge.config.js`/`instrumentation-client.js` — an unset DSN is a documented Sentry SDK no-op, not a throw, so this is safe in any environment without a Sentry project (local dev before this was set up, a fresh clone, etc.).
- `next.config.mjs`'s CSP `connect-src` needed three separate `*.ingest.sentry.io`/`*.ingest.us.sentry.io`/`*.ingest.de.sentry.io` patterns, not one `*.sentry.io` wildcard — CSP wildcards match one label, and Sentry's real ingest host (`o<org>.ingest.us.sentry.io`) is four labels deep. Missing this would have made the browser SDK silently drop every event with no visible error.
- `next.config.mjs` wraps with `withSentryConfig` for source-map upload — deliberately *not* added when Sentry was first wired up (an invalid/missing auth token can hard-fail the build depending on plugin version, and there was nothing but a placeholder to give it at the time), added once the Marketplace integration produced a real `SENTRY_AUTH_TOKEN`. Requires `@sentry/nextjs` ≥ 9.9.0 and Next.js ≥ 15.3.0-canary.8 for full Turbopack support — both cleared.
- `app/global-error.js` is the one error boundary that catches failures in the root layout itself (e.g. `app/layout.js`'s own `auth()` call throwing) — no other boundary sees those, since it replaces the entire `<html>`/`<body>`.

### 13. Stripe

- Also provisioned via the Vercel Marketplace CLI (`npx vercel integration add stripe`), which for Stripe specifically creates a **sandbox** resource that needs a one-time claim in the browser (`vercel integration resource claim <name>`) to link it to a real Stripe account — a step Sentry's install didn't need. `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` land as **Sensitive**-type Vercel env vars, which — unlike the Sentry vars — can't be read back via `vercel env pull` or the API once set, by design; there's no way to copy a value between environments, only reconnect the resource to whichever environments need it (`vercel integration resource connect <resource> <project> -e development`, etc.).
- Hosted Checkout (`stripe.checkout.sessions.create({ mode: "subscription", ... })`) + the Customer Portal (`stripe.billingPortal.sessions.create`), not embedded Stripe.js/Elements — the CSP (see Sentry above, and the firewall section below) has zero external hosts anywhere; embedding would need `js.stripe.com` in `script-src`, a new `frame-src`, and `api.stripe.com` in `connect-src`, a permanent attack-surface expansion for in-page card entry this app doesn't need. Both Stripe products are pure top-level redirects — zero CSP changes.
- `STRIPE_PRICE_PRO`/`STRIPE_PRICE_BUSINESS` (the actual $19/$49 monthly recurring Stripe Price IDs) are separate, non-sensitive env vars set by hand after a one-off script created the Products/Prices via the Stripe API — the Marketplace integration provisions API keys, not a product catalog.
- `lib/billing.js`'s `syncSubscriptionFromStripeEvent` re-derives `plan` from the subscription's Price ID on every `customer.subscription.updated` event, not just on status changes — this is also how a Customer-Portal-initiated Pro↔Business switch gets picked up. Note the current Stripe API ("Basil," 2025-03-31+) moved `current_period_end` off the Subscription object onto each `SubscriptionItem` (`items.data[0].current_period_end`) — a real, previously-common bug source in Stripe integration code written against older API versions.
- Billing enforcement (`assertCanAddMember`/`assertCanCreateProject`/`assertStorageQuota`/`assertEconomyToolEntitlement`) is check-then-act with no transaction/lock, same as the pre-existing `MAX_NODES_PER_DIAGRAM`-style caps in `lib/economy.js`/`lib/tasks.js` — accepted for the same reason: pricing is flat per workspace, not usage-metered, so a workspace transiently one-over its cap costs nothing. Never retroactive either — falling below a new lower limit after a downgrade/cancellation never removes existing members/projects/data, only blocks new creation.
- `ValidationError` was extracted from `lib/workspace.js` into `lib/errors.js` (re-exported from `workspace.js` for every existing call site) specifically to let `lib/billing.js` use it without a `workspace.js` ⇄ `billing.js` circular import, since `joinWorkspaceViaInvite` needed to call `assertCanAddMember`. Real footgun hit during this: `export { X } from "module"` is a pure re-export with **no local binding** — `workspace.js`'s own `throw new ValidationError(...)` calls need `import { ValidationError } from "@/lib/errors"` too, not just the re-export, or every one of that file's own functions throws `ReferenceError: ValidationError is not defined` instead.
- **Manual step, not something this code sets up**: the Stripe Dashboard's Customer Portal only allows cancellation by default — "update subscription" (Pro↔Business switching) needs explicitly enabling with both Prices allow-listed, or a customer can only cancel, not switch, even though the code correctly requests it.
- `vitest.setup.js` was changed to load `.env.local` on top of `.env` (Next.js's own precedence) — plain `dotenv/config` only loaded `.env`, which made `STRIPE_PRICE_PRO`/`STRIPE_PRICE_BUSINESS` (and Sentry's vars) invisible to tests even though the running app has them via Next's own loader. Caught by `billing.test.js` failing with the price-derived plan silently staying unchanged rather than an obvious error.

### Notable constraints from this stack

- Because the Prisma client is generated to a custom path (`app/generated/prisma`), any tooling that assumes the default `node_modules/@prisma/client` location needs the `output` override from `schema.prisma` in mind.
- The Neon adapter's WebSocket requirement means `ws` is a runtime dependency, not just a dev convenience — dropping it breaks the DB connection outside environments with native WebSocket support.
- `proxy.js` is the *only* place session-based access is blocked; any new route is protected by default, but a new *public* route must be added to `PUBLIC_PATHS` explicitly. A route that needs to bypass session auth entirely (like the cron route, which has no session to check) instead needs adding to `config.matcher`'s exclusion — and must then enforce its *own* auth inside the handler, the way `api/cron/task-reminders` checks `CRON_SECRET`. Forgetting that second part is the actual footgun: excluding a route from the matcher without adding equivalent auth inside it leaves a genuinely open endpoint.

## Cross-cutting: multi-tenancy, authorization & login security

Every domain entity hangs off a `Workspace`, and every `lib/` module enforces that boundary the same way rather than relying on a global query filter:

- Each mutation/read in `workspace.js`, `projects.js`, `tasks.js`, and `economy.js` takes an explicit `workspaceId` (pulled from `session.user.workspaceId`, never from client input) and calls a `require*InWorkspace` guard (`requireProjectInWorkspace`, `requireDiagramInWorkspace`, `requireNodeInWorkspace`, etc.) before touching the row.
- These guards walk the relation chain back to `Workspace` and throw `ValidationError` — surfaced to the user as "not found," not "forbidden" — if the record belongs to a different workspace. A missing row and someone else's row are deliberately indistinguishable to the caller.
- There is no row-level security at the database layer — the guarantee lives entirely in this repeated `lib/` pattern. A new domain module that queries Prisma directly without going through the equivalent guard reintroduces a cross-tenant access bug.
- `role` (`OWNER` / `MEMBER`) exists on `User`, flows into the session via the `jwt`/`session` callbacks, and gates the one owner-only action: `removeMember` (`lib/workspace.js`) rejects the call server-side unless the acting user's stored `role` is `OWNER` — `app/team/page.js` also checks `session.user.role === "OWNER"` client-side to decide whether to render the "remove" control at all, but the enforcement that actually matters is the one in `lib/workspace.js`. No other `lib/` function branches on role today; everywhere else, workspace membership alone is the access boundary.
- `verifyCredentials` (`lib/workspace.js`) is the single entry point for password verification, called from the Credentials provider's `authorize`. It locks an account for 24 hours after 8 consecutive failed attempts (`User.failedLoginAttempts`/`lockedUntil`) and returns `null` indistinguishably for a nonexistent account, a wrong password, or a currently-locked account — this is the same "don't reveal why" principle as the workspace guards above, applied to auth instead of tenancy. Known trade-off, documented in the function itself: attempt-based lockout without per-IP tracking is itself abusable (an attacker can lock out someone else's account on purpose, and a 24-hour window makes that meaningfully more disruptive than a short one); that's accepted here rather than adding IP-based limits, which would need request context this DB-only function doesn't have.
- `lib/passwordReset.js` (`app/forgot-password`, `app/reset-password`) is the self-serve recovery path the lockout above previously had none of. `requestPasswordReset` applies the exact same "don't reveal why" principle a third time: it resolves identically whether the email matches an account or not, and whether the notification email actually sends or not (a delivery failure is logged server-side via `console.error`, never surfaced to the caller) — showing a different outcome for any of those would hand an attacker an account-enumeration oracle. The token itself is `crypto.randomBytes(32)`, stored as `sha256(token)` (`User.resetTokenHash`, `@unique`) rather than bcrypt: unlike a password, the token is already 256 bits of high entropy, so a deterministic-but-fast hash is fine, and it's what makes a direct `@unique` lookup possible at all (bcrypt's per-call salt isn't queryable that way). A successful reset also clears `failedLoginAttempts`/`lockedUntil` — completing one is a stronger proof of email ownership than the lockout was ever guarding against, and it's the only way a locked-out user recovers today. Known gap, not addressed here: sessions are JWT-only with no server-side session table (see NextAuth v5 above), so a reset can't force-invalidate any other device's already-issued session token.

## Firewall & network defense

"Add a firewall" for this app means four conceptually different layers. Two of them are real,
concrete work items in a Vercel-serverless app; two of them don't exist here — there's no
persistent kernel, NIC, or OS instance this project controls, so "add XDP/eBPF rules" or "add
an OS firewall" has no target to attach to. Documented honestly below rather than faked.

### 1. Embedded application-level firewall (in `next.config.mjs`)

Response headers that constrain what a browser will do with this app's pages regardless of what
any other layer does — the app's own first line of defense, shipped in code:

- `Content-Security-Policy` — `default-src 'self'`, no external script/style/frame/image
  sources (except `data:`/`blob:` where the app actually needs them, and the Vercel Blob
  storage host for attachment images), `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'none'`, `form-action 'self'`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a locked-down `Permissions-Policy`, and HSTS
  (`max-age=63072000; includeSubDomains; preload`).
- **Known trade-off**: `script-src`/`style-src` keep `'unsafe-inline'` because Next.js injects
  its own inline hydration payload on every page; removing it needs a per-request nonce
  generated in `proxy.js` and threaded through every page, which is real complexity this app
  doesn't currently justify — there's no `dangerouslySetInnerHTML` anywhere in the codebase, so
  there's no stored-XSS surface a stricter `script-src` would actually be defending against.
  Revisit if that changes. Verified locally against a production build (`next build && next
  start`): all headers present, full signup→dashboard flow works, zero CSP-caused console
  errors.
- This layer also includes what was already documented above under **Cross-cutting**: the
  `require*InWorkspace` tenant-isolation guards and `verifyCredentials`'s 8-attempt/24-hour
  account lockout. Those are "embedded firewall" too — access-control logic living inside the
  app rather than in front of it.

### 2. Web Application Firewall (Vercel Firewall — Web & API layer)

Two custom rules staged via `vercel firewall rules add` (Hobby plan supports custom rules and IP
blocking; only "system bypass" needs Pro). **Staged, not yet published** — drafts don't affect
live traffic until `vercel firewall publish --yes` is run:

- **`Block exploit probes`** (`rule_block_exploit_probes_yzhJ6t`) — logs any request for
  `/wp-admin`, `/wp-login.php`, `/.env`, `/.git/config`, `/phpmyadmin`, `/xmlrpc.php`,
  `/.aws/credentials`, `/vendor/phpunit`, or a `../` traversal attempt. This app is neither
  WordPress nor PHP, so real traffic never hits these — a request for any of them is a
  vulnerability scanner, full stop.
- **`Rate limit auth POSTs`** (`rule_rate_limit_auth_pos_ts_8CqmX7`) — logs (doesn't yet block)
  when one IP sends more than 20 POSTs to `/login` or `/signup` in 60 seconds. This is the
  direct answer to the gap flagged in **Cross-cutting** above: `verifyCredentials`'s lockout is
  per-account with no IP context because it's a DB-only function; the WAF sits in front of the
  request and *has* IP context, closing that gap without touching the app-level function at all.
- Both rules are set to `log` action, per the firewall skill's staged-rollout guidance — logging
  records matches without blocking anything, so publishing them now is safe. Review traffic at
  `https://vercel.com/diegosalgado8308s-projects/aerion-software/firewall/traffic?filter=<rule-id>`
  before tightening `Rate limit auth POSTs` from `log` to `rate_limit`/`deny`. Run `vercel
  firewall publish --yes` to make the log rules active, then `vercel firewall diff` any time to
  see what's still staged.

### 3. Kernel & network-level packet filtering (XDP/eBPF) — not applicable here

XDP/eBPF programs attach to a Linux kernel's network stack on a machine you administer. This app
has no such machine — Vercel Functions are ephemeral and stateless, with no persistent kernel or
NIC this project has access to attach anything to. The real equivalent at this layer is Vercel's
own **automatic DDoS mitigation**: on by default for every project on every plan including
Hobby, covers L3/L4/L7 attacks, not billed for blocked traffic, and requires zero configuration
— there's nothing to "add" because it's already running.

### 4. Software-managed OS firewall (Windows/Linux) — not applicable here

Same root cause: production has no OS instance to configure `iptables`/`nftables`/Windows
Defender Firewall rules on. The only real OS in this project's world is the developer's own
Windows machine running `next dev`, which is already governed by Windows Defender Firewall by
default and only ever binds the dev server to `localhost`/the local network — there's nothing
exposed there to lock down further.

## Goal frameworks

A project can optionally adopt one of 8 goal-planning frameworks (PACT, RTF, SOLVE, TAG, RACE, DREAM, CARE, RISE), each breaking a project's goal into a small ordered set of labeled stages (e.g. PACT → Problem, Approach, Compromise, Test) with an independently-editable text field per stage.

- **Content-integrity note, not just an implementation detail**: `lib/goalFrameworks.js`'s stage breakdowns are this app's own interpretation — only PACT has real external provenance as a goal-setting methodology (and even that's been product-customized here to Problem/Approach/Compromise/Test, not the original Purposeful/Actionable/Continuous/Trackable). The other 7 don't have one standardized "goal framework" meaning to defer to — RACE, for instance, is far better known as a digital-marketing funnel (Reach-Act-Convert-Engage) than as a goal methodology. The stage names were drafted as a plausible interpretation and confirmed with the product owner before being built, specifically to avoid presenting invented content as if it were an established external methodology.
- **Static config, not user-customizable**: the 8 frameworks and their stages are a hardcoded object in `lib/goalFrameworks.js`, not database rows. Adding a 9th framework or changing a stage label is a code change, not an admin action — there's no UI for defining custom frameworks.
- **Storage**: `Project.goalFramework` (a key into `GOAL_FRAMEWORKS`, nullable) and `Project.goalStageValues` (`Json`, defaulting to `{}`) — a relational per-stage table was considered and rejected, since a project has at most one active framework and stage values are simple key→text pairs with no independent identity or querying needs of their own.
- **Switching frameworks resets `goalStageValues` to `{}`** (`setProjectGoalFramework`, `lib/projects.js`) — deliberately, since stage keys mostly don't carry meaning across frameworks (RACE's `checkin` has no PACT equivalent), so silently carrying values over would misattribute them. Re-submitting the *same* framework is a no-op on stage values, specifically guarding against the "switch" form being resubmitted unchanged and accidentally wiping everything already filled in.
- **Partial-failure handling**: `updateProjectGoalStages` validates every submitted stage key belongs to the project's current framework *before* writing anything, so a request with one bad key changes nothing rather than saving the valid fields and silently dropping the invalid one.

## Accessibility & internationalization

Scoped narrowly and honestly — this is not a full a11y audit or an i18n system, just the concrete gaps that were fixed:

- **Skip link** — `app/layout.js` renders a visually-hidden-until-focused `<a href="#main-content">` before the header, landing on `<main id="main-content">`. Lets keyboard/screen-reader users bypass the header nav on every page.
- **Focus visibility** — `.field input/select/textarea` previously did `outline: none` on `:focus` and relied on a border-color change alone as the only visible indicator. Now split: plain `:focus` still gets the border-color change (any click), but `:focus-visible` additionally gets a real 2px outline (keyboard navigation specifically). A second, general `a/button/input/select/textarea:focus-visible` rule in `globals.css` covers interactive elements that live outside a `.field` wrapper (e.g. `.status-select`), which the field-scoped rule doesn't reach.
- **Toast `aria-live`** — see **Presentation**, above; errors announce as `role="alert"`/`aria-live="assertive"`, success as `aria-live="polite"`.
- **Locale-aware dates, honestly scoped** — `<FormattedDate>` (`components/FormattedDate.js`) is a client component that formats with `Intl`'s default (no explicit locale), which resolves to the *visitor's* browser locale. This only works because it's a client component — the same call in a Server Component would resolve to the *server's* locale, not the visitor's, which is why this couldn't just be a one-line fix to the old server-rendered `formatDate`/`formatDateTime` helpers. It renders with `suppressHydrationWarning`, the standard React pattern for values that are expected to legitimately differ between the server-rendered HTML and the client's re-render.
- **Cron reminder emails don't get the same treatment** — there's no per-user locale stored anywhere in this app (no `User.locale` field, no `Accept-Language` capture at signup), so an email has no real "visitor" to defer to the way a page render does. `app/api/cron/task-reminders/route.js` uses ISO 8601 (`YYYY-MM-DD`) instead — not personalized, but unambiguous to every reader, which a hardcoded `"en-US"` MM/DD format was not.
- **What this is *not*** — no translated strings anywhere (all UI text is hardcoded English), no RTL support, no locale-based routing. A real i18n system would need a translation library, a strings catalog, and a way to know the user's *content* language preference (not just their number/date formatting locale, which `Intl` gives you for free) — none of that exists here.

## UI layout architecture

"Game UI & HUD layout architecture," "desktop/web layout frameworks," "resolution
independence," and "industry-standard layout tools" are four game-dev framings of the same
underlying question: does the interface keep working — every control reachable, nothing
clipped — at every screen size? Audited by actually loading the authenticated app (dashboard,
team, project board, task detail, economy diagrams) at 375px, 768px, 1440px, and 2560px in a
real browser rather than assuming. Two real bugs turned up; one design already matched the
industry-standard technique for its job.

- **HUD-style persistent navigation, fixed** — below 900px, `.header-nav` ("Projects"/"Team")
  was hidden by CSS with *no replacement*: primary navigation was completely unreachable on any
  phone or tablet except via the dashboard link or the browser back button. A HUD element that
  disappears below some resolution rather than relocating is exactly the failure mode this
  category of bug is named after. Fixed with `components/MobileNavToggle.js` — a small client
  component rendering a toggle button + dropdown panel (Projects, Team, the signed-in user's
  name, sign out) that only renders below the same 900px breakpoint, with outside-click and
  `Escape`-to-close handling. `.header-actions` (the desktop user-chip/sign-out row) hides at the
  same breakpoint via a `.header-actions--authed` modifier class, so the two never show at once.
  Verified interactively (toggle opens, links work), not just checked for DOM presence.
  - **Real subtlety hit while building this**: `SignOutButton.js` is a Server Component with an
    inline `"use server"` action. Importing it directly into `MobileNavToggle.js` (a Client
    Component) broke the build — Next.js doesn't allow an inline server action inside a Client
    Component's own module graph. Fixed via composition: `Header.js` (a Server Component) renders
    `<SignOutButton />` and passes the *element* down as a `signOutSlot` prop, so
    `MobileNavToggle.js` never imports `SignOutButton.js` at all, it just renders whatever JSX
    it's handed. This is the officially-recommended pattern for mixing Server and Client
    Components, not a workaround.
  - **A second, easy-to-repeat mistake caught in the same fix**: the first version of the CSS put
    the component's default `.mobile-nav { display: none; }` rule *after* the `@media (max-width:
    900px) { .mobile-nav { display: block; } }` override in the file. Same specificity, later
    source position wins regardless of the media query matching — so the toggle silently never
    appeared at any width. Fixed by moving component base styles before the `Responsive` section,
    matching this file's existing convention (breakpoint overrides go last, so they reliably win).
- **Clipped content, fixed** — `.table-card` (wraps the Team page's members table) used
  `overflow: hidden`, originally to clip the card's own rounded corners. Combined with a long
  email address on a narrow screen, that also silently clipped the content itself — invisibly,
  with no scrollbar, no ellipsis, no way to reach the missing characters. Changed to `overflow-x:
  auto; overflow-y: hidden` — corners still clip correctly, but wide content becomes reachable by
  scrolling instead of disappearing. Verified via `scrollWidth > clientWidth` after the fix.
- **Resolution independence for the canvas-like surface, already correct** —
  `components/EconomyDiagramView.js` renders the economy diagram as an SVG with `viewBox` set to
  its content's own coordinate space, wrapped in `.diagram-scroll { overflow-x: auto }`. This is
  the actual industry-standard technique for scalable canvas content (the same principle a game
  UI's reference-resolution + scale-factor system solves) — the diagram's internal layout math
  (`NODE_W`/`COL_GAP`/`ROW_GAP` in that file) never needs to know the viewport size at all. No
  change needed here; called out because it's a correct instance of the exact thing the other two
  bugs got wrong.
- **Desktop/web layout framework — already CSS Grid + Flexbox, no new framework introduced** —
  the app already uses a standard sticky-header app-shell (`.app-header { position: sticky; top:
  0; z-index: 50 }` with `backdrop-filter: blur`), CSS Grid for the Kanban board and multi-column
  forms, and Flexbox everywhere else, inside a `--max-width: 1120px` centered container. These
  *are* the current industry-standard tools for this job — introducing a dedicated layout library
  on top would be solving an already-solved problem.

Not covered, and correctly so: no spacing-token scale was added. `globals.css` uses ad hoc
pixel values for gaps/padding throughout; formalizing that into a `--space-1`…`--space-6` system
would touch nearly every rule in a 700+ line stylesheet for zero visual change, since nothing
currently needs the scale to be renamed, only used consistently. Worth doing if a real second
consumer of the values shows up (a second theme, a component library extraction) — not before.

## Memory: the heap and practical budgets

"The Heap (Dynamic & Large)" and "Practical Memory Budgets" are game-engine terms for the same
two ideas that apply directly here, not just by analogy:

- **The heap** — in a game engine, the heap is where big, dynamically-sized, long-lived data
  lives (loaded assets, dynamic arrays), as opposed to the stack (small, fixed-size, function-
  local). This app's real equivalent is exactly that split: Neon Postgres holds all structured,
  dynamically-growing data (users, projects, tasks, diagrams), Vercel Blob holds large binary
  data (attachments) that has no business living in a database row or a function's own memory,
  and neither ever gets fully loaded into a single function invocation's process memory at once
  — Prisma queries return only what a given page/action actually needs, and file uploads stream
  through `@vercel/blob` rather than buffering. The literal, physical version of "the heap" is
  each Vercel Function's own process memory: Standard instances (the default, including Hobby)
  get **2 GB / 1 vCPU** per invocation, with a **100 MB** platform-wide request body ceiling.
  Nothing here needed changing — verified this is the real ceiling in effect (see `vercel:
  vercel-functions` skill), not assumed from memory, since asserting a stale number would be
  worse than not checking.
- **Practical memory budgets — two real, previously-open gaps, now closed**. A "budget" in game
  dev is a concrete numeric ceiling a subsystem is designed against, not just "as much as it
  needs." This app already had two correct instances of that idea
  (`MAX_ATTACHMENT_BYTES`/`bodySizeLimit` = 10 MB per file in `lib/blob.js` +
  `next.config.mjs`; `MAX_NUMERIC_VALUE` = 1 billion per economy field in `lib/economy.js`; the
  simulation's `steps` already clamped to 500 in `simulateDiagram`) — but two matching *count*
  budgets were missing entirely:
  - **`MAX_NODES_PER_DIAGRAM` = 200, `MAX_CONNECTIONS_PER_DIAGRAM` = 500** (`lib/economy.js`) —
    `addNode`/`addConnection` had no ceiling on how many a single diagram could accumulate.
    `runSimulation` allocates one time-series array per node, `steps` entries long; with `steps`
    already capped but node count wide open, someone could still drive simulation memory,
    `EconomyDiagramView.js`'s SVG render cost, and the export endpoint's JSON payload arbitrarily
    high. 200 nodes × 500 steps keeps a worst-case run in the low tens of thousands of array
    slots — nowhere close to the real 2 GB ceiling above, and well past anything a human places
    by hand through the UI anyway.
  - **`MAX_ATTACHMENTS_PER_TASK` = 20** (`lib/tasks.js`) — each file was already capped at 10 MB,
    but nothing capped how many a single task could accumulate: unbounded real Vercel Blob
    storage cost (a genuine dollar-cost budget, not just a memory one) and an ever-growing list
    to render on the task detail page. 20 × 10 MB = a 200 MB/task ceiling.
  - Both follow the existing `ValidationError` pattern (same as every other guard in `lib/`) and
    use a plain `prisma.*.count()` check — cheap, indexed, no extra data fetched just to answer
    "how many."

## Testing strategy

- Vitest (`vitest.config.mjs`) runs in a plain Node environment with `testTimeout`/`hookTimeout` raised to 20s — generous because tests hit a **real Neon database**, not a mock or an in-memory substitute. `vitest.setup.js` just loads `.env` via `dotenv/config` so `DATABASE_URL` is available.
- Tests are integration-style against `lib/`: `lib/__tests__/helpers.js` provides `makeTenant()` (spins up a real `Workspace` + `OWNER` `User` via `createWorkspaceAndOwner`) and `cleanupWorkspace()` (cascading delete), so each test suite creates and tears down its own isolated tenant rather than sharing fixtures or truncating tables.
- `economy-simulation.js` is the one module tested as pure functions with in-memory fixtures (no DB, no tenant) — by design, per the comment at the top of that file — which is why it's the most exhaustively covered piece of logic in the repo (`lib/__tests__/economy-simulation.test.js`).
- `lib/email.js` and `lib/blob.js` are the opposite case: real external I/O with no Vitest coverage at all. `addAttachment`/`deleteAttachment` in `tasks.js` *are* tested (they're plain DB operations that happen to take already-uploaded metadata), but the upload/send calls themselves aren't. This is a real gap, not an oversight to fix casually — testing it for real means either a Resend/Blob sandbox account or mocking the SDKs, neither of which exists in this repo yet.
- There is no browser/E2E test suite in the repo; UI verification so far has been done ad hoc with Playwright driven manually against the dev server, not checked in as a repeatable test.
- CI (`.github/workflows/ci.yml`) runs this same test suite against a real database on every push/PR, which means it needs `DATABASE_URL` and `AUTH_SECRET` as GitHub repository secrets before it'll pass — see **Deployment status** below.
- **Dependency version management** — `.github/dependabot.yml` (added 2026-08-15) watches both `npm` and `github-actions` ecosystems weekly. Minor/patch npm bumps are grouped into a single PR to keep review load low; majors stay separate since they're the ones actually likely to break something (a future Prisma 8, for instance). Every Dependabot PR runs through the same CI workflow above before merge — it's not just a diff to eyeball, it's gated by the real test suite. Chose Dependabot over Renovate specifically because this is a single-package repo already on GitHub: no separate app/service to authorize, and Renovate's extra configurability (monorepo grouping, custom schedulers) solves problems this repo doesn't have. **One caveat**: `next-auth` is pinned to a `5.0.0-beta.x` prerelease — `npm outdated`'s "Latest" column shows `4.24.15` because that's what the `latest` dist-tag points to, not because 5.x is behind 4.x; Dependabot respects the `^5.0.0-beta.32` range in `package.json` and won't propose that downgrade, but it's a natural thing to double-take on if skimming `npm outdated` output directly. **Manual step still needed**: enabling *Dependabot security alerts* (separate from the version-update schedule above — it's a repo Settings → Security toggle, not something `dependabot.yml` controls) requires the GitHub web UI; not something settable via this CLI-only session.

## Configuration & environment

Environment variables, defined in `.env` (not committed) and loaded via `dotenv/config` for tests/tooling — `next dev`/`next build` load `.env` natively:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.js`, `prisma.config.ts` | Neon Postgres connection string for both the app's Prisma client and `prisma migrate`. |
| `AUTH_SECRET` | NextAuth (`lib/auth.js` via `authConfig`) | Signs/encrypts the JWT session. |
| `AUTH_TRUST_HOST` | NextAuth | Tells Auth.js to trust the deployment's host header — needed whenever the app isn't running on a NextAuth-recognized default host (e.g. behind a proxy or on a non-standard local port). |
| `RESEND_API_KEY` | `lib/email.js` | Authenticates with Resend. Without it, invite/reminder emails fail gracefully (see **Resend**, above) rather than sending. |
| `RESEND_FROM_EMAIL` | `lib/email.js` | Optional — the `From` address for outgoing email. Defaults to Resend's sandbox address if unset. |
| `APP_URL` | `lib/workspace.js` (`buildInviteUrl`), `app/api/cron/task-reminders` | Base URL used to build absolute links in emails (invite links, task links) — these can't be relative since email clients have no notion of "the current site." Defaults to `http://localhost:3000`. |
| `CRON_SECRET` | `app/api/cron/task-reminders` | Bearer token the cron route requires — see **Vercel Cron**, above. The route fails closed (rejects everything) if this isn't set at all. |
| `BLOB_READ_WRITE_TOKEN` | `lib/blob.js` (read implicitly by `@vercel/blob`) | Authenticates with Vercel Blob. Without it, attachment uploads fail gracefully rather than succeeding silently with no storage. Provisioned automatically for deployments linked to a Vercel project with Blob enabled; needs setting manually for local dev. |

## Code editor & IDE extensions

VS Code has a project-level mechanism for this (`.vscode/extensions.json`, added here); JetBrains IDEs don't — there's no equivalent file a WebStorm/IntelliJ project can commit to auto-prompt teammates, so the JetBrains list below is guidance only, not enforced by anything checked in.

### VS Code

`.vscode/extensions.json` recommends, and VS Code will prompt to install on first open:

| Extension | Why it's here |
|---|---|
| `Prisma.prisma` | Syntax highlighting, formatting, and autocomplete for `prisma/schema.prisma` — plain-text editing of that file misses errors this catches immediately. |
| `dbaeumer.vscode-eslint` | Surfaces the project's flat-config ESLint rules (`eslint.config.mjs`) inline instead of only at `npm run lint` time. |
| `vitest.explorer` | Runs/debugs individual tests from `lib/__tests__/` in the editor — useful given those tests hit a real Neon database and can be slow to run all at once from the CLI. |
| `mikestead.dotenv` | Syntax highlighting for `.env` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`). |

Deliberately **not** recommended: a Tailwind CSS extension (the app uses plain CSS — `app/globals.css` — no Tailwind in `package.json`) and Prettier (no `.prettierrc`; ESLint is the only enforced code-quality tool here). Recommending tooling for a stack the project doesn't use would just be noise.

### JetBrains (WebStorm / IntelliJ IDEA Ultimate)

No project file drives this — these are just the plugins worth having installed manually, matching the VS Code list where JetBrains has an equivalent:

- **Prisma** (JetBrains plugin) — same rationale as `Prisma.prisma` above.
- Node.js/ESLint support is bundled into WebStorm and IntelliJ Ultimate already (not a separate plugin) — it auto-detects `eslint.config.mjs`.
- There's no dedicated Vitest plugin with parity to the VS Code one as of this writing; tests are run via the built-in npm-scripts runner (`npm test`) or the terminal instead.

## Database & API management add-ons

### Database

| Tool | What it's for |
|---|---|
| **Prisma Studio** (`npx prisma studio`) | Already available for free — `prisma` is a devDependency. Opens a local GUI at `localhost` for browsing and hand-editing rows against the same `DATABASE_URL`, reading its connection via `prisma.config.ts` the same way `prisma migrate` does. No separate install or account needed. |
| **Neon Console** | Neon's own hosted dashboard for the project behind `DATABASE_URL` — branch creation/deletion, compute/autoscaling settings, connection pooling config, and query-level monitoring. This is infrastructure management Prisma Studio can't do; it lives entirely outside this repo. |
| **Neon CLI** (`neonctl`) | Not currently installed or used here. Worth reaching for only if branch management needs to be scripted — e.g. spinning up a fresh Neon branch per PR for isolated test databases — rather than clicked through the console by hand. |

### API management

Three HTTP API routes exist now (see **Routing & request gating**, above), but they're still narrow enough that a Postman/Insomnia collection or an API gateway would be overkill:

- `api/auth/[...nextauth]` — NextAuth's own handlers; not meant to be called directly.
- `api/economy/[diagramId]/export` — a single authenticated GET, already exercised by a plain `<a href download>` link in the UI. `curl -H "Cookie: ..."` is enough to poke at it manually.
- `api/cron/task-reminders` — a single bearer-token GET, easiest to test with a raw `curl -H "Authorization: Bearer $CRON_SECRET"` (see **Vercel Cron**, above) rather than any GUI tool.

Every actual *mutation* in the app still goes through Server Actions (see **Mutation boundary**), which aren't independently callable HTTP endpoints — a Postman collection can't reach them at all. Revisit this once there's a real public API surface (webhooks, a REST/GraphQL layer for external consumers) rather than a handful of narrow, already-manually-tested routes.

## Deployment status

**Live in production**: https://aerion-software.vercel.app — verified end-to-end (signup, login, session, project/task creation, logo, fonts, zero console errors) via a real Playwright run against the live URL, not just a build-succeeded check.

- **Vercel project** — linked (`vercel link`), `aerion-software` under the account's default team. `vercel.json`'s `buildCommand` runs `prisma migrate deploy && next build`, so pending migrations apply automatically before each production build. All required env vars are set on Vercel (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` — Production/Preview as Sensitive). **`DATABASE_URL` specifically must be the Postgres connection string** (`postgresql://user:pass@host/db`) from Neon's *Connection Details*, not the REST/Data API endpoint under Neon's *REST API* tab (`https://<endpoint>.apirest.<region>.aws.neon.tech/...`) — a different product Prisma can't use.
- **`DATABASE_URL` is split per environment via dedicated Neon branches** — Neon project `dark-feather-30915454` (`Aerion Software`) has four branches, each with its own connection string: `production` (`br-little-lake-au6dzrei`, the original branch) → Vercel Production, `preview` (`br-royal-block-au59sfid`) → Vercel Preview, `development` (`br-dark-sky-auvpu9me`) → Vercel Development *and* local `.env`, `ci` (`br-fragrant-pine-auz4wtku`) → the `DATABASE_URL` GitHub Actions secret. All three non-production branches were branched off `production` on 2026-08-15, so they start as a full copy (schema + data, including the `_prisma_migrations` history) and diverge independently from there — preview deploys, local dev, and CI runs can now write freely without touching real production data or colliding with each other. Create new branches (`neonctl branches create --parent production`) if these ever need resetting back to a clean copy of prod.
- **First deploy landed as production, not preview** — Vercel auto-promotes a project's very first deployment to production regardless of whether `vercel` (preview) or `vercel --prod` was run; this only applies to the first deploy. Subsequent `vercel` runs will correctly create preview deployments.
- **Vercel Cron** — now takes effect, since the project is actually deployed. First scheduled run is the real first-ever execution of the due-date reminder sweep outside manual `curl` testing.
- **Vercel Blob store** — confirmed provisioned and attached to this project via the Storage tab, so `BLOB_READ_WRITE_TOKEN` is a real, working token and attachment uploads work in production.
- **GitHub remote** — pushed to `https://github.com/diegosalgado8308/Aerion--saas-startup`, activating `.github/workflows/ci.yml` on push/PR. CI needs its own `DATABASE_URL` (the `ci` Neon branch above) and `AUTH_SECRET` set as repository secrets under Settings → Secrets and variables → Actions — without them the workflow runs but fails at the test/build step.
- No `Dockerfile` or other non-Vercel deployment path exists — this is a Vercel-shaped deployment by design (Cron and Blob are Vercel platform features the app already depends on), not a portable one.
