import "server-only";
import { cache } from "react";
import type { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { assetUrl } from "./files";
import { fromRow, type Identity, type IdentityRow } from "./schema";
import { themeCss } from "./theme";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type StoredIdentity = { identity: Identity; applied: boolean };

/** The club's saved identity, or null when there is none (or it does not pass the checks in fromRow). */
export async function loadIdentity(supabase: Supabase, clubId: string): Promise<StoredIdentity | null> {
  const { data } = await supabase
    .from("club_identity")
    .select("colors, fonts, logos, tone_words, is_applied")
    .eq("club_id", clubId)
    .maybeSingle<IdentityRow>();
  const identity = fromRow(data, clubId);
  return identity && data ? { identity, applied: data.is_applied } : null;
}

/** Public URL of a logo or font file in the club-assets bucket. */
export function clubAssetUrl(path: string): string {
  return assetUrl(supabaseEnv().url, path);
}

/** What the club's pages need: the stylesheet and the main logo. Null when no identity is applied. */
export const loadAppliedTheme = cache(async (
  supabase: Supabase,
  clubId: string,
): Promise<{ css: string; logoUrl: string | null } | null> => {
  const stored = await loadIdentity(supabase, clubId);
  if (!stored?.applied) return null;
  const logo = stored.identity.logos[0];
  return { css: themeCss(stored.identity, clubAssetUrl), logoUrl: logo ? clubAssetUrl(logo.path) : null };
});
