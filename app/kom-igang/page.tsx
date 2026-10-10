import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "../logga-in/login-form";
import { loginCopy } from "../logga-in/copy";
import { Stepper } from "./stepper";

export const metadata: Metadata = { title: `Kom igång – ${APP_NAME}` };

const NEXT_STEP = "/kom-igang/klubb";

// Kom igång 1: account. Signed-in users go straight to the club step.
export default function AccountStepPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Stepper current={1} />
      <div>
        <h1 className="text-2xl font-bold">{t("onboarding.account.title", "Skapa ditt konto")}</h1>
        <p className="mt-2 text-muted">
          {t(
            "onboarding.account.intro",
            "Börja med att logga in. Sedan skapar du klubben, lägger till spelarna och bjuder in ledarna.",
          )}
        </p>
      </div>

      <Suspense fallback={<div className="min-h-64" />}>
        <AccountContent />
      </Suspense>

      <aside className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
        <p className="font-semibold">{t("login.invite.title", "Har du fått en inbjudan?")}</p>
        <p className="mt-1 text-muted">
          {t(
            "login.invite.body",
            "Använd länken i inbjudan i stället, så hamnar du direkt i rätt klubb. Du behöver inte skapa en ny klubb.",
          )}
        </p>
      </aside>
    </div>
  );
}

async function AccountContent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(NEXT_STEP);
  return <LoginForm next={NEXT_STEP} copy={loginCopy()} />;
}
