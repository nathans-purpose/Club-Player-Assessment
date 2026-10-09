# Club Player Assessment

A web app where football club leaders assess their players, each on their own,
and the app combines everyone's input into one shared picture. Multi-tenant:
any club can sign up, add its squad and invite its leaders.

UI language is Swedish. Code, comments and database names are English.

**This repository is public. Never commit real player names, assessments or
secrets.** The seed data is made up.

## Stack

- Next.js (App Router, TypeScript, Server Actions), deployed on Vercel
- Supabase: Postgres, Auth (magic link + Google), Row Level Security
- Tailwind CSS with CSS variables for all theme tokens (`app/globals.css`)
- Vitest (unit and RLS tests), Playwright (end-to-end)

## Getting started

Requirements: Node 22 and Docker (for the local Supabase stack).

```bash
npm install
cp .env.example .env.local
npx supabase start          # starts Postgres, Auth and Mailpit; applies migrations and seed
```

Put the printed `API_URL` and `PUBLISHABLE_KEY` into `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with a magic link. Locally, emails land
in Mailpit at http://127.0.0.1:54324. The seed creates the demo club
*Exempelklubben IF* with 17 players and these leaders:

| Email | Role |
|---|---|
| demo-admin@example.com | admin |
| demo-ledare1@example.com | leader |
| demo-ledare2@example.com | leader |
| demo-ledare3@example.com | leader |

`npx supabase db reset` re-applies migrations and the seed.

Google sign-in locally needs a Google OAuth client; set
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
in your shell before `supabase start`, with
`http://127.0.0.1:54321/auth/v1/callback` as the authorized redirect URI.

## Tests

```bash
npm run lint
npm run typecheck
npm test            # unit tests + RLS tests
npm run test:e2e    # Playwright, needs `supabase start` and the app on :3000
```

The RLS tests (`tests/db`) create a throwaway database on any Postgres server,
apply a small Supabase shim (`tests/db/supabase-shim.sql`) and all migrations,
and then act as different users through `auth.uid()`. They set up two clubs and
check that no user can read or change the other club's data, plus the
admin/leader rules. Point them at a server with `TEST_DATABASE_URL`
(default `postgres://postgres:postgres@localhost:5432/postgres`; the Supabase
stack's database at port 54322 works too).

## Project layout

```
app/                    routes (Swedish URLs: /logga-in, …)
app/auth/callback       magic link and Google sign-in landing point
lib/supabase/           server, browser and proxy clients
lib/i18n.ts             t(key, fallback) — all UI copy goes through it
proxy.ts                refreshes the session and sends signed-out visitors to /logga-in
supabase/migrations/    schema, RLS policies and helper functions
supabase/seed.sql       demo club for local development
tests/db/               RLS and seed tests
e2e/                    Playwright tests
```

## Access model

Every table is scoped to a club through RLS:

- **Members** (admins and leaders) read their club's squad, settings and
  submitted assessments.
- **Admins** write squad, settings, members and invites.
- **Assessments** are written only by their author. Drafts are visible only to
  the author; submitted assessments are visible to the whole club.
- **Anonymous** visitors have no access to any table.
- The creator of a club becomes its first admin, and a club always keeps at
  least one admin.
- Invites are accepted through `accept_invite(token)`. Email invites are
  single-use and must match the signed-in email; link invites (no email) work
  for anyone with the link until they expire (7 days by default).

## Deploying

1. Create a Supabase project in an **EU region** (assessments are personal data).
2. Link and push the schema: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`. Do not run the seed in production.
3. In Supabase → Authentication: set the Site URL to the production URL, add
   `https://<your-domain>/auth/callback` to the redirect URLs, and enable Google
   with your OAuth client.
4. In Vercel, import the repository and set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`.
