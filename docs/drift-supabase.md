# Driftsätta Supabase

Steg-för-steg för att sätta upp databasen, inloggningen och fillagringen i ett
riktigt Supabase-projekt. Vercel (själva webbappen) är nästa del och har en
egen guide. Lägg aldrig in riktiga spelare förrän allt är testat med påhittade.

Du behöver: ett Supabase-konto, ett Google-konto (för Google-inloggningen) och
tillgång till repot på GitHub.

## 1. Skapa projektet

1. Gå till [supabase.com/dashboard](https://supabase.com/dashboard) och välj **New project**.
2. Namn: till exempel `club-player-assessment`.
3. **Database password:** klicka på *Generate a password* och spara lösenordet
   i en lösenordshanterare. Det behövs i steg 2.
4. **Region:** välj **North EU (Stockholm)** om den finns, annars en annan EU-region.
   Spelardata ska ligga inom EU.
5. Låt **Data API** vara påslaget (appen pratar med databasen genom det).
6. Skapa projektet och vänta tills det är klart.

Skriv upp projektets **Project ref**. Det är koden i adressen,
`https://supabase.com/dashboard/project/<project-ref>`, och den finns också under
*Project Settings → General*.

> Gratisnivån pausar projekt som inte används på en vecka. Det går att väcka dem
> igen i dashboarden, men inför skarp drift bör klubben räkna med Pro-nivån.

## 2. Lägg in databasen (migreringarna)

Repot har en GitHub Action, **Deploy database**, som lägger in alla tabeller,
regler (RLS) och lagringsplatser för filer. Den körs automatiskt när nya
migreringar hamnar i `main`, och den kan startas för hand. Demodatan
(`supabase/seed.sql`) följer aldrig med.

1. Skapa en åtkomstnyckel i Supabase: klicka på din profil → **Account
   preferences → Access Tokens → Generate new token**. Kopiera den.
2. På GitHub, i repot: **Settings → Secrets and variables → Actions → New
   repository secret**. Lägg in tre hemligheter:

   | Namn | Värde |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | nyckeln från punkt 1 |
   | `SUPABASE_DB_PASSWORD` | databaslösenordet från steg 1 |
   | `SUPABASE_PROJECT_REF` | projektets Project ref |

3. Gå till fliken **Actions → Deploy database → Run workflow** (på `main`).
4. När körningen är grön: öppna **Table Editor** i Supabase. Där ska bland annat
   `clubs`, `players` och `assessments` finnas, alla tomma. Under **Storage**
   ska fyra lagringsplatser finnas: `club-crests`, `club-assets`,
   `player-imports` och `brand-imports`.

<details>
<summary>Alternativ: kör från en egen dator</summary>

Kräver Node 22 och en klon av repot.

```bash
npm install
npx supabase login
npx supabase link --project-ref <project-ref>   # frågar efter databaslösenordet
npx supabase db push
```
</details>

## 3. Inloggning: adresser

Under **Authentication → URL Configuration**:

- **Site URL:** appens adress. Den får vi i Vercel-delen; tills dess kan du
  skriva `http://localhost:3000` och byta senare.
- **Redirect URLs:** lägg till
  - `https://<appens-adress>/auth/callback**`
  - `http://localhost:3000/auth/callback**` (för test på egen dator)

Stjärnorna behövs, eftersom inloggningslänken tar med vilken sida man ska
landa på efteråt.

Under **Authentication → Sign In / Providers**: se till att **Allow new users
to sign up** och **Email** är påslagna. **Confirm email** kan vara på.

## 4. Inloggning: e-postlänkar

Supabase skickar e-post med en inbyggd tjänst, men den skickar bara till
adresser som är medlemmar i ditt Supabase-team, och bara ett par mejl i
timmen. Det räcker för att testa själv, men inte för att ledarna ska kunna
logga in med e-postlänk. För det behövs en egen e-posttjänst (SMTP) under
**Authentication → Emails → SMTP Settings**. Google-inloggning fungerar utan.

Mejlen ska vara på svenska. Under **Authentication → Emails → Templates**:

| Mall | Ämne | Innehåll |
|---|---|---|
| **Magic link** | `Din inloggningslänk` | allt i [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html) |
| **Confirm signup** | `Bekräfta din e-postadress` | allt i [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) |

Kopiera hela filens innehåll (kommentaren överst kan tas bort).

## 5. Google-inloggning

I [Google Cloud Console](https://console.cloud.google.com/):

1. Skapa ett nytt projekt, till exempel `Spelarbedomning`.
2. **APIs & Services → OAuth consent screen** (heter ibland *Google Auth
   Platform → Branding*): välj **External**, fyll i appens namn och en
   kontaktadress. Under *Audience*: välj **Publish app** så att alla kan logga
   in, inte bara testanvändare.
3. **Credentials → Create credentials → OAuth client ID**, typ **Web application**.
   - **Authorized JavaScript origins:** appens adress (läggs till i Vercel-delen).
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`
4. Kopiera **Client ID** och **Client secret**.

Tillbaka i Supabase: **Authentication → Sign In / Providers → Google**. Slå på,
klistra in Client ID och Client secret och spara.

## 6. Nycklar till appen

Under **Project Settings → API Keys** (och *Data API* för adressen) finns det
appen behöver. De läggs in i Vercel i nästa del:

| Miljövariabel | Var den finns |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (börjar med `sb_publishable_`) |

Appen använder aldrig den hemliga nyckeln (*secret key* / *service_role*). Den
ska inte läggas in någonstans.

## Kontrollista

- [ ] Projektet finns i en EU-region
- [ ] Deploy database är grön, tabellerna och de fyra lagringsplatserna finns
- [ ] Redirect URLs innehåller `/auth/callback**`
- [ ] Svenska mallar för Magic link och Confirm signup
- [ ] Google är påslaget med Client ID och secret
- [ ] Egen SMTP, eller ett beslut om att bara använda Google tills vidare
