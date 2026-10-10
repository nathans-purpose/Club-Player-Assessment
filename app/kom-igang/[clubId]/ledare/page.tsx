import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { formatInviteExpiry, inviteMailto, invitePath } from "@/lib/invites";
import { requireAdminClub } from "@/lib/onboarding/club";
import { siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { Stepper } from "../../stepper";
import { createLinkInvite } from "./actions";
import { LeadersForm } from "./leaders-form";

export const metadata: Metadata = { title: `Bjud in ledarna – ${APP_NAME}` };

// Kom igång 4: invite leaders by email or with a shareable link.
export default function LeadersStepPage({ params }: PageProps<"/kom-igang/[clubId]/ledare">) {
  return (
    <>
      <Stepper current={4} />
      <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
        <LeadersStep params={params} />
      </Suspense>
    </>
  );
}

const roleLabel = (role: string) => (role === "admin" ? t("role.admin", "Admin") : t("role.leader", "Ledare"));

async function LeadersStep({ params }: Pick<PageProps<"/kom-igang/[clubId]/ledare">, "params">) {
  const { clubId } = await params;
  const { club, userId } = await requireAdminClub(clubId);

  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: members }, { data: invites }, origin] = await Promise.all([
    supabase.from("club_members").select("user_id, role").eq("club_id", clubId).order("joined_at"),
    supabase
      .from("invites")
      .select("id, email, role, token, expires_at")
      .eq("club_id", clubId)
      .is("accepted_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false }),
    siteOrigin(),
  ]);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      (members ?? []).map((m) => m.user_id),
    );
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const emailInvites = (invites ?? []).filter((i) => i.email);
  const linkInvite = (invites ?? []).find((i) => !i.email && i.role === "leader");
  const linkUrl = linkInvite ? origin + invitePath(linkInvite.token) : null;

  const copyLabels = {
    label: t("onboarding.leaders.copyLink", "Kopiera länk"),
    copiedLabel: t("onboarding.leaders.copied", "Kopierad!"),
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">{t("onboarding.leaders.title", "Bjud in ledarna")}</h1>
          <p className="mt-2 text-muted">
            {t(
              "onboarding.leaders.intro",
              "Ledarna bedömer spelarna var för sig. Admins kan dessutom ändra inställningar och bjuda in fler.",
            )}
          </p>
        </div>

        <section aria-labelledby="email-invites" className="flex flex-col gap-3">
          <h2 id="email-invites" className="text-lg font-semibold">
            {t("onboarding.leaders.byEmail", "Bjud in med e-post")}
          </h2>
          <LeadersForm
            clubId={clubId}
            copy={{
              email: t("onboarding.leaders.email", "E-postadress"),
              emailPlaceholder: t("onboarding.leaders.emailPlaceholder", "namn@exempel.se"),
              role: t("onboarding.leaders.role", "Roll"),
              leader: t("role.leader", "Ledare"),
              admin: t("role.admin", "Admin"),
              rowLabel: t("onboarding.leaders.rowLabel", "Ledare {n}"),
              removeLabel: t("onboarding.leaders.removeLabel", "Ta bort rad {n}"),
              addRow: t("onboarding.leaders.addRow", "+ Lägg till ledare"),
              submit: t("onboarding.leaders.submit", "Skapa inbjudningar"),
              submitting: t("onboarding.leaders.submitting", "Skapar …"),
              invalidEmail: t("onboarding.leaders.invalidEmail", "Skriv en giltig e-postadress."),
              created: t("onboarding.leaders.created", "{count} inbjudningar är skapade. Skicka länkarna nedan."),
              createdOne: t("onboarding.leaders.createdOne", "Inbjudan är skapad. Skicka länken nedan."),
              skipped: t("onboarding.leaders.skipped", "Redan inbjudna eller med i klubben: {emails}."),
            }}
          />
        </section>

        {emailInvites.length > 0 && (
          <section aria-labelledby="pending-invites" className="flex flex-col gap-3">
            <h2 id="pending-invites" className="text-lg font-semibold">
              {t("onboarding.leaders.pending", "Väntar på svar")}
            </h2>
            <p className="text-sm text-muted">
              {t(
                "onboarding.leaders.pendingHint",
                "Skicka länken till var och en, till exempel med knappen Skicka e-post som öppnar ditt e-postprogram. Länken fungerar bara för den adressen.",
              )}
            </p>
            <ul className="flex flex-col gap-2">
              {emailInvites.map((invite) => {
                const link = origin + invitePath(invite.token);
                const expires = formatInviteExpiry(invite.expires_at);
                return (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invite.email}</p>
                      <p className="text-sm text-muted">
                        {roleLabel(invite.role)} ·{" "}
                        {t("onboarding.leaders.expires", "gäller till {date}").replace("{date}", expires)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={link} {...copyLabels} />
                      <a
                        href={inviteMailto({
                          email: invite.email!,
                          clubName: club.name,
                          appName: APP_NAME,
                          link,
                          expires,
                          role: invite.role as "admin" | "leader",
                        })}
                        className="flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
                      >
                        {t("onboarding.leaders.sendEmail", "Skicka e-post")}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section
          aria-labelledby="link-invite"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <h2 id="link-invite" className="text-lg font-semibold">
            {t("onboarding.leaders.link.title", "Inbjudningslänk")}
          </h2>
          <p className="text-sm text-muted">
            {t(
              "onboarding.leaders.link.body",
              "Dela länken i till exempel ledargruppens chatt. Alla som öppnar den blir ledare i klubben. Den gäller i 7 dagar.",
            )}
          </p>
          {linkUrl && linkInvite ? (
            <>
              <label htmlFor="invite-link" className="sr-only">
                {t("onboarding.leaders.link.title", "Inbjudningslänk")}
              </label>
              <input
                id="invite-link"
                readOnly
                value={linkUrl}
                className="min-h-11 w-full rounded-lg border border-border bg-surface-muted px-3 font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={linkUrl} {...copyLabels} />
                <span className="text-sm text-muted">
                  {t("onboarding.leaders.expires", "gäller till {date}").replace(
                    "{date}",
                    formatInviteExpiry(linkInvite.expires_at),
                  )}
                </span>
              </div>
            </>
          ) : (
            <form action={createLinkInvite.bind(null, clubId)}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted"
              >
                {t("onboarding.leaders.link.create", "Skapa inbjudningslänk")}
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="members" className="flex flex-col gap-3">
          <h2 id="members" className="text-lg font-semibold">
            {t("onboarding.leaders.members", "Med i klubben")}
          </h2>
          <ul className="flex flex-col gap-2">
            {(members ?? []).map((m) => {
              const p = profileById.get(m.user_id);
              return (
                <li
                  key={m.user_id}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2"
                >
                  <span className="min-w-0 truncate">
                    {p?.full_name || p?.email}
                    {m.user_id === userId && <span className="text-muted"> ({t("common.you", "du")})</span>}
                  </span>
                  <span className="text-sm text-muted">{roleLabel(m.role)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="border-t border-border pt-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
          >
            {t("onboarding.leaders.done", "Klart, gå till startsidan")}
          </Link>
        </div>
      </div>

      <aside aria-labelledby="next-steps" className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-border bg-surface-muted p-4">
          <h2 id="next-steps" className="font-semibold">
            {t("onboarding.next.title", "Nästa steg (valfritt)")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t(
              "onboarding.next.body",
              "Klubben fungerar redan med standardinställningarna. Du kan anpassa dem när du vill under Inställningar.",
            )}
          </p>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            <li>
              <Link
                href={`/klubb/${clubId}/installningar/visuell-identitet`}
                className="inline-flex min-h-11 items-center font-medium underline"
              >
                {t("onboarding.next.identity", "Visuell identitet")}
              </Link>
              <p className="text-muted">{t("onboarding.next.identityBody", "Klubbens färger, typsnitt och logga.")}</p>
            </li>
            <li>
              <Link
                href={`/klubb/${clubId}/installningar/kategorier`}
                className="inline-flex min-h-11 items-center font-medium underline"
              >
                {t("onboarding.next.categories", "Bedömningskategorier")}
              </Link>
              <p className="text-muted">
                {t("onboarding.next.categoriesBody", "Vad ledarna betygsätter. Sex kategorier finns förifyllda.")}
              </p>
            </li>
            <li>
              <Link
                href={`/klubb/${clubId}/installningar/positioner`}
                className="inline-flex min-h-11 items-center font-medium underline"
              >
                {t("onboarding.next.positions", "Positioner på planen")}
              </Link>
              <p className="text-muted">
                {t("onboarding.next.positionsBody", "Vilka positioner som visas och hur många ni behöver på varje.")}
              </p>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
