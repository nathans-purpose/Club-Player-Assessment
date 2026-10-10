import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminClub = {
  userId: string;
  club: { id: string; name: string; crest_url: string | null };
  team: { id: string; name: string; game_format: number; has_minors: boolean } | null;
};

/**
 * Loads a club for the onboarding steps that only admins may use. Signed-out
 * visitors go to the login page; anyone else who is not an admin of the club
 * gets a 404, so club ids cannot be probed.
 */
export async function requireAdminClub(clubId: string): Promise<AdminClub> {
  if (!UUID_PATTERN.test(clubId)) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/logga-in");

  const [{ data: membership }, { data: club }, { data: team }] = await Promise.all([
    supabase.from("club_members").select("role").eq("club_id", clubId).eq("user_id", userId).maybeSingle(),
    supabase.from("clubs").select("id, name, crest_url").eq("id", clubId).maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, game_format, has_minors")
      .eq("club_id", clubId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!club || membership?.role !== "admin") notFound();
  return { userId, club, team };
}
