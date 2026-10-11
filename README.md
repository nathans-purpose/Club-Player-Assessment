# Club Player Assessment

A web app where football club leaders assess their players, each on their own,
and the app combines everyone's input into one shared picture. Multi-tenant:
any club can sign up, add its squad and invite its leaders.

UI language is Swedish. Code, comments and database names are English.

**This repository is public. Never commit real player names, assessments or
secrets.** The seed data is made up.

## Stack

- Next.js (App Router, TypeScript, Server Actions), deployed on Vercel
- Supabase: Postgres, Auth (magic link + Google), Storage (club crests, player list and brand document uploads, logos and fonts), Row Level Security
- Anthropic API (Claude) for reading uploaded player lists and brand documents, server-side only
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

## Production

`docs/drift-supabase.md` (Swedish) walks through setting up the hosted Supabase
project. The **Deploy database** workflow pushes new migrations to it when they
reach `main`; CI checks that the migrations apply with `supabase db push` on an
empty database.

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
app/kom-igang/          onboarding: 1 account, 2 club (/klubb), 3 players and 4 leaders (/[clubId]/…)
app/inbjudan/[token]    accept an invite
app/klubb/[clubId]/spelare  Spelarkort: player list, form (autosave), thank-you (/tack), combined view (/samlad)
app/klubb/[clubId]/oversikt Översikt: tabs Översikt and Data (?flik=data), pitch, radar, Fakta, rankings, quick view
app/klubb/[clubId]/sasong Säsong: seasons, evaluation summary, own evaluation, results and planning
app/klubb/[clubId]/installningar Inställningar: visuell-identitet, kategorier, positioner, sa-raknas-det and display options
lib/calc.ts             all calculation rules (spec §5), the single source of truth
lib/overview.ts         builds everything Översikt shows from the rows, using calc.ts
lib/season/             Säsong: results and evaluation summary rules, squad plan, input checks, copy
lib/assessment/         form state, completeness and payload checks; server-side data loading
lib/positions.ts        position codes, labels and pitch coordinates
lib/onboarding/         defaults for a new club's team (formations, categories, phases)
lib/settings/           checks and helpers for the settings pages (categories, positions, presets)
lib/identity/           visual identity: contrast, theme tokens, brand document reading, logo cut-out
lib/players/            paste parsing and review-table statuses for the squad list
lib/players/import/     file import: accepted types, file-to-text conversion, the Claude call and its schema
lib/supabase/           server, browser and proxy clients
lib/i18n.ts             t(key, fallback) — all UI copy goes through it; club overrides per request
lib/privacy/            data export (JSON, CSV) and the guardian information text
components/text-edit.tsx "Redigera texter": edit mode, inline editors, Spara / Ångra bar
app/integritet, app/villkor privacy notice and terms placeholder (public)
proxy.ts                refreshes the session and sends signed-out visitors to /logga-in
supabase/migrations/    schema, RLS policies and helper functions
supabase/seed.sql       demo club for local development
tests/db/               RLS and seed tests
e2e/                    Playwright tests; journey.spec.ts runs the whole flow, accessibility.spec.ts runs axe
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
- New clubs are created through `create_club(…)`, which also creates the first
  team, an active season with four phases, position targets for the game
  format and six placeholder categories, all in one transaction.
- Invites are accepted through `accept_invite(token)`; `invite_preview(token)`
  shows the club's name on the invite page before accepting. Email invites are
  single-use and must match the signed-in email; link invites (no email) work
  for anyone with the link until they expire (7 days by default).

## Spelarkort

Leaders reach the form from *Bedöm spelare* (`/klubb/[clubId]/spelare`), a
list of active players with their own status (Ej påbörjad / Utkast /
Inskickad). Drafts autosave (debounced) through `save_assessment(…)`, which
writes the assessment, scores, positions and attendance in one transaction
under RLS. Once submitted, an assessment changes only when the leader submits
it again, so half-finished edits never reach the combined view. A leader sees
the combined view of a player only after submitting their own assessment.

The pitch coordinates in `lib/positions.ts` are placeholders until they are
matched to the design prototype.

## Översikt

`/klubb/[clubId]/oversikt` is open to every member and counts submitted
assessments only. The *Översikt* tab shows KPI tiles, the team pitch (metric
chips; hover, keyboard focus or a tap shows who can play a position), the
radar (team against one squad group), *Fakta* and *Lag, bäst och svagast*.
*Lag* opens the *Data* tab sorted by that metric; *Bäst* and *Svagast* open a
quick-view dialog with every tied player. The *Data* tab is a sortable table
with a squad-group filter; sorting by a phase makes the attendance column
show that phase.

Until a quarter of all possible assessments (players × members) are in, the
charts are replaced by "Väntar på bedömningar (X av Y)". Match stats come from
`player_season_stats`, which has no editing screen yet.

## Säsong

`/klubb/[clubId]/sasong` is the leaders' evaluation of a season as a team and
their plan for the next one. Admins and leaders share it; players never see it.
Seasons are rows in `seasons`, so 2026 can be compared with 2027; admins add a
season (`create_season`) without changing the active one that players are
assessed in.

- *Min utvärdering*: each leader rates the team's tactic and training areas
  1–10 (`evaluation_areas`, 21 defaults per team), says whether each was
  trained enough, and writes three strengths, three weaknesses and an outlook.
  Drafts autosave and are private until submitted, like assessments.
- *Resultat*: a shared match log, final position, how the goals came, and
  totals for a season without a match log (for comparison).
- *Sammanställning*: results, home/away and spring/autumn, the previous season,
  and, once the leader has submitted their own, area averages with
  *Oeniga – diskutera* (spread ≥ 3) and *Prioritera?* (average below 6 and two
  or more say too little training). Rules are in `lib/season/summary.ts`.
- *Planering*: strategy, at most three improvement priorities (suggested from
  the previous season's evaluation), the desired squad per position against
  the current players (with their player-card average and main position) and
  a recruitment wishlist of players outside the club.

## Inställningar

Admins reach the settings from *Inställningar* in the club menu; leaders only
see *Så räknas det*, and the admin pages answer 404 for them.

- **Bedömningskategorier** (`/installningar/kategorier`): add, rename,
  reorder, set the question and *Fördjupa* with subcategories. Removing a
  category can be undone for 5 seconds, and nothing is stored until *Spara
  ändringar*. Saving goes through `save_categories(…)` in one transaction:
  categories and subcategories that were left out are deactivated, never
  deleted, so scores already given stay in the history, and a removed
  category can be restored. A summary shows ratings per player and the
  estimated time, with a warning above 16 ratings.
- **Positioner på planen** (`/installningar/positioner`): tap positions on the
  pitch to show or hide them, set how many players the team needs on each, or
  pick a formation (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 7 mot 7). A formation
  replaces the positions and can be undone for 5 seconds. Saved through
  `save_position_targets(…)`. The positions have two centre-back spots, so the
  third centre-back in 3-5-2 counts on Vänster mittback.
- **Så räknas det** (`/installningar/sa-raknas-det`, every member): the rules
  in `lib/calc.ts` in plain Swedish, with the thresholds read from the code.
- **Visning** (on the settings page): *Anonym ledarvy* hides who gave which
  score in the combined view (only averages, spread and unsigned comments
  show), and *Skärmvänligt läge* says "Lägst" instead of "Svagast" in
  Översikt, for showing it on a big screen.

## Visuell identitet

Admins set the club's look at *Visuell identitet*
(`/installningar/visuell-identitet`). Nothing changes for the club until they
press *Spara och använd för hela klubben*; *Sluta använda klubbens tema* goes
back to the default look and keeps what was saved.

- **Brand document import.** A PDF, PowerPoint (.pptx), Keynote (.key) or
  picture, up to 50 MB. The browser turns it into at most 8 images (PDF pages
  drawn with PDF.js, the pictures inside a presentation, Keynote's slide
  preview) plus hints (a .pptx file's theme colours, fonts and slide text, a
  PDF's font names). The images go to the private `brand-imports` bucket,
  `readBrandDocument` sends them to Claude, which returns colours with roles,
  fonts, tone words and boxes around the logos, and the images are deleted
  right after. The browser cuts the logos out of its own copies and makes a
  plain background transparent (PNG). Older .ppt files and Keynote '09
  bundles are not supported. Without `ANTHROPIC_API_KEY` everything can be
  entered by hand.
- **Contrast check.** If the main colour is below 4.5:1 on white, a darker
  variant of the same hue is used for text, links and focus rings
  (`--primary-ink`), buttons in the main colour get dark text, and the page
  explains this to the admin (e.g. `#509BF5` → `#2971C8`).
- **Fonts.** Licensed fonts are not bundled. Until the admin uploads a font
  file (woff2, woff, otf or ttf, max 5 MB), a bundled fallback with a
  matching width is used: Geist, Georgia, or Archivo condensed or expanded.
- **Theming.** `lib/identity/theme.ts` turns the identity into CSS variables
  (`--primary`, `--primary-ink`, `--on-primary`, `--brand-stripe`,
  `--font-heading`, `--font-body`) that the club layout writes into a
  `<style>` element. The assessment colour scale, the pitch and the page
  background are the same for every club. Stored values are checked again
  when read (hex colours only, font names without quotes, files only in the
  club's own folder), so a hand-written row cannot inject CSS.
- **Files.** Logos and font files are in the public `club-assets` bucket under
  `<club_id>/logos/` and `<club_id>/fonts/` (random file names, no SVG), so
  every member's browser can load them; files the identity no longer uses are
  deleted on save. Only the club's admins can write there. A font file in a
  public bucket can be downloaded by anyone who has its address, as on any
  website that uses web fonts, so only upload fonts licensed for the web.

## Redigera texter

Admins get *Redigera texter* in the club header. In edit mode headings get a
pencil button and body texts a *Redigera text* button; edits are drafts until
*Spara* (or *Ångra*) in the bar at the bottom, and a text set back to its
default is removed. Saved texts go to `ui_text_overrides` and apply to every
`t()` call on the club's pages and its Kom igång steps: loading the club
(`loadClubContext`, `requireAdminClub`) puts the overrides in a per-request
store that `t()` reads. Headings and body texts on the club pages are editable
in place; button labels and other short strings take overrides too but have no
inline editor yet.

## Data och integritet

`/installningar/data` (admins only):

- **Export** of everything the club owns as JSON, or as a zip with one CSV per
  table (semicolon-separated, for Swedish Excel). Read under RLS as the admin,
  so leaders' unsent drafts and invite tokens are not included.
- **Delete a player**: a hard delete after a confirmation; the player's
  assessments go with them.
- **Delete the club**: the admin types the club's name; the club's files in
  Storage are removed first, then the club and everything under it.
- **Guardian information**: for teams with players under 18, a text to send to
  guardians, also shown on *Bedöm spelare* to admins until they confirm it was
  sent (`teams.guardian_info_confirmed_at`).

`/integritet` and `/villkor` are open without signing in and linked in the
footer. **Both are templates: the club is the data controller and must have
them reviewed before real use.**

## Onboarding and invites

*Kom igång* (`/kom-igang`) walks a new admin through account, club, players
and leaders. Players are uploaded as a file, typed in or pasted (one per line:
`nr name [group]`), and checked in a review table before anything is saved.

## Player import

On *Kom igång 3* an admin can upload the squad as a photo or screenshot, PDF,
Excel (.xlsx), CSV or Word (.docx) file, up to 20 MB. Older .xls and .doc
files are not supported.

1. The browser uploads the file straight to the private `player-imports`
   bucket under `<club_id>/`. Only that club's admins can write, read or delete
   there. Photos that are large or in a format Claude cannot read (HEIC) are
   redrawn as JPEG in the browser first, which also drops EXIF data.
2. `readPlayerFile` (a server action) downloads the file and sends it to
   Claude (`claude-opus-5-5`, structured JSON output validated with zod).
   Photos and PDFs go as images and documents; spreadsheets, CSV and Word files
   are turned into text first. The prompt tells Claude to treat the document as
   data only, and the answer can only be player rows.
3. The file is deleted right after reading, whatever the outcome. Uploads
   older than an hour that were never read (a closed tab) are deleted on the
   next import.
4. The rows land in the review table with what Claude was unsure about marked
   ("Osäker läsning"), and nothing reaches `players` until the admin saves.

Set `ANTHROPIC_API_KEY` on the server to turn the import on; without it the
page says file import is not switched on and the other ways still work. The
end-to-end tests use `e2e/mock-anthropic.mjs` instead of the real API (start
the app with `ANTHROPIC_BASE_URL=http://127.0.0.1:4010`).

Invites are not emailed by the app yet. Each email invite gets a personal link
that the admin copies or sends with *Skicka e-post* (opens their own mail
program with a ready text). The shareable invite link makes anyone who opens
it a leader for 7 days. Sending invites automatically needs an email provider
(for example Resend or Supabase with custom SMTP).

Club crests go to the public `club-crests` Storage bucket (PNG, JPG or WebP,
max 2 MB; no SVG since the bucket is public).

## Deploying

1. Create a Supabase project in an **EU region** (assessments are personal data).
2. Link and push the schema: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`. Do not run the seed in production.
3. In Supabase → Authentication: set the Site URL to the production URL, add
   `https://<your-domain>/auth/callback` to the redirect URLs, and enable Google
   with your OAuth client.
4. In Vercel, import the repository and set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` and
   `ANTHROPIC_API_KEY` (server-side only, never `NEXT_PUBLIC_`).
