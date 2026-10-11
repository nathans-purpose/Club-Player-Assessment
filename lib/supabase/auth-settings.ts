import "server-only";
import { supabaseEnv } from "./env";

// Whether Google sign-in is switched on in the Supabase project. When it is
// off, Supabase answers the Google redirect with a bare JSON error page, so
// the login page hides the button instead. Assumes "on" if the check fails.
export async function isGoogleLoginEnabled(): Promise<boolean> {
  const { url, key } = supabaseEnv();
  try {
    const res = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return true;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google !== false;
  } catch {
    return true;
  }
}
