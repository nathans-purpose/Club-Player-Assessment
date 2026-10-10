"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AcceptInviteState = { status: "idle" | "error"; message?: string };

export async function acceptInvite(token: string): Promise<AcceptInviteState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    return {
      status: "error",
      message: "Det gick inte att gå med i klubben. Inbjudan kan ha gått ut eller redan använts.",
    };
  }
  redirect("/");
}
