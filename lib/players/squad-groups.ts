export const SQUAD_GROUPS = ["MV", "FÖ", "MF", "AN"] as const;
export type SquadGroup = (typeof SQUAD_GROUPS)[number];

export const SQUAD_GROUP_LABELS: Record<SquadGroup, string> = {
  MV: "Målvakt",
  FÖ: "Försvar",
  MF: "Mittfält",
  AN: "Anfall",
};

export function isSquadGroup(value: unknown): value is SquadGroup {
  return typeof value === "string" && (SQUAD_GROUPS as readonly string[]).includes(value);
}

// Words people write for each squad group, lowercased.
const GROUP_WORDS: Record<string, SquadGroup> = {
  mv: "MV",
  målvakt: "MV",
  malvakt: "MV",
  keeper: "MV",
  gk: "MV",
  fö: "FÖ",
  fo: "FÖ",
  försvar: "FÖ",
  forsvar: "FÖ",
  försvarare: "FÖ",
  back: "FÖ",
  mf: "MF",
  mittfält: "MF",
  mittfalt: "MF",
  mittfältare: "MF",
  an: "AN",
  anfall: "AN",
  anfallare: "AN",
  forward: "AN",
};

/** "Mittfält", "mf", "(MF)" → "MF"; anything else → null. */
export function squadGroupFromWord(word: string): SquadGroup | null {
  const cleaned = word.toLowerCase().replace(/^[([{]+|[)\]},.:;]+$/g, "");
  return GROUP_WORDS[cleaned] ?? null;
}
