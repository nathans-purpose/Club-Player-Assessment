"use server";

import { createClient } from "@/lib/supabase/server";

export type DisplayOptionsState = { status: "idle" | "saved" | "error"; message?: string };

/** Club-wide display options; RLS lets only the club's admins change them. */
export async function saveDisplayOptions(
  clubId: string,
  _prev: DisplayOptionsState,
  formData: FormData,
): Promise<DisplayOptionsState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .update({
      anonymous_leader_view: formData.get("anonymousLeaderView") === "on",
      screen_friendly: formData.get("screenFriendly") === "on",
    })
    .eq("id", clubId)
    .select("id");
  if (error || !data?.length) return { status: "error", message: "Det gick inte att spara. Försök igen." };
  return { status: "saved" };
}
