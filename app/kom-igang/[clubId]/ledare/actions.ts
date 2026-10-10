"use server";

import { refresh } from "next/cache";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export type InviteRowError = { index: number; message: string };
export type CreateInvitesState = {
  status: "idle" | "error" | "done";
  message?: string;
  rowErrors?: InviteRowError[];
  created?: number;
  skipped?: string[];
};

const MAX_INVITES = 50;

/** Creates one single-use invite per email. The invite links are shown on the page. */
export async function createInvites(
  clubId: string,
  _prev: CreateInvitesState,
  formData: FormData,
): Promise<CreateInvitesState> {
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    input = null;
  }
  if (!Array.isArray(input)) return { status: "error", message: "Listan kunde inte läsas. Försök igen." };

  const rows = input.map((r) => ({
    email: typeof r?.email === "string" ? r.email.trim() : "",
    role: r?.role === "admin" ? ("admin" as const) : ("leader" as const),
  }));

  const rowErrors: InviteRowError[] = [];
  const seen = new Set<string>();
  rows.forEach((r, index) => {
    if (!r.email) return;
    if (!isValidEmail(r.email)) rowErrors.push({ index, message: "Skriv en giltig e-postadress." });
    else if (seen.has(normalizeEmail(r.email))) rowErrors.push({ index, message: "Adressen finns redan i listan." });
    seen.add(normalizeEmail(r.email));
  });
  if (rowErrors.length > 0) return { status: "error", rowErrors };

  const wanted = rows.filter((r) => r.email).map((r) => ({ ...r, email: normalizeEmail(r.email) }));
  if (wanted.length === 0) return { status: "error", message: "Skriv minst en e-postadress." };
  if (wanted.length > MAX_INVITES) return { status: "error", message: `Högst ${MAX_INVITES} inbjudningar åt gången.` };

  const supabase = await createClient();
  const emails = wanted.map((r) => r.email);
  const [{ data: pending }, { data: members }] = await Promise.all([
    supabase
      .from("invites")
      .select("email")
      .eq("club_id", clubId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .in("email", emails),
    supabase.from("club_members").select("user_id").eq("club_id", clubId),
  ]);
  // Fellow members' profiles are readable (profiles_select).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .in(
      "id",
      (members ?? []).map((m) => m.user_id),
    );

  const memberEmails = new Set((profiles ?? []).flatMap((p) => (p.email ? [normalizeEmail(p.email)] : [])));
  const pendingEmails = new Set((pending ?? []).map((p) => p.email));
  const skipped = emails.filter((e) => memberEmails.has(e) || pendingEmails.has(e));
  const toCreate = wanted.filter((r) => !skipped.includes(r.email));

  if (toCreate.length > 0) {
    const { error } = await supabase
      .from("invites")
      .insert(toCreate.map((r) => ({ club_id: clubId, email: r.email, role: r.role })));
    if (error) return { status: "error", message: "Det gick inte att skapa inbjudningarna. Försök igen." };
  }

  refresh();
  return { status: "done", created: toCreate.length, skipped };
}

/** Creates a shareable link invite (role leader, valid for 7 days). */
export async function createLinkInvite(clubId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("invites").insert({ club_id: clubId, email: null, role: "leader" });
  refresh();
}
