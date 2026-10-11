import type { Metadata } from "next";
import { Suspense } from "react";
import { EditableText } from "@/components/text-edit";
import { APP_NAME } from "@/lib/config";
import { t, te } from "@/lib/i18n";
import { common, evaluationCopy } from "@/lib/season/copy";
import { loadAreas, loadOwnEvaluation, requireSeason } from "@/lib/season/data";
import { nextSeasonLabel } from "@/lib/season/summary";
import { EvaluationForm } from "./evaluation-form";

export const metadata: Metadata = { title: `Min utvärdering – ${APP_NAME}` };

// The leader's own evaluation of the season, filled in alone. Drafts are
// saved as they go and are private until submitted.
export default function MyEvaluationPage({ params }: PageProps<"/klubb/[clubId]/sasong/[seasonId]/min-utvardering">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <MyEvaluation params={params} />
    </Suspense>
  );
}

async function MyEvaluation({ params }: Pick<PageProps<"/klubb/[clubId]/sasong/[seasonId]/min-utvardering">, "params">) {
  const { clubId, seasonId } = await params;
  const { supabase, userId, team, current } = await requireSeason(clubId, seasonId);
  const [areas, own] = await Promise.all([loadAreas(supabase, team.id), loadOwnEvaluation(supabase, current.id, userId)]);
  const next = nextSeasonLabel(current.label);
  const copy = evaluationCopy();

  return (
    <>
      <div>
        <EditableText as="h2" className="text-xl font-semibold" {...te("season.mine.title", "Min utvärdering")} />
        <EditableText
          as="p"
          className="mt-1 max-w-prose text-muted"
          {...te(
            "season.mine.intro",
            "Fyll i själv, utan att prata ihop er först. Betygsätt varje område 1–10 och svara om ni tränade tillräckligt på det. Lämna tomt om du inte kan bedöma. De andra ser dina svar först när du har skickat in.",
          )}
        />
        <details className="mt-2 max-w-prose text-sm">
          <summary className="min-h-11 cursor-pointer font-medium">{t("season.mine.scale", "Betygsskala")}</summary>
          <ul className="mt-1 flex flex-col gap-1">
            <li>{t("season.mine.scale.9", "9–10: En klar styrka, i nivå med de bästa lagen i serien")}</li>
            <li>{t("season.mine.scale.7", "7–8: Bra, fungerar för det mesta")}</li>
            <li>{t("season.mine.scale.5", "5–6: Godkänt, men inget vi vinner matcher på")}</li>
            <li>{t("season.mine.scale.3", "3–4: En svaghet som kostar oss poäng")}</li>
            <li>{t("season.mine.scale.1", "1–2: Fungerar inte")}</li>
          </ul>
        </details>
      </div>
      <EvaluationForm
        clubId={clubId}
        seasonId={current.id}
        areas={areas}
        submitted={own?.status === "submitted"}
        initial={own?.evaluation ?? null}
        copy={{
          ...copy,
          outlookLevel: next ? copy.outlookLevel.replace("nästa säsong", next) : copy.outlookLevel,
          outlookPosition: next ? copy.outlookPosition.replace("nästa säsong", next) : copy.outlookPosition,
          outlookKeyFactor: next ? copy.outlookKeyFactor.replace("nästa säsong", next) : copy.outlookKeyFactor,
        }}
        common={common()}
      />
    </>
  );
}
