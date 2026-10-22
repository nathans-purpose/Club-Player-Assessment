import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME, MIN_PASSWORD_LENGTH } from "@/lib/config";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: `Mitt konto – ${APP_NAME}` };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm font-medium text-muted underline underline-offset-2">
          {t("account.back", "Till startsidan")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("account.title", "Mitt konto")}</h1>
      </div>
      <Suspense fallback={<div className="min-h-80" />}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

// Reads the session, so it streams in.
async function AccountContent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (!data?.claims) redirect("/logga-in?next=/konto");

  return (
    <section aria-labelledby="password-heading" className="flex flex-col gap-3">
      <h2 id="password-heading" className="text-lg font-semibold">
        {t("account.password.title", "Lösenord")}
      </h2>
      <p className="text-muted">
        {t(
          "account.password.intro",
          "Med ett lösenord loggar du in direkt med {email} och lösenordet, utan att vänta på en länk i e-posten. Inloggningslänken fungerar fortfarande, till exempel om du glömmer lösenordet.",
        ).replace("{email}", email ?? "")}
      </p>
      <PasswordForm
        email={email ?? ""}
        copy={{
          password: t("account.password.new", "Nytt lösenord"),
          confirm: t("account.password.confirm", "Skriv lösenordet igen"),
          hint: t("account.password.hint", "Minst {min} tecken.").replace("{min}", String(MIN_PASSWORD_LENGTH)),
          save: t("account.password.save", "Spara lösenord"),
          saving: t("common.saving", "Sparar …"),
          saved: t("account.password.saved", "Lösenordet är sparat. Nästa gång kan du logga in med det."),
        }}
      />
    </section>
  );
}
