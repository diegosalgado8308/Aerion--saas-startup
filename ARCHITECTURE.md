# Architecture

Engineering reference for how Aerion Software is put together: the layers requests pass through, and the external pieces the app depends on.

## Core Architectural Layers

### 1. Presentation (App Router UI)

- Next.js 16 App Router under `app/`, mixing React Server Components (default) with the client components under `components/` (`Header`, `SignOutButton`, `EconomyDiagramView`, `SimulationChart`, `BalanceReport`).
- Pages are `async` Server Components that fetch their own data directly (`app/dashboard/page.js`, `app/projects/[id]/economy/[diagramId]/page.js`, etc.) — no client-side data-fetching layer sits in front of them.

### 2. Routing & request gating

- File-based routing via the App Router (`app/<route>/page.js`, dynamic segments like `[id]`, `[diagramId]`, `[taskId]`).
- `proxy.js` is the auth gate for session-based routes: it runs `auth()` from NextAuth and redirects to `/login` for any path not in `PUBLIC_PATHS` (`/`, `/login`, `/signup`). Separately, `config.matcher` excludes a few paths from the proxy *entirely* — those routes have no user session to check in the first place and enforce their own auth instead: `api/auth` (NextAuth's own handlers) and `api/cron` (bearer-token-secured, see below).
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

### Notable constraints from this stack

- Because the Prisma client is generated to a custom path (`app/generated/prisma`), any tooling that assumes the default `node_modules/@prisma/client` location needs the `output` override from `schema.prisma` in mind.
- The Neon adapter's WebSocket requirement means `ws` is a runtime dependency, not just a dev convenience — dropping it breaks the DB connection outside environments with native WebSocket support.
- `proxy.js` is the *only* place session-based access is blocked; any new route is protected by default, but a new *public* route must be added to `PUBLIC_PATHS` explicitly. A route that needs to bypass session auth entirely (like the cron route, which has no session to check) instead needs adding to `config.matcher`'s exclusion — and must then enforce its *own* auth inside the handler, the way `api/cron/task-reminders` checks `CRON_SECRET`. Forgetting that second part is the actual footgun: excluding a route from the matcher without adding equivalent auth inside it leaves a genuinely open endpoint.

## Cross-cutting: multi-tenancy & authorization

Every domain entity hangs off a `Workspace`, and every `lib/` module enforces that boundary the same way rather than relying on a global query filter:

- Each mutation/read in `workspace.js`, `projects.js`, `tasks.js`, and `economy.js` takes an explicit `workspaceId` (pulled from `session.user.workspaceId`, never from client input) and calls a `require*InWorkspace` guard (`requireProjectInWorkspace`, `requireDiagramInWorkspace`, `requireNodeInWorkspace`, etc.) before touching the row.
- These guards walk the relation chain back to `Workspace` and throw `ValidationError` — surfaced to the user as "not found," not "forbidden" — if the record belongs to a different workspace. A missing row and someone else's row are deliberately indistinguishable to the caller.
- There is no row-level security at the database layer — the guarantee lives entirely in this repeated `lib/` pattern. A new domain module that queries Prisma directly without going through the equivalent guard reintroduces a cross-tenant access bug.
- `role` (`OWNER` / `MEMBER`) exists on `User`, flows into the session via the `jwt`/`session` callbacks, and gates the one owner-only action: `removeMember` (`lib/workspace.js`) rejects the call server-side unless the acting user's stored `role` is `OWNER` — `app/team/page.js` also checks `session.user.role === "OWNER"` client-side to decide whether to render the "remove" control at all, but the enforcement that actually matters is the one in `lib/workspace.js`. No other `lib/` function branches on role today; everywhere else, workspace membership alone is the access boundary.

## Testing strategy

- Vitest (`vitest.config.mjs`) runs in a plain Node environment with `testTimeout`/`hookTimeout` raised to 20s — generous because tests hit a **real Neon database**, not a mock or an in-memory substitute. `vitest.setup.js` just loads `.env` via `dotenv/config` so `DATABASE_URL` is available.
- Tests are integration-style against `lib/`: `lib/__tests__/helpers.js` provides `makeTenant()` (spins up a real `Workspace` + `OWNER` `User` via `createWorkspaceAndOwner`) and `cleanupWorkspace()` (cascading delete), so each test suite creates and tears down its own isolated tenant rather than sharing fixtures or truncating tables.
- `economy-simulation.js` is the one module tested as pure functions with in-memory fixtures (no DB, no tenant) — by design, per the comment at the top of that file — which is why it's the most exhaustively covered piece of logic in the repo (`lib/__tests__/economy-simulation.test.js`).
- `lib/email.js` and `lib/blob.js` are the opposite case: real external I/O with no Vitest coverage at all. `addAttachment`/`deleteAttachment` in `tasks.js` *are* tested (they're plain DB operations that happen to take already-uploaded metadata), but the upload/send calls themselves aren't. This is a real gap, not an oversight to fix casually — testing it for real means either a Resend/Blob sandbox account or mocking the SDKs, neither of which exists in this repo yet.
- There is no browser/E2E test suite in the repo; UI verification so far has been done ad hoc with Playwright driven manually against the dev server, not checked in as a repeatable test.
- CI (`.github/workflows/ci.yml`) runs this same test suite against a real database on every push/PR, which means it needs `DATABASE_URL` and `AUTH_SECRET` as GitHub repository secrets before it'll pass — see **Deployment status** below.

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

Set up, but not yet deployed:

- **CI** — `.github/workflows/ci.yml` runs lint, test, and build on push/PR to `main`/`master`. It's currently inert: this repo has no GitHub remote yet, and even once pushed, the workflow needs `DATABASE_URL` and `AUTH_SECRET` set as GitHub repository secrets before it'll pass (tests hit a real database — see **Testing strategy**). Ideally `DATABASE_URL` there points at a dedicated Neon branch for CI, not the same database used for local dev, so parallel/repeated CI runs don't collide with or pollute dev data.
- **Vercel project** — linked (`vercel link`), creating `.vercel/project.json` for the `aerion-software` project under the account's default team. No deployment has been triggered — that's a separate, explicit step (`vercel` for a preview, `vercel --prod` for production) once env vars are configured on the Vercel project itself (`DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` — see **Configuration & environment**). `AUTH_TRUST_HOST` doesn't need setting on Vercel; Vercel deployments set the equivalent automatically.
- **Vercel Cron** — `vercel.json` schedules the reminder sweep, but per **Vercel Cron** above, this only takes effect once actually deployed to Vercel; linking the project isn't enough on its own.
- **Vercel Blob store** — not yet provisioned. `BLOB_READ_WRITE_TOKEN` needs a Blob store created against the linked Vercel project (Dashboard or `vercel blob store add`) before attachments will work in any deployed environment.
- No `Dockerfile` or other non-Vercel deployment path exists — this is a Vercel-shaped deployment by design (Cron, and eventually Blob provisioning, are Vercel platform features the app already depends on), not a portable one.
