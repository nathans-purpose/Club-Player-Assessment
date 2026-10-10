"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/assessment/data";
import { planTextChanges, type TextChange } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export type SaveTextsResult = { ok: boolean; message?: string };

/**
 * Saves texts edited in "Redigera texter". RLS lets only the club's admins
 * write ui_text_overrides; a text set back to its default is removed.
 */
export async function saveTexts(clubId: string, changes: TextChange[]): Promise<SaveTextsResult> {
  if (!isUuid(clubId) || !Array.isArray(changes) || changes.length > 500) {
    return { ok: false, message: "Ändringarna kunde inte sparas." };
  }
  const plan = planTextChanges(
    changes.map((c) => ({
      key: String(c?.key ?? ""),
      value: String(c?.value ?? ""),
      fallback: String(c?.fallback ?? ""),
    })),
  );
  if (plan.invalid.length) return { ok: false, message: "En av texterna är för lång eller har en ogiltig nyckel." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, message: "Du är inte inloggad." };
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership?.role !== "admin") return { ok: false, message: "Bara klubbens admins kan ändra texterna." };

  if (plan.upsert.length) {
    const { error } = await supabase.from("ui_text_overrides").upsert(
      plan.upsert.map((row) => ({ club_id: clubId, ...row })),
      { onConflict: "club_id,key" },
    );
    if (error) return { ok: false, message: "Det gick inte att spara. Försök igen." };
  }
  if (plan.remove.length) {
    const { error } = await supabase.from("ui_text_overrides").delete().eq("club_id", clubId).in("key", plan.remove);
    if (error) return { ok: false, message: "Det gick inte att spara. Försök igen." };
  }

  revalidatePath(`/klubb/${clubId}`, "layout");
  revalidatePath(`/kom-igang/${clubId}`, "layout");
  return { ok: true };
}
