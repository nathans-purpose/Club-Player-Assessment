"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAdminClub } from "@/lib/onboarding/club";
import { UnreadableFileError } from "@/lib/players/import/convert";
import { extractPlayers, ImportNotConfiguredError, ImportRefusedError } from "@/lib/players/import/extract";
import { IMAGE_MAX_BYTES, IMPORT_BUCKET, IMPORT_MAX_BYTES, parseImportPath } from "@/lib/players/import/files";
import { toImportedRows, type ImportedRow } from "@/lib/players/import/schema";
import { createClient } from "@/lib/supabase/server";

export type ReadPlayerFileResult = { status: "ok"; rows: ImportedRow[] } | { status: "error"; message: string };

const MAX_ROWS = 200;

/**
 * Reads an uploaded squad list with Claude and returns rows for the review
 * table. The file is deleted from Storage whatever happens, and nothing is
 * saved to `players` here: the admin confirms the reviewed rows first.
 */
export async function readPlayerFile(clubId: string, path: string): Promise<ReadPlayerFileResult> {
  const fileType = parseImportPath(clubId, path);
  if (!fileType) return { status: "error", message: "Filen hittades inte. Ladda upp den igen." };
  await requireAdminClub(clubId);

  const supabase = await createClient();
  const bucket = supabase.storage.from(IMPORT_BUCKET);
  try {
    const { data: blob, error } = await bucket.download(path);
    if (error || !blob) return { status: "error", message: "Filen hittades inte. Ladda upp den igen." };
    const limit = fileType.kind === "image" ? IMAGE_MAX_BYTES : IMPORT_MAX_BYTES;
    if (blob.size > limit) return { status: "error", message: "Filen är för stor." };

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const extracted = await extractPlayers({ ...fileType, bytes });
    const rows = toImportedRows(extracted);
    if (rows.length === 0) {
      return { status: "error", message: "Vi hittade inga spelare i filen. Prova en annan fil eller skriv in dem." };
    }
    if (rows.length > MAX_ROWS) {
      return { status: "error", message: `Filen har fler än ${MAX_ROWS} spelare. Dela upp listan i flera filer.` };
    }
    return { status: "ok", rows };
  } catch (error) {
    if (error instanceof ImportNotConfiguredError) {
      return {
        status: "error",
        message: "Filimport är inte påslagen ännu. Skriv in eller klistra in spelarna i stället.",
      };
    }
    if (error instanceof UnreadableFileError || error instanceof ImportRefusedError) {
      return { status: "error", message: "Filen gick inte att läsa. Prova en tydligare bild eller ett annat format." };
    }
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { status: "error", message: "Tjänsten som läser filer är upptagen just nu. Försök igen om en stund." };
    }
    console.error("Player import failed", error);
    return { status: "error", message: "Filen gick inte att läsa just nu. Försök igen." };
  } finally {
    // Store nothing beyond the reviewed rows (spec §7.1).
    const { error } = await bucket.remove([path, ...(await abandonedUploads(bucket, clubId, path))]);
    if (error) console.error("Could not delete uploaded player list", error.message);
  }
}

const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** Uploads in the club's folder that were never read, e.g. when a tab was closed mid-upload. */
async function abandonedUploads(
  bucket: ReturnType<Awaited<ReturnType<typeof createClient>>["storage"]["from"]>,
  clubId: string,
  current: string,
): Promise<string[]> {
  const { data } = await bucket.list(clubId, { limit: 100 });
  const cutoff = Date.now() - ABANDONED_AFTER_MS;
  return (data ?? [])
    .filter((f) => f.created_at && Date.parse(f.created_at) < cutoff)
    .map((f) => `${clubId}/${f.name}`)
    .filter((p) => p !== current);
}
