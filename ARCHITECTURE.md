# Architecture

Engineering reference for how Aerion Software is put together: the layers requests pass through, and the external pieces the app depends on.

## Core Architectural Layers

### 1. Presentation (App Router UI)

- Next.js 16 App Router under `app/`, mixing React Server Components (default) with the client components under `components/` (`Header`, `SignOutButton`, `EconomyDiagramView`, `SimulationChart`, `BalanceReport`).
- Pages are `async` Server Components that fetch their own data directly (`app/dashboard/page.js`, `app/projects/[id]/economy/[diagramId]/page.js`, etc.) — no client-side data-fetching layer sits in front of them.

### 2. Routing & request gating

- File-based routing via the App Router (`app/<route>/page.js`, dynamic segments like `[id]`, `[diagramId]`).
- `proxy.js` is the auth gate for every request: it runs `auth()` from NextAuth and redirects to `/login` for any non-public path (`config.matcher` excludes `api/auth`, static assets, and the favicon).
- `app/api/auth/[...nextauth]` exposes the NextAuth route handlers (`handlers.GET`/`POST`) for the credentials sign-in flow.

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
- Core entities: `Workspace` → `User`/`Project` → `Task` / `EconomyDiagram` → `EconomyNode`/`EconomyConnection`/`EconomyLayer`, all scoped by `workspaceId` at the top of the tree.

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

### 1. Neon Postgres

- The database itself: serverless, branchable Postgres. There is no locally-run Postgres in this project — even `npm run dev` talks to a real hosted Neon instance over the network via `DATABASE_URL`.
- Because it's serverless, connections aren't a static TCP socket held open the way a traditional Postgres client expects — which is why it needs its own driver rather than the standard `pg` client (see the adapter below).

### 2. `@prisma/adapter-neon` + `ws`

- Prisma ORM 7 moved to a **driver adapter** model: Prisma no longer opens its own connection from a `url` in `schema.prisma` — notice `datasource db { provider = "postgresql" }` in `prisma/schema.prisma` has no `url` field at all. Instead, `lib/prisma.js` constructs a `PrismaNeon` adapter directly (`new PrismaNeon({ connectionString: process.env.DATABASE_URL })`) and hands it to `new PrismaClient({ adapter })`.
- `PrismaNeon` talks to Neon over WebSockets, which Node doesn't provide as a global by default — hence `ws` as a real runtime dependency, and `neonConfig.webSocketConstructor = ws` wiring it in before the client is created.
- The CLI (`prisma migrate`, `prisma studio`, etc.) doesn't go through this adapter — it reads `DATABASE_URL` directly via `prisma.config.ts`'s `datasource.url`. So there are, deliberately, two separate paths to the same database: the adapter for the running app, the config file for tooling.

### 3. Prisma ORM 7

- Schema lives in `prisma/schema.prisma`; migrations are timestamped folders under `prisma/migrations/` (currently: init, add-indexes, add-economy-diagrams, add-economy-layers — each migration name describes the feature that motivated it).
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

### Notable constraints from this stack

- Because the Prisma client is generated to a custom path (`app/generated/prisma`), any tooling that assumes the default `node_modules/@prisma/client` location needs the `output` override from `schema.prisma` in mind.
- The Neon adapter's WebSocket requirement means `ws` is a runtime dependency, not just a dev convenience — dropping it breaks the DB connection outside environments with native WebSocket support.
- `proxy.js` is the *only* place unauthenticated access is blocked; any new route added outside `PUBLIC_PATHS` is protected by default, but a new *public* route must be added to that set explicitly.

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
- There is no browser/E2E test suite in the repo; UI verification so far has been done ad hoc with Playwright driven manually against the dev server, not checked in as a repeatable test.

## Configuration & environment

Three environment variables, defined in `.env` (not committed) and loaded via `dotenv/config` for tests/tooling — `next dev`/`next build` load `.env` natively:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.js`, `prisma.config.ts` | Neon Postgres connection string for both the app's Prisma client and `prisma migrate`. |
| `AUTH_SECRET` | NextAuth (`lib/auth.js` via `authConfig`) | Signs/encrypts the JWT session. |
| `AUTH_TRUST_HOST` | NextAuth | Tells Auth.js to trust the deployment's host header — needed whenever the app isn't running on a NextAuth-recognized default host (e.g. behind a proxy or on a non-standard local port). |

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

There is exactly one HTTP API route in this app: `app/api/auth/[...nextauth]/route.js`, NextAuth's own catch-all for the credentials sign-in flow. Every other mutation goes through Server Actions (see **Mutation boundary**, above) — those aren't independently callable HTTP endpoints, so there's nothing for a Postman/Insomnia-style tool to point at yet.

Given that, a dedicated API-management add-on (a Postman collection, an Insomnia workspace, an API gateway) isn't warranted by what exists today. That becomes worth adding if the app grows a real public API surface — webhooks, a REST or GraphQL layer for external consumers — not before.

## Deployment status

No deployment configuration exists in this repo yet — no CI workflow, no `Dockerfile`, no `vercel.json`. Today the app only runs via `npm run dev` (Turbopack dev server) or `npm run build && npm run start` locally. The database is already externally hosted (Neon), so shipping this currently means: point `DATABASE_URL`/`AUTH_SECRET`/`AUTH_TRUST_HOST` at a target environment and run the Next.js production build behind whatever Node host is chosen — that choice hasn't been made yet.
