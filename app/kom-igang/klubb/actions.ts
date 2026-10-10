"use server";

import { redirect } from "next/navigation";
import { CREST_MAX_BYTES, CREST_TYPES } from "@/lib/onboarding/crest";
import { DEFAULT_CATEGORIES, DEFAULT_FORMATIONS, DEFAULT_PHASES, isGameFormat } from "@/lib/onboarding/defaults";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export type ClubFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"clubName" | "teamName" | "gameFormat" | "hasMinors" | "crest", string>>;
};

export async function createClub(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const clubName = String(formData.get("clubName") ?? "").trim();
  const teamName = String(formData.get("teamName") ?? "").trim();
  const gameFormat = Number(formData.get("gameFormat"));
  const hasMinors = formData.get("hasMinors");
  const crest = formData.get("crest");
  const crestFile = crest instanceof File && crest.size > 0 ? crest : null;

  const fieldErrors: ClubFormState["fieldErrors"] = {};
  if (!clubName) fieldErrors.clubName = "Skriv klubbens namn.";
  else if (clubName.length > 100) fieldErrors.clubName = "Namnet får vara högst 100 tecken.";
  if (!teamName) fieldErrors.teamName = "Skriv lagets namn.";
  else if (teamName.length > 60) fieldErrors.teamName = "Namnet får vara högst 60 tecken.";
  if (!isGameFormat(gameFormat)) fieldErrors.gameFormat = "Välj spelform.";
  if (hasMinors !== "ja" && hasMinors !== "nej") fieldErrors.hasMinors = "Svara ja eller nej.";
  if (crestFile && !CREST_TYPES[crestFile.type])
    fieldErrors.crest = "Klubbmärket ska vara en PNG-, JPG- eller WebP-bild.";
  else if (crestFile && crestFile.size > CREST_MAX_BYTES) fieldErrors.crest = "Klubbmärket får vara högst 2 MB.";
  if (Object.keys(fieldErrors).length > 0 || !isGameFormat(gameFormat)) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { data: clubId, error } = await supabase.rpc("create_club", {
    p_name: clubName,
    p_slug: slugify(clubName),
    p_team_name: teamName,
    p_game_format: gameFormat,
    p_has_minors: hasMinors === "ja",
    p_season_label: String(new Date().getFullYear()),
    p_phases: DEFAULT_PHASES,
    p_position_targets: DEFAULT_FORMATIONS[gameFormat].targets,
    p_categories: DEFAULT_CATEGORIES,
  });
  if (error || typeof clubId !== "string") {
    return { status: "error", message: "Det gick inte att skapa klubben. Försök igen." };
  }

  // The club exists now; a failed crest upload must not block the next step.
  let crestFailed = false;
  if (crestFile) {
    const path = `${clubId}/crest-${Date.now()}.${CREST_TYPES[crestFile.type]}`;
    const upload = await supabase.storage.from("club-crests").upload(path, crestFile, { contentType: crestFile.type });
    if (upload.error) {
      crestFailed = true;
    } else {
      const { data } = supabase.storage.from("club-crests").getPublicUrl(path);
      crestFailed = Boolean(
        (await supabase.from("clubs").update({ crest_url: data.publicUrl }).eq("id", clubId)).error,
      );
    }
  }

  redirect(`/kom-igang/${clubId}/spelare${crestFailed ? "?klubbmarke=fel" : ""}`);
}
