import { strToU8, zipSync } from "fflate";
import { NextResponse, type NextRequest } from "next/server";
import { loadClubContext } from "@/lib/assessment/data";
import { exportCsvFiles, exportFileName } from "@/lib/privacy/export";
import { loadClubExport } from "@/lib/privacy/data";

/**
 * Downloads all of the club's data (spec §8): `?format=json` (default) or
 * `?format=csv` for a zip with one CSV per table. Admins only.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/klubb/[clubId]/installningar/data/export">) {
  const { clubId } = await params;
  const context = await loadClubContext(clubId);
  if (!context || context.role !== "admin") return new NextResponse("Not found", { status: 404 });

  const data = await loadClubExport(context.supabase, clubId);
  const name = exportFileName(String(data.club?.slug ?? context.club.name), new Date());
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const files = exportCsvFiles(data);
    const zip = zipSync(Object.fromEntries(Object.entries(files).map(([file, csv]) => [file, strToU8(csv)])));
    return new NextResponse(Buffer.from(zip), {
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}-csv.zip"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.json"`,
    },
  });
}
