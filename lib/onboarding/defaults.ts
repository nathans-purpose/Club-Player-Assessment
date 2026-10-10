// Defaults for a newly created club's first team. Admins change them later
// under Inställningar (categories, positions).

export const GAME_FORMATS = [11, 9, 7, 5] as const;
export type GameFormat = (typeof GAME_FORMATS)[number];

export function isGameFormat(value: number): value is GameFormat {
  return (GAME_FORMATS as readonly number[]).includes(value);
}

export type PositionTarget = { position_code: string; target_count: number };

// One formation per game format; the targets always add up to the number of
// players on the pitch.
export const DEFAULT_FORMATIONS: Record<GameFormat, { name: string; targets: PositionTarget[] }> = {
  11: {
    name: "4-4-2",
    targets: [
      { position_code: "MV", target_count: 1 },
      { position_code: "VB", target_count: 1 },
      { position_code: "VMB", target_count: 1 },
      { position_code: "HMB", target_count: 1 },
      { position_code: "HB", target_count: 1 },
      { position_code: "VM", target_count: 1 },
      { position_code: "CM", target_count: 2 },
      { position_code: "HM", target_count: 1 },
      { position_code: "A", target_count: 2 },
    ],
  },
  9: {
    name: "2-3-1-2",
    targets: [
      { position_code: "MV", target_count: 1 },
      { position_code: "VMB", target_count: 1 },
      { position_code: "HMB", target_count: 1 },
      { position_code: "VM", target_count: 1 },
      { position_code: "CM", target_count: 1 },
      { position_code: "HM", target_count: 1 },
      { position_code: "OM", target_count: 1 },
      { position_code: "A", target_count: 2 },
    ],
  },
  7: {
    name: "2-3-1",
    targets: [
      { position_code: "MV", target_count: 1 },
      { position_code: "VMB", target_count: 1 },
      { position_code: "HMB", target_count: 1 },
      { position_code: "VM", target_count: 1 },
      { position_code: "CM", target_count: 1 },
      { position_code: "HM", target_count: 1 },
      { position_code: "A", target_count: 1 },
    ],
  },
  5: {
    name: "2-1-1",
    targets: [
      { position_code: "MV", target_count: 1 },
      { position_code: "VMB", target_count: 1 },
      { position_code: "HMB", target_count: 1 },
      { position_code: "CM", target_count: 1 },
      { position_code: "A", target_count: 1 },
    ],
  },
};

// Placeholder categories until the club sets its own.
export const DEFAULT_CATEGORIES = [
  { name: "Teknik", question: "Hur väl behärskar spelaren bollen?" },
  { name: "Spelförståelse", question: "Hur väl läser spelaren spelet?" },
  { name: "Fysik", question: "Hur stark, snabb och uthållig är spelaren?" },
  { name: "Inställning", question: "Hur är spelarens attityd och vilja?" },
  { name: "Lagspel", question: "Hur väl spelar spelaren för laget?" },
  { name: "Utveckling", question: "Hur mycket har spelaren utvecklats?" },
];

export const DEFAULT_PHASES = ["Försäsong", "Första halvan", "Uppstart andra halvan", "Andra halvan"];
