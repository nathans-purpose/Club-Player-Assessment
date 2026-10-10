import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPlayers, requireClubAdmin } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { EditableText } from "@/components/text-edit";
import { t, te } from "@/lib/i18n";
import { MAX_CATEGORIES, MAX_SUBCATEGORIES, RATINGS_WARNING_ABOVE } from "@/lib/settings/categories";
import { loadEditableCategories } from "@/lib/settings/data";
import { CategoriesEditor } from "./categories-editor";

export const metadata: Metadata = { title: `Bedömningskategorier – ${APP_NAME}` };

// Bedömningskategorier (admins only): add, rename, reorder, set the question
// and deepen categories with subcategories.
export default function CategoriesPage({ params }: PageProps<"/klubb/[clubId]/installningar/kategorier">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Categories params={params} />
    </Suspense>
  );
}

async function Categories({ params }: Pick<PageProps<"/klubb/[clubId]/installningar/kategorier">, "params">) {
  const { clubId } = await params;
  const { supabase, club, team } = await requireClubAdmin(clubId);

  return (
    <>
      <div>
        <Link href={`/klubb/${clubId}/installningar`} className="inline-flex min-h-11 items-center text-sm underline">
          {t("settings.back", "← Inställningar")}
        </Link>
        <p className="text-sm text-muted">{[club.name, team?.name].filter(Boolean).join(" · ")}</p>
        <EditableText
          as="h1"
          className="mt-1 text-2xl font-bold"
          {...te("settings.categories", "Bedömningskategorier")}
        />
        <EditableText
          as="p"
          className="mt-2 max-w-prose text-muted"
          {...te(
            "settings.categories.intro",
            "Ledarna ger varje spelare ett betyg 1–10 i varje kategori. Fördjupa en kategori för att betygsätta den i flera delar; kategorins betyg blir då snittet av delarna.",
          )}
        />
      </div>
      {team ? (
        <CategoriesEditor clubId={clubId} {...await loadEditable(supabase, team.id)} />
      ) : (
        <EditableText
          as="p"
          className="rounded-lg border border-border bg-surface p-4"
          {...te("settings.noTeam", "Klubben har inget lag ännu.")}
        />
      )}
    </>
  );
}

async function loadEditable(supabase: Parameters<typeof loadEditableCategories>[0], teamId: string) {
  const [categories, players] = await Promise.all([
    loadEditableCategories(supabase, teamId),
    loadPlayers(supabase, teamId),
  ]);
  return {
    initialActive: categories.active,
    initialRemoved: categories.removed,
    playerCount: players.length,
    copy: categoriesCopy(),
  };
}

function categoriesCopy() {
  return {
    listLabel: t("settings.categories.list", "Kategorier"),
    name: t("settings.categories.name", "Namn"),
    question: t("settings.categories.question", "Fråga till ledarna"),
    questionHint: t("settings.categories.questionHint", "Visas under kategorin i formuläret."),
    moveUp: t("settings.categories.moveUp", "Flytta upp {name}"),
    moveDown: t("settings.categories.moveDown", "Flytta ned {name}"),
    remove: t("settings.categories.remove", "Ta bort"),
    removeLabel: t("settings.categories.removeLabel", "Ta bort {name}"),
    removed: t("settings.categories.removedToast", "{name} tas bort när du sparar."),
    undo: t("common.undo", "Ångra"),
    deepen: t("settings.categories.deepen", "Fördjupa"),
    deepenHint: t("settings.categories.deepenHint", "Betygsätt kategorin i flera delar."),
    subcategories: t("settings.categories.subcategories", "Underkategorier i {name}"),
    subcategoryName: t("settings.categories.subcategoryName", "Underkategori {n}"),
    addSubcategory: t("settings.categories.addSubcategory", "+ Lägg till underkategori"),
    removeSubcategory: t("settings.categories.removeSubcategory", "Ta bort underkategori {n}"),
    addCategory: t("settings.categories.add", "+ Lägg till kategori"),
    newCategory: t("settings.categories.new", "Ny kategori"),
    maxCategories: t("settings.categories.max", "Högst {n} kategorier.").replace("{n}", String(MAX_CATEGORIES)),
    maxSubcategories: String(MAX_SUBCATEGORIES),
    summaryTitle: t("settings.categories.summary", "Så mycket blir det"),
    summaryRatings: t("settings.categories.summaryRatings", "{n} betyg per spelare"),
    summaryMinutes: t(
      "settings.categories.summaryMinutes",
      "Ungefär {perPlayer} min per spelare, {squad} min för hela truppen ({players} spelare) per ledare.",
    ),
    summaryMinutesNoPlayers: t(
      "settings.categories.summaryMinutesNoPlayers",
      "Ungefär {perPlayer} min per spelare och ledare.",
    ),
    summaryWarning: t(
      "settings.categories.summaryWarning",
      "Mer än {n} betyg per spelare gör bedömningen lång, och då slarvar ledarna. Fundera på att slå ihop eller ta bort något.",
    ).replace("{n}", String(RATINGS_WARNING_ABOVE)),
    removedTitle: t("settings.categories.removedTitle", "Borttagna kategorier"),
    removedHint: t(
      "settings.categories.removedHint",
      "Borttagna kategorier syns inte i nya bedömningar eller i översikten, men betyg som redan har getts sparas.",
    ),
    restore: t("settings.categories.restore", "Återställ"),
    restoreLabel: t("settings.categories.restoreLabel", "Återställ {name}"),
    historyNote: t(
      "settings.categories.historyNote",
      "Inget betyg raderas. Ändrar du en kategori mitt i säsongen behåller de betyg som redan har getts sitt värde.",
    ),
    save: t("common.saveChanges", "Spara ändringar"),
    saving: t("common.saving", "Sparar …"),
    saved: t("common.saved", "Sparat"),
    unsaved: t("common.unsaved", "Osparade ändringar"),
    untitled: t("settings.categories.untitled", "kategorin"),
  };
}

export type CategoriesCopy = ReturnType<typeof categoriesCopy>;
