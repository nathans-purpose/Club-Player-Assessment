import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { loginCopy } from "./copy";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Logga in – ${APP_NAME}` };

const ERRORS: Record<string, string> = {
  google: "Inloggningen med Google misslyckades. Försök igen.",
  lank: "Länken är ogiltig eller har gått ut. Be om en ny nedan.",
};

export default function LoginPage({ searchParams }: PageProps<"/logga-in">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-sm font-medium text-muted">{APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("login.title", "Logga in eller skapa konto")}</h1>
        <p className="mt-2 text-muted">
          {t("login.intro", "Använd ditt Google-konto eller få en inloggningslänk till din e-post.")}
        </p>
      </div>

      <Suspense fallback={<div className="min-h-80" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>

    </main>
  );
}

// Reads the request (session and query string), so it streams in.
async function LoginContent({ searchParams }: Pick<PageProps<"/logga-in">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const errorKey = typeof params.fel === "string" ? params.fel : undefined;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);

  return (
    <>
      {errorKey && ERRORS[errorKey] && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {t(`login.error.${errorKey}`, ERRORS[errorKey])}
        </p>
      )}

      <LoginForm next={next} copy={loginCopy()} />

      {next.startsWith("/inbjudan/") ? (
        <aside className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
          <p className="font-semibold">{t("login.invited.title", "Logga in för att gå med i klubben")}</p>
          <p className="mt-1 text-muted">
            {t(
              "login.invited.body",
              "Använd samma e-postadress som inbjudan skickades till. Efter inloggningen kommer du tillbaka till inbjudan.",
            )}
          </p>
        </aside>
      ) : (
        <aside className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
          <p className="font-semibold">{t("login.invite.title", "Har du fått en inbjudan?")}</p>
          <p className="mt-1 text-muted">
            {t(
              "login.invite.body",
              "Använd länken i inbjudan i stället, så hamnar du direkt i rätt klubb. Du behöver inte skapa en ny klubb.",
            )}
          </p>
        </aside>
      )}
    </>
  );
}
