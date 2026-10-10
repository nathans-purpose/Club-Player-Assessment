import { EditableText } from "@/components/text-edit";
import { formatScore } from "@/lib/format";
import type { Overview } from "@/lib/overview";
import { SQUAD_GROUPS } from "@/lib/players/squad-groups";
import type { OverviewCopy } from "./copy";

/** Fakta: short plain-language facts about the squad. */
export function Facts({ overview, copy }: { overview: Overview; copy: OverviewCopy }) {
  const { facts } = overview;
  const name = (id: string) => overview.categories.find((c) => c.id === id)?.name ?? "";
  const squad = [
    ...SQUAD_GROUPS.filter((g) => facts.groupCounts[g] > 0).map(
      (g) => `${facts.groupCounts[g]} ${copy.groups[g].toLocaleLowerCase("sv")}`,
    ),
    ...(facts.withoutGroup > 0 ? [copy.facts.withoutGroup.replace("{n}", String(facts.withoutGroup))] : []),
  ];

  const items = [
    squad.length > 0 && copy.facts.squad.replace("{list}", squad.join(", ")),
    facts.thinPositions.length > 0
      ? copy.facts.thin.replace(
          "{list}",
          facts.thinPositions
            .map(
              (p) =>
                `${copy.positions[p.code]} (${copy.pitch.coverage.replace("{strong}", String(p.strongCount)).replace("{target}", String(p.target))})`,
            )
            .join(", "),
        )
      : overview.pitch.length > 0 && copy.facts.thinNone,
    facts.strongestCategory &&
      copy.facts.strongest
        .replace("{category}", name(facts.strongestCategory.id))
        .replace("{value}", formatScore(facts.strongestCategory.average)),
    facts.weakestCategory &&
      copy.facts.weakest
        .replace("{category}", name(facts.weakestCategory.id))
        .replace("{value}", formatScore(facts.weakestCategory.average)),
    facts.mostDisputedCategory &&
      copy.facts.disputed
        .replace("{category}", name(facts.mostDisputedCategory.id))
        .replace("{n}", String(facts.mostDisputedCategory.players)),
    facts.fewAssessments > 0 ? copy.facts.few.replace("{n}", String(facts.fewAssessments)) : copy.facts.fewNone,
    facts.lowAttendance > 0 && copy.facts.lowAttendance.replace("{n}", String(facts.lowAttendance)),
  ].filter((item): item is string => Boolean(item));

  return (
    <section
      aria-labelledby="facts-heading"
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
    >
      <EditableText as="h2" id="facts-heading" className="text-lg font-semibold" {...copy.editable.facts} />
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
