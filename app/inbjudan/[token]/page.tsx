import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../logga-in/actions";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: `Inbjudan – ${APP_NAME}` };

type Preview = {
  club_name: string;
  role: "admin" | "leader";
  state: "ok" | "member" | "expired" | "used" | "wrong_email";
};

// Signed-out visitors are sent to the login page by the proxy and come back here.
export default function InvitePage({ params }: PageProps<"/inbjudan/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <p className="text-sm font-medium text-muted">{APP_NAME}</p>
      <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}

async function InviteContent({ params }: Pick<PageProps<"/inbjudan/[token]">, "params">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const preview = (data as Preview[] | null)?.[0];

  if (!preview) {
    return (
      <Message
        title={t("invite.notFound.title", "Inbjudan hittades inte")}
        body={t(
          "invite.notFound.body",
          "Kontrollera att du har kopierat hela länken, eller be klubbens admin om en ny.",
        )}
      />
    );
  }

  const role = preview.role === "admin" ? t("role.admin.lower", "admin") : t("role.leader.lower", "ledare");

  switch (preview.state) {
    case "member":
      return (
        <Message
          title={t("invite.member.title", "Du är redan med i {club}").replace("{club}", preview.club_name)}
          body={t("invite.member.body", "Du behöver inte göra något mer.")}
          home
        />
      );
    case "expired":
      return (
        <Message
          title={t("invite.expired.title", "Inbjudan har gått ut")}
          body={t("invite.expired.body", "Be klubbens admin i {club} om en ny inbjudan.").replace(
            "{club}",
            preview.club_name,
          )}
        />
      );
    case "used":
      return (
        <Message
          title={t("invite.used.title", "Inbjudan har redan använts")}
          body={t("invite.used.body", "Be klubbens admin i {club} om en ny inbjudan om du inte kommer in.").replace(
            "{club}",
            preview.club_name,
          )}
        />
      );
    case "wrong_email":
      return (
        <>
          <Message
            title={t("invite.wrongEmail.title", "Inbjudan gäller en annan e-postadress")}
            body={t(
              "invite.wrongEmail.body",
              "Logga ut och logga in igen med adressen som inbjudan till {club} skickades till.",
            ).replace("{club}", preview.club_name)}
          />
          <form action={signOut}>
            <input type="hidden" name="next" value={`/inbjudan/${token}`} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 font-medium hover:bg-surface-muted"
            >
              {t("nav.signOut", "Logga ut")}
            </button>
          </form>
        </>
      );
    case "ok":
      return (
        <>
          <div>
            <h1 className="text-2xl font-bold">
              {t("invite.ok.title", "Gå med i {club}").replace("{club}", preview.club_name)}
            </h1>
            <p className="mt-2 text-muted">
              {t(
                "invite.ok.body",
                "Du är inbjuden som {role}. Du bedömer spelarna på egen hand, och appen väger ihop allas bedömningar.",
              ).replace("{role}", role)}
            </p>
          </div>
          <AcceptForm
            token={token}
            submit={t("invite.ok.submit", "Gå med i {club}").replace("{club}", preview.club_name)}
            submitting={t("invite.ok.submitting", "Går med …")}
          />
        </>
      );
  }
}

function Message({ title, body, home = false }: { title: string; body: string; home?: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{body}</p>
      {home && (
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
        >
          {t("invite.home", "Till startsidan")}
        </Link>
      )}
    </div>
  );
}
