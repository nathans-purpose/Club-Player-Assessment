"use server";

import { MIN_PASSWORD_LENGTH } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { status: "idle" | "saved" | "error"; message?: string };

/** Sets or changes the signed-in user's password, so they can skip the email link next time. */
export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", message: `Lösenordet måste ha minst ${MIN_PASSWORD_LENGTH} tecken.` };
  }
  if (password !== confirm) {
    return { status: "error", message: "Lösenorden är inte likadana." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    switch (error.code) {
      case "weak_password":
        return { status: "error", message: "Lösenordet är för svagt. Välj ett längre eller mindre vanligt lösenord." };
      case "same_password":
        return { status: "error", message: "Det är redan ditt lösenord." };
      case "reauthentication_needed":
        return {
          status: "error",
          message: "Av säkerhetsskäl behöver du logga ut och logga in med en ny länk innan du byter lösenord.",
        };
      default:
        return { status: "error", message: "Det gick inte att spara lösenordet. Försök igen." };
    }
  }
  return { status: "saved" };
}
