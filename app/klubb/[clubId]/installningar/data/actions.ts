"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, loadClubContext } from "@/lib/assessment/data";
import { createClient } from "@/lib/supabase/server";

export type DataActionResult = { ok: boolean; message?: string };

// Every bucket keeps a club's files under <club_id>/.
const CLUB_BUCKETS = ["club-crests", "club-assets", "player-imports", "brand-imports"] as const;

async function adminContext(clubId: string) {
  const context = isUuid(clubId) ? await loadClubContext(clubId) : null;
  return context?.role === "admin" ? context : null;
}

/** Hard-deletes a player and, through the foreign keys, every assessment of them. */
export async function deletePlayer(clubId: string, playerId: string): Promise<DataActionResult> {
  const context = await adminContext(clubId);
  if (!context?.team || !isUuid(playerId)) return { ok: false, message: "Spelaren kunde inte raderas." };
  const { data, error } = await context.supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("team_id", context.team.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Spelaren kunde inte raderas. Försök igen." };
  revalidatePath(`/klubb/${clubId}`, "layout");
  return { ok: true };
}

/** The admin confirms that guardians have been given the information text. */
export async function confirmGuardianInfo(clubId: string): Promise<DataActionResult> {
  const context = await adminContext(clubId);
  if (!context?.team) return { ok: false, message: "Det gick inte att spara." };
  const { data, error } = await context.supabase
    .from("teams")
    .update({ guardian_info_confirmed_at: new Date().toISOString() })
    .eq("id", context.team.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Det gick inte att spara. Försök igen." };
  revalidatePath(`/klubb/${clubId}`, "layout");
  return { ok: true };
}

type Bucket = ReturnType<Awaited<ReturnType<typeof createClient>>["storage"]["from"]>;

/** Every file under `prefix`, following sub-folders (entries without an id are folders). */
async function listFiles(bucket: Bucket, prefix: string, depth = 0): Promise<string[]> {
  const { data } = await bucket.list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id) files.push(path);
    else if (depth < 3) files.push(...(await listFiles(bucket, path, depth + 1)));
  }
  return files;
}

/**
 * Hard-deletes the whole club: its files in Storage first (the policies need
 * the admin's membership, which goes with the club), then the club row, which
 * cascades to members, invites, teams, players, assessments and settings.
 */
export async function deleteClub(clubId: string, confirmName: string): Promise<DataActionResult> {
  const context = await adminContext(clubId);
  if (!context) return { ok: false, message: "Klubben kunde inte raderas." };
  if (confirmName.trim() !== context.club.name.trim()) {
    return { ok: false, message: "Namnet stämmer inte med klubbens namn." };
  }

  for (const id of CLUB_BUCKETS) {
    const bucket = context.supabase.storage.from(id);
    const files = await listFiles(bucket, clubId);
    if (files.length) {
      const { error } = await bucket.remove(files);
      if (error)
        return { ok: false, message: "Klubbens filer kunde inte raderas. Inget har tagits bort ur databasen." };
    }
  }

  const { data, error } = await context.supabase.from("clubs").delete().eq("id", clubId).select("id");
  if (error || !data?.length) return { ok: false, message: "Klubben kunde inte raderas. Försök igen." };
  revalidatePath("/", "layout");
  redirect("/?raderad=1");
}
