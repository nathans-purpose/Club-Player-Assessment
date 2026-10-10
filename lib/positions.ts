// Pitch positions. Coordinates are percent of the pitch's width (x, left to
// right) and height (y, top to bottom), with the team attacking upward, so the
// goalkeeper is at the bottom.

export const POSITION_CODES = ["MV", "VB", "VMB", "HMB", "HB", "DM", "VM", "CM", "HM", "OM", "VY", "HY", "A"] as const;
export type PositionCode = (typeof POSITION_CODES)[number];

export function isPositionCode(value: unknown): value is PositionCode {
  return typeof value === "string" && (POSITION_CODES as readonly string[]).includes(value);
}

export const POSITION_LABELS: Record<PositionCode, string> = {
  MV: "Målvakt",
  VB: "Vänsterback",
  VMB: "Vänster mittback",
  HMB: "Höger mittback",
  HB: "Högerback",
  DM: "Defensiv mittfältare",
  VM: "Vänstermittfältare",
  CM: "Central mittfältare",
  HM: "Högermittfältare",
  OM: "Offensiv mittfältare",
  VY: "Vänsterytter",
  HY: "Högerytter",
  A: "Anfallare",
};

export const POSITION_COORDS: Record<PositionCode, { x: number; y: number }> = {
  MV: { x: 50, y: 91 },
  VB: { x: 14, y: 72 },
  VMB: { x: 36, y: 77 },
  HMB: { x: 64, y: 77 },
  HB: { x: 86, y: 72 },
  DM: { x: 50, y: 62 },
  VM: { x: 14, y: 46 },
  CM: { x: 50, y: 47 },
  HM: { x: 86, y: 46 },
  OM: { x: 50, y: 32 },
  VY: { x: 18, y: 20 },
  HY: { x: 82, y: 20 },
  A: { x: 50, y: 12 },
};

/** How well a leader thinks a player fits a position (spec §5.6). */
export const POSITION_LEVELS = [3, 2, 1] as const;
export type PositionLevel = (typeof POSITION_LEVELS)[number];

export function isPositionLevel(value: unknown): value is PositionLevel {
  return value === 1 || value === 2 || value === 3;
}

export const POSITION_LEVEL_LABELS: Record<PositionLevel, string> = {
  3: "Naturlig",
  2: "Funkar bra",
  1: "Kan spela",
};
