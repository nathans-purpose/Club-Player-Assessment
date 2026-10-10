"use server";

import { redirect } from "next/navigation";
import { isBlankRow, reviewStatuses, type ReviewRow } from "@/lib/players/review";
import { isSquadGroup } from "@/lib/players/squad-groups";
import { createClient } from "@/lib/supabase/server";

export type SavePlayersState = { status: "idle" | "error"; message?: string };

const MAX_PLAYERS = 200;

/** Saves the reviewed rows as players of the club's first team. */
export async function savePlayers(
  clubId: string,
  _prev: SavePlayersState,
  formData: FormData,
): Promise<SavePlayersState> {
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    input = null;
  }
  if (!Array.isArray(input)) return { status: "error", message: "Listan kunde inte läsas. Försök igen." };

  const rows: ReviewRow[] = input
    .map((r) => ({
      shirtNumber: typeof r?.shirtNumber === "string" ? r.shirtNumber.trim() : "",
      fullName: typeof r?.fullName === "string" ? r.fullName.trim().replace(/\s+/g, " ") : "",
      squadGroup: isSquadGroup(r?.squadGroup) ? r.squadGroup : "",
    }))
    .filter((r) => !isBlankRow(r));

  if (rows.length === 0) return { status: "error", message: "Lägg till minst en spelare, eller hoppa över steget." };
  if (rows.length > MAX_PLAYERS) return { status: "error", message: `Högst ${MAX_PLAYERS} spelare åt gången.` };
  if (rows.some((r) => !r.fullName)) return { status: "error", message: "Alla spelare behöver ett namn." };
  if (rows.some((r) => r.fullName.length > 100 || r.shirtNumber.length > 10)) {
    return { status: "error", message: "Ett namn eller nummer är för långt." };
  }

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("club_id", clubId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!team) return { status: "error", message: "Laget hittades inte." };

  const { data: existing } = await supabase.from("players").select("shirt_number, full_name").eq("team_id", team.id);
  const statuses = reviewStatuses(
    rows,
    (existing ?? []).map((p) => ({ shirtNumber: p.shirt_number, fullName: p.full_name })),
  );
  if (statuses.includes("dubblett")) {
    return { status: "error", message: "Ta bort eller ändra dubbletterna innan du sparar." };
  }

  const { error } = await supabase.from("players").insert(
    rows.map((r) => ({
      team_id: team.id,
      shirt_number: r.shirtNumber || null,
      full_name: r.fullName,
      squad_group: r.squadGroup || null,
    })),
  );
  if (error) return { status: "error", message: "Det gick inte att spara spelarna. Försök igen." };

  redirect(`/kom-igang/${clubId}/ledare`);
}
