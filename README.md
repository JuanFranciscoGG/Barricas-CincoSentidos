# Barricas — Cinco Sentidos

Internal dashboard and public barrel pages for Cinco Sentidos' personalized barrel-to-bottle
wine program. Built from the discovery doc in this project's earlier conversation — see
that document for the full architecture, data model and phased plan.

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions) + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme`, tokens in `src/app/globals.css`)
- **Prisma 7** on **PostgreSQL** (Supabase) through `@prisma/adapter-pg`, with verified TLS
- **Supabase Storage** (private `uploads` bucket) for photos; a local-disk fallback is used when
  the Supabase variables are not set
- **iron-session** for staff auth (email/password, bcrypt-hashed). Customers have no accounts:
  they reach their barrel through a public link (`/wine/[token]`, printed as QR/NFC) and unlock
  it with a PIN on `/activar`

## Getting started

1. Create a Supabase project and a `.env` from `.env.example` (connection strings, secret key,
   `SESSION_SECRET`). The `.env` is never committed.
2. Install and set the database up:

```bash
npm install            # also runs `prisma generate`
ADMIN_PASSWORD=... npm run db:setup
npm run dev
```

`npm run db:setup` runs, in order: `db:migrate` (creates the tables), `db:admins` (the administrator
login), `db:storage` (creates the private photo bucket) and `db:seed` (reference
data: operation catalog and Knowledge Layer). Each one can also be run on its own and is safe to
re-run.

Open http://localhost:3000 (Next prints another port if 3000 is busy). Staff sign in at `/login`.

**Demo data (never in production):** `SEED_DEMO=1 npm run db:seed` also creates demo staff logins
with a shared password and one demo project ("El Malbec Demo", barrel `CS-024`).

### Tests

`npm test` needs `DIRECT_URL` in `.env`. Each test file creates its own temporary schema in that
database, applies the migration SQL to it, and drops it afterwards; it never touches `public`.
Use a development Supabase project for this, not production.

### Staff logins

Logins live in the database (`User` table, bcrypt hash only). Manage them from your own terminal:

```bash
npm run db:users list                 # who can sign in
npm run db:users add                  # create a login, or change a password / name / role
npm run db:users disable <login>      # block a login
```

`add` asks for the username (or email), name, role and a hidden password (10+ characters). Nothing is
written to files or shell history. The very first administrator can also be created non-interactively
with `ADMIN_PASSWORD=... npm run db:admins` (see `prisma/set-admins.ts`), which is what `db:setup` uses.

### Changing the database schema

Edit `prisma/schema.prisma`, then `npx prisma migrate dev --name what_changed` against a development
database and commit the new folder under `prisma/migrations`. Apply to other environments with
`npm run db:migrate`. Note: the invariant "one active assignment per owner and barrel" is a partial
unique index written by hand in the initial migration (Prisma cannot express it); keep it when
regenerating migrations.

## Project layout

```
prisma/schema.prisma        Data model — see the discovery doc §07 and §21
prisma/seed.ts               Reference data (+ demo data with SEED_DEMO=1)
prisma/set-admins.ts         Administrator logins
prisma/setup-storage.ts      Creates the private photo bucket
src/lib/                     Server-only: prisma client, file storage, session,
                              auth guards, enums, the
                              Knowledge Layer resolver, server actions
src/components/ui/           Small design-system primitives (Button, Card, Field…)
src/app/dashboard/           Internal, staff-only (role-gated in dashboard/layout.tsx)
src/app/wine/[token]/        Public barrel page, reached by QR/NFC link (PIN-gated)
src/app/activar/             PIN activation for a barrel link
src/app/uploads/[name]/      Serves private uploaded photos to authorized viewers only
src/proxy.ts                 Coarse auth gate (Next's renamed "middleware")
```

## What's built vs. what's next

**Working end-to-end:** auth, the mobile-first quick-log flow, customers, projects,
barrels, stages, the operation-type library, the Knowledge Layer (schema + resolver +
staff authoring screen), the public barrel page (`/wine/[token]`), barrel owners and PINs,
barrel notes, and bottling-record creation from the staff side.

**Deliberately not built yet** (see the discovery doc's MVP scope, §18): Knowledge
Pairing admin UI (the one seeded pairing works; creating new pairings currently needs a
script), WhatsApp/email notification delivery, and Excel import. Cover-photo uploads exist
and are stored on local disk (`src/lib/upload.ts`); production will need persistent storage.
