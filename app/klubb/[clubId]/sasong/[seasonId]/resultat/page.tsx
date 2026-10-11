import type { Metadata } from "next";
import { Suspense } from "react";
import { EditableText } from "@/components/text-edit";
import { APP_NAME } from "@/lib/config";
import { t, te } from "@/lib/i18n";
import { common, goalSourceLabels, resultsCopy } from "@/lib/season/copy";
import { loadMatches, loadReview, requireSeason } from "@/lib/season/data";
import { MatchesEditor } from "./matches-editor";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: `Resultat – ${APP_NAME}` };

// Resultat: the match log and the season's other facts, shared by the
// leaders. Sammanställning counts everything from here.
export default function ResultsPage({ params }: PageProps<"/klubb/[clubId]/sasong/[seasonId]/resultat">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Results params={params} />
    </Suspense>
  );
}

async function Results({ params }: Pick<PageProps<"/klubb/[clubId]/sasong/[seasonId]/resultat">, "params">) {
  const { clubId, seasonId } = await params;
  const { supabase, current } = await requireSeason(clubId, seasonId);
  const [matches, review] = await Promise.all([loadMatches(supabase, current.id), loadReview(supabase, current.id)]);
  const copy = resultsCopy();

  return (
    <>
      <div>
        <EditableText as="h2" className="text-xl font-semibold" {...te("season.results.title", "Resultat")} />
        <EditableText
          as="p"
          className="mt-1 max-w-prose text-muted"
          {...te("season.results.intro", "Alla ledare kan fylla i och rätta. Sammanställningen räknas fram härifrån.")}
        />
      </div>
      <MatchesEditor clubId={clubId} seasonId={current.id} initial={matches} copy={copy} common={common()} />
      <ReviewForm
        clubId={clubId}
        seasonId={current.id}
        initial={review}
        copy={copy}
        common={common()}
        sourceLabels={goalSourceLabels()}
      />
    </>
  );
}
