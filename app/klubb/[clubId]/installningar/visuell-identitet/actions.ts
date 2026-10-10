"use server";

import Anthropic from "@anthropic-ai/sdk";
import { refresh } from "next/cache";
import { loadClubContext } from "@/lib/assessment/data";
import {
  BrandImportNotConfiguredError,
  BrandImportRefusedError,
  extractBrand,
  type BrandImage,
  UnreadableBrandDocumentError,
} from "@/lib/identity/extract";
import {
  ASSETS_BUCKET,
  BRAND_IMAGE_MAX_BYTES,
  BRAND_IMPORT_BUCKET,
  BRAND_MAX_HINT_CHARS,
  BRAND_MAX_IMAGES,
  parseBrandImagePath,
} from "@/lib/identity/files";
import { assetsBelongTo, FONT_SLOTS, type Identity, IdentitySchema, toRow } from "@/lib/identity/schema";
import { type BrandSuggestion, toBrandSuggestion } from "@/lib/identity/suggestion";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function isAdmin(clubId: string): Promise<boolean> {
  return (await loadClubContext(clubId))?.role === "admin";
}

export type ReadBrandResult = { status: "ok"; suggestion: BrandSuggestion } | { status: "error"; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the prepared pages of a brand document with Claude and returns a
 * suggestion for the editor. The pages are deleted whatever happens, and
 * nothing is saved: the admin reviews the suggestion first (spec §7.2).
 */
export async function readBrandDocument(
  clubId: string,
  batchId: string,
  paths: string[],
  hints: string,
): Promise<ReadBrandResult> {
  const parsed = paths.map((p) => parseBrandImagePath(clubId, batchId, p));
  if (
    !UUID_PATTERN.test(batchId) ||
    paths.length === 0 ||
    paths.length > BRAND_MAX_IMAGES ||
    parsed.some((p, i) => !p || p.index !== i)
  ) {
    return { status: "error", message: "Dokumentet hittades inte. Ladda upp det igen." };
  }
  if (!(await isAdmin(clubId))) return { status: "error", message: "Bara klubbens administratörer kan göra det här." };

  const supabase = await createClient();
  const bucket = supabase.storage.from(BRAND_IMPORT_BUCKET);
  try {
    const images: BrandImage[] = [];
    for (const [i, path] of paths.entries()) {
      const { data: blob, error } = await bucket.download(path);
      if (error || !blob) return { status: "error", message: "Dokumentet hittades inte. Ladda upp det igen." };
      if (blob.size > BRAND_IMAGE_MAX_BYTES) return { status: "error", message: "Dokumentet är för stort." };
      images.push({ contentType: parsed[i]!.contentType, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    const extracted = await extractBrand(images, hints.slice(0, BRAND_MAX_HINT_CHARS));
    const suggestion = toBrandSuggestion(extracted, images.length);
    if (!suggestion.colors.length && !suggestion.logos.length && !suggestion.fonts.heading && !suggestion.fonts.body) {
      return {
        status: "error",
        message: "Vi hittade inga färger, loggor eller typsnitt i dokumentet. Prova ett annat eller fyll i för hand.",
      };
    }
    return { status: "ok", suggestion };
  } catch (error) {
    if (error instanceof BrandImportNotConfiguredError) {
      return {
        status: "error",
        message: "Dokumentimport är inte påslagen ännu. Fyll i färger, typsnitt och loggor för hand i stället.",
      };
    }
    if (error instanceof UnreadableBrandDocumentError || error instanceof BrandImportRefusedError) {
      return { status: "error", message: "Dokumentet gick inte att läsa. Prova en PDF eller en tydligare bild." };
    }
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { status: "error", message: "Tjänsten som läser dokument är upptagen just nu. Försök igen om en stund." };
    }
    console.error("Brand import failed", error);
    return { status: "error", message: "Dokumentet gick inte att läsa just nu. Försök igen." };
  } finally {
    const { error } = await bucket.remove([...paths, ...(await abandonedBatches(supabase, clubId, batchId))]);
    if (error) console.error("Could not delete brand document pages", error.message);
  }
}

const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** Pages of earlier imports that were never read, e.g. when a tab was closed mid-upload. */
async function abandonedBatches(supabase: Supabase, clubId: string, current: string): Promise<string[]> {
  const bucket = supabase.storage.from(BRAND_IMPORT_BUCKET);
  const { data: folders } = await bucket.list(clubId, { limit: 100 });
  const stale: string[] = [];
  const cutoff = Date.now() - ABANDONED_AFTER_MS;
  for (const folder of folders ?? []) {
    if (folder.name === current || !UUID_PATTERN.test(folder.name)) continue;
    const { data: files } = await bucket.list(`${clubId}/${folder.name}`, { limit: 20 });
    for (const f of files ?? []) {
      if (f.created_at && Date.parse(f.created_at) < cutoff) stale.push(`${clubId}/${folder.name}/${f.name}`);
    }
  }
  return stale;
}

export type SaveIdentityResult = { status: "saved" } | { status: "error"; message: string };

/**
 * "Spara och använd för hela klubben": stores the identity and applies it.
 * Logos and font files are already uploaded by the browser; files in the
 * club's folder that the identity no longer uses are deleted afterwards.
 */
export async function saveIdentity(clubId: string, input: Identity): Promise<SaveIdentityResult> {
  const parsed = IdentitySchema.safeParse(input);
  if (!parsed.success || !assetsBelongTo(parsed.data, clubId)) {
    return { status: "error", message: "Något i den visuella identiteten är inte giltigt. Kontrollera fälten." };
  }
  if (!(await isAdmin(clubId))) return { status: "error", message: "Bara klubbens administratörer kan göra det här." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("club_identity")
    .upsert({ club_id: clubId, ...toRow(parsed.data), source_file_url: null, is_applied: true });
  if (error) return { status: "error", message: "Det gick inte att spara. Försök igen." };

  await removeUnusedAssets(supabase, clubId, parsed.data);
  refresh();
  return { status: "saved" };
}

async function removeUnusedAssets(supabase: Supabase, clubId: string, identity: Identity) {
  const used = new Set([
    ...identity.logos.map((l) => l.path),
    ...FONT_SLOTS.map((s) => identity.fonts[s]?.file).filter((f): f is string => Boolean(f)),
  ]);
  const bucket = supabase.storage.from(ASSETS_BUCKET);
  const unused: string[] = [];
  for (const folder of ["logos", "fonts"]) {
    const { data } = await bucket.list(`${clubId}/${folder}`, { limit: 100 });
    for (const f of data ?? []) {
      const path = `${clubId}/${folder}/${f.name}`;
      if (!used.has(path)) unused.push(path);
    }
  }
  if (unused.length) {
    const { error } = await bucket.remove(unused);
    if (error) console.error("Could not delete unused club assets", error.message);
  }
}

/** Goes back to the app's default look. The saved identity is kept, so it can be applied again. */
export async function stopUsingIdentity(clubId: string): Promise<SaveIdentityResult> {
  if (!(await isAdmin(clubId))) return { status: "error", message: "Bara klubbens administratörer kan göra det här." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_identity")
    .update({ is_applied: false })
    .eq("club_id", clubId)
    .select("club_id");
  if (error || !data?.length) return { status: "error", message: "Det gick inte att spara. Försök igen." };
  refresh();
  return { status: "saved" };
}
