"use server";

import { loadClubContext } from "@/lib/assessment/data";
import { type EditableCategory, validateCategories } from "@/lib/settings/categories";
import { loadEditableCategories } from "@/lib/settings/data";

export type SaveCategoriesResult =
  | { ok: true; active: EditableCategory[]; removed: EditableCategory[] }
  | { ok: false; message: string };

/**
 * Saves the team's categories in one transaction (save_categories) and returns
 * them as stored, so new rows get their ids.
 */
export async function saveCategories(clubId: string, input: unknown): Promise<SaveCategoriesResult> {
  const checked = validateCategories(input);
  if (!checked.ok) return checked;

  const context = await loadClubContext(clubId);
  if (!context || context.role !== "admin" || !context.team) {
    return { ok: false, message: "Bara klubbens admins kan ändra kategorierna." };
  }
  const { supabase, team } = context;

  const { error } = await supabase.rpc("save_categories", {
    p_team_id: team.id,
    p_categories: checked.categories.map((c) => ({
      id: c.id,
      name: c.name,
      question: c.question,
      subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
    })),
  });
  if (error) return { ok: false, message: "Det gick inte att spara kategorierna. Ladda om sidan och försök igen." };

  return { ok: true, ...(await loadEditableCategories(supabase, team.id)) };
}
