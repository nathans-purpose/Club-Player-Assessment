import Link from "next/link";
import { Suspense } from "react";
import { loadClubContext } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { loadAppliedTheme } from "@/lib/identity/data";
import { t } from "@/lib/i18n";
import { signOut } from "../../logga-in/actions";
import { ClubNav } from "./club-nav";

export default function ClubLayout({ children, params }: LayoutProps<"/klubb/[clubId]">) {
  return (
    <div className="flex flex-1 flex-col">
      {/* The club's visual identity, once an admin has applied it. */}
      <Suspense fallback={null}>
        <ClubTheme params={params} />
      </Suspense>
      <header className="border-t-4 border-b border-t-brand-stripe border-b-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <ClubLogo params={params} />
            </Suspense>
            <Link href="/" className="inline-flex min-h-11 items-center font-semibold">
              {APP_NAME}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {/* Reads the URL and the user's role, so it streams in after the static shell. */}
            <Suspense fallback={null}>
              <Nav params={params} />
            </Suspense>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
              >
                {t("nav.signOut", "Logga ut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

async function ClubTheme({ params }: Pick<LayoutProps<"/klubb/[clubId]">, "params">) {
  const { clubId } = await params;
  const context = await loadClubContext(clubId);
  const theme = context && (await loadAppliedTheme(context.supabase, clubId));
  // The CSS is built from checked values only (lib/identity/theme.ts).
  return theme?.css ? <style>{theme.css}</style> : null;
}

/** The club's main logo, or its crest from Kom igång when no identity is applied. */
async function ClubLogo({ params }: Pick<LayoutProps<"/klubb/[clubId]">, "params">) {
  const { clubId } = await params;
  const context = await loadClubContext(clubId);
  if (!context) return null;
  const theme = await loadAppliedTheme(context.supabase, clubId);
  const src = theme?.logoUrl ?? context.club.crestUrl;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a club's own file from Storage, any size
    <img src={src} alt={context.club.name} className="h-9 w-auto max-w-32 object-contain" />
  );
}

/**
 * Admins get Inställningar; leaders only see Så räknas det, the one settings
 * page that is open to them.
 */
async function Nav({ params }: Pick<LayoutProps<"/klubb/[clubId]">, "params">) {
  const { clubId } = await params;
  const context = await loadClubContext(clubId);
  return (
    <ClubNav
      links={[
        { path: "spelare", label: t("nav.assess", "Bedöm spelare") },
        { path: "oversikt", label: t("nav.overview", "Översikt") },
        ...(context?.role === "admin"
          ? [{ path: "installningar", label: t("nav.settings", "Inställningar") }]
          : context
            ? [{ path: "installningar/sa-raknas-det", label: t("nav.howItWorks", "Så räknas det") }]
            : []),
      ]}
      label={t("nav.club", "Klubbens sidor")}
    />
  );
}
