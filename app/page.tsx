import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./logga-in/actions";

type Membership = { role: "admin" | "leader"; clubs: { id: string; name: string } | null };

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-semibold">{APP_NAME}</span>
          <div className="flex items-center gap-1">
            <Link
              href="/konto"
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink"
            >
              {t("nav.account", "Mitt konto")}
            </Link>
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

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
          <HomeContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

// Reads the session, so it streams in behind the Suspense boundary.
async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/logga-in");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
    supabase.from("club_members").select("role, clubs(id, name)").eq("user_id", userId).returns<Membership[]>(),
  ]);

  const name = profile?.full_name || profile?.email || "";
  const { raderad } = await searchParams;
  const clubs = (memberships ?? []).filter((m) => m.clubs);

  return (
    <>
      <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">
        {name ? t("home.greeting", "Hej {name}!").replace("{name}", name) : t("home.greetingNoName", "Hej!")}
      </h1>

      {raderad === "1" && (
        <p role="status" className="rounded-lg border border-border bg-surface p-4">
          {t("home.clubDeleted", "Klubben och all dess data är raderad.")}
        </p>
      )}

      {clubs.length > 0 ? (
        <section aria-labelledby="clubs-heading" className="flex flex-col gap-3">
          <h2 id="clubs-heading" className="text-lg font-semibold">
            {t("home.clubs.title", "Dina klubbar")}
          </h2>
          <ul className="flex flex-col gap-2">
            {clubs.map((m) => (
              <li
                key={m.clubs!.id}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <span className="font-medium">{m.clubs!.name}</span>
                <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={`/klubb/${m.clubs!.id}/spelare`}
                    className="inline-flex min-h-11 items-center font-semibold underline"
                  >
                    {t("home.clubs.assess", "Bedöm spelare")}
                  </Link>
                  <Link
                    href={`/klubb/${m.clubs!.id}/oversikt`}
                    className="inline-flex min-h-11 items-center font-semibold underline"
                  >
                    {t("home.clubs.overview", "Översikt")}
                  </Link>
                  {m.role === "admin" && (
                    <>
                      <Link
                        href={`/kom-igang/${m.clubs!.id}/spelare`}
                        className="inline-flex min-h-11 items-center underline"
                      >
                        {t("home.clubs.players", "Lägg till spelare")}
                      </Link>
                      <Link
                        href={`/kom-igang/${m.clubs!.id}/ledare`}
                        className="inline-flex min-h-11 items-center underline"
                      >
                        {t("home.clubs.leaders", "Bjud in ledare")}
                      </Link>
                    </>
                  )}
                  <span className="text-muted">
                    {m.role === "admin" ? t("role.admin", "Admin") : t("role.leader", "Ledare")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/kom-igang/klubb"
            className="inline-flex min-h-11 items-center self-start text-sm font-medium underline"
          >
            {t("home.clubs.create", "Skapa en ny klubb")}
          </Link>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">{t("home.noClub.title", "Du är inte med i någon klubb än")}</h2>
          <p className="mt-2 text-muted">
            {t(
              "home.noClub.body",
              "Har du fått en inbjudan från din klubb? Öppna länken i inbjudan så kopplas ditt konto till klubben.",
            )}
          </p>
          <p className="mt-4 text-muted">{t("home.noClub.create.body", "Vill du starta klubbens bedömningar?")}</p>
          <Link
            href="/kom-igang/klubb"
            className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
          >
            {t("home.noClub.create", "Skapa en klubb")}
          </Link>
        </section>
      )}
    </>
  );
}
