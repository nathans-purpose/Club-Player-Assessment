"use server";

import { redirect } from "next/navigation";
import { isValidEmail } from "@/lib/email";
import { safeNextPath } from "@/lib/safe-redirect";
import { siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

async function callbackUrl(next: string) {
  const url = new URL("/auth/callback", await siteOrigin());
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "/");

  if (!isValidEmail(email)) {
    return { status: "error", message: "Skriv en giltig e-postadress.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(next) },
  });

  if (error) {
    return {
      status: "error",
      message:
        error.status === 429
          ? "För många försök. Vänta en stund och försök igen."
          : "Det gick inte att skicka länken. Försök igen.",
      email,
    };
  }
  return { status: "sent", email };
}

export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) {
    redirect("/logga-in?fel=google");
  }
  redirect(data.url);
}

export async function signOut(formData?: FormData) {
  const next = safeNextPath(formData?.get("next")?.toString(), "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(next ? `/logga-in?next=${encodeURIComponent(next)}` : "/logga-in");
}
