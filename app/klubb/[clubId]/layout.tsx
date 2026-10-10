import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { signOut } from "../../logga-in/actions";
import { ClubNav } from "./club-nav";

export default function ClubLayout({ children }: LayoutProps<"/klubb/[clubId]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            {/* Reads the URL, so it streams in after the static shell. */}
            <Suspense fallback={null}>
              <ClubNav
                links={[
                  { path: "spelare", label: t("nav.assess", "Bedöm spelare") },
                  { path: "oversikt", label: t("nav.overview", "Översikt") },
                ]}
                label={t("nav.club", "Klubbens sidor")}
              />
            </Suspense>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
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
