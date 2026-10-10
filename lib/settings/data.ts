import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { EditableCategory } from "./categories";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Row = {
  id: string;
  name: string;
  question: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories: { id: string; name: string; is_active: boolean; sort_order: number }[];
};

/**
 * The team's categories for the settings editor: the active ones in order,
 * and the removed (inactive) ones that can be restored. Only active
 * subcategories are edited; removed ones stay in the history.
 */
export async function loadEditableCategories(
  supabase: Supabase,
  teamId: string,
): Promise<{ active: EditableCategory[]; removed: EditableCategory[] }> {
  const { data } = await supabase
    .from("categories")
    .select("id, name, question, is_active, sort_order, subcategories(id, name, is_active, sort_order)")
    .eq("team_id", teamId)
    .order("sort_order")
    .returns<Row[]>();
  const toEditable = (c: Row): EditableCategory => ({
    id: c.id,
    name: c.name,
    question: c.question ?? "",
    subcategories: c.subcategories
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.id, name: s.name })),
  });
  const rows = data ?? [];
  return {
    active: rows.filter((c) => c.is_active).map(toEditable),
    removed: rows
      .filter((c) => !c.is_active)
      .sort((a, b) => a.name.localeCompare(b.name, "sv"))
      .map(toEditable),
  };
}
