import { squadGroupFromWord, type SquadGroup } from "./squad-groups";

export type ParsedPlayer = {
  shirtNumber: string | null;
  fullName: string;
  squadGroup: SquadGroup | null;
  sourceText: string;
};

/**
 * Parses pasted text with one player per line: `nr name [group word]`.
 * The number and the group are optional ("Kalle Ek", "7 Kalle Ek mittfält").
 * Blank lines are skipped.
 */
export function parsePlayerLines(text: string): ParsedPlayer[] {
  const players: ParsedPlayer[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Separators people use between columns, e.g. from a spreadsheet or "7. Name".
    const tokens = line.split(/[\s\t;,|]+/).filter(Boolean);

    let shirtNumber: string | null = null;
    const numberMatch = tokens[0]?.match(/^#?(\d{1,3})[.):-]?$/);
    if (numberMatch) {
      shirtNumber = numberMatch[1];
      tokens.shift();
    }

    let squadGroup: SquadGroup | null = null;
    if (tokens.length > 1) {
      const group = squadGroupFromWord(tokens[tokens.length - 1]);
      if (group) {
        squadGroup = group;
        tokens.pop();
      }
    }

    players.push({ shirtNumber, fullName: tokens.join(" "), squadGroup, sourceText: line });
  }
  return players;
}
