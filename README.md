# Aerion Software

Marketing site + client portal + admin panel for Aerion Software, built with Next.js (App Router), Prisma, and NextAuth.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Prisma 7** with the **Neon** serverless Postgres driver adapter
- **NextAuth v5** (credentials-based) — separate client and admin login flows, session-role-gated routes
- Plain CSS design system in `app/globals.css` (no Tailwind)

## Local development

1. Copy `.env` and set `DATABASE_URL` to a real Postgres connection string (see "Database" below) and a unique `AUTH_SECRET` (`openssl rand -base64 32`, or any 32+ byte random string).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Apply the database schema (creates `prisma/migrations` on first run):
   ```bash
   npx prisma migrate dev --name init
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Create your first accounts — there's no public signup. Easiest path locally is Prisma Studio:
   ```bash
   npx prisma studio
   ```
   Add a row to `Admin` (password must be a bcrypt hash — see snippet below) and/or `Client` rows, or add a temporary API route that calls `bcrypt.hash()` and `prisma.admin.create()`/`prisma.client.create()` the way earlier seed routes in this project's history did, then delete the route once you've used it.

   Quick bcrypt hash for Prisma Studio:
   ```bash
   node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"
   ```

## Routes

- `/`, `/services`, `/work`, `/about`, `/contact` — public marketing site
- `/portal/login`, `/portal/dashboard`, `/portal/profile` — client portal (requires a `Client` account)
- `/admin/login`, `/admin`, `/admin/clients/[id]` — staff admin panel (requires an `Admin` account)

Route protection lives in `proxy.js` (Next's edge middleware convention) plus `lib/auth.config.js`/`lib/auth.js` — the edge-safe config only handles JWT/session shape, the full config (Node runtime only) does the actual Prisma-backed credential checks.

## Database (Neon)

This project is wired for [Neon](https://neon.tech) serverless Postgres via `@prisma/adapter-neon`:

1. Create a free Neon account and a project.
2. Copy the **pooled connection string** from the Neon dashboard (Connect → Pooled connection). It looks like:
   ```
   postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
3. Put it in `.env` as `DATABASE_URL` locally, and in your Vercel project's environment variables for production.
4. Run `npx prisma migrate dev --name init` once locally against that connection string — this generates `prisma/migrations/`, which should be committed to the repo. Future schema changes: repeat `prisma migrate dev --name <description>`.
5. In production, migrations are applied non-interactively with `npx prisma migrate deploy` (safe for CI/CD — doesn't prompt, doesn't reset data). You can run this manually before/after a deploy, or wire it into the Vercel build command once you have real migrations to apply (see below).

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In Vercel, "Add New Project" → import the repo. Framework preset (Next.js) is auto-detected.
3. Set environment variables in the Vercel project settings:
   - `DATABASE_URL` — your Neon pooled connection string
   - `AUTH_SECRET` — same value as local, or generate a fresh one for prod (`openssl rand -base64 32`)
4. Deploy. `postinstall` runs `prisma generate` automatically so the client is always in sync with `prisma/schema.prisma`.
5. Once migrations exist (see above), either run `npx prisma migrate deploy` locally against the prod `DATABASE_URL` before each deploy, or change the Vercel build command to:
   ```
   prisma migrate deploy && next build
   ```
6. Create your first production `Admin` row the same way as local (Prisma Studio pointed at the prod `DATABASE_URL`, or a one-time seed route you delete afterward). From there, admins can create `Client` accounts through `/admin`.

## Notes

- The demo-credential hints on `/portal/login` and `/admin/login` only render when `NODE_ENV !== "production"` — they won't appear in a production build.
- `dev.db` / SQLite are no longer used; the project is Postgres-only.
