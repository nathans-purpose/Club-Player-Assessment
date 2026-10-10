import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// Visual identity (step 7): who may save a club's identity, and the shape
// checks on the stored columns. Club A is the demo seed, club B a second club.

const CLUB_A = "00000000-0000-4000-a000-000000000001";
const ADMIN_A = "00000000-0000-4000-b000-000000000001";
const LEADER_A1 = "00000000-0000-4000-b000-000000000002";

let db: Client;
let drop: () => Promise<void>;
let adminB: string;

const UPSERT = `insert into club_identity (club_id, colors, fonts, logos, tone_words, is_applied)
  values ($1, $2, $3, $4, $5, true)
  on conflict (club_id) do update set colors = excluded.colors, fonts = excluded.fonts,
    logos = excluded.logos, tone_words = excluded.tone_words, is_applied = true`;

const identity = (colors: unknown = { palette: [{ hex: "#509BF5", role: "primary", name: null }] }) => [
  CLUB_A,
  JSON.stringify(colors),
  JSON.stringify({ heading: null, body: null }),
  JSON.stringify({ items: [] }),
  ["Stolt"],
];

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
  adminB = await createUser(db, "b-admin@example.test", "B Admin");
  await db.query("insert into clubs (name, slug, created_by) values ('Klubb B', 'klubb-b', $1)", [adminB]);
});

afterAll(async () => {
  await drop?.();
});

describe("club_identity", () => {
  it("lets the club's admins save and apply it, and every member read it", async () => {
    await asUser(db, ADMIN_A, (q) => q(UPSERT, identity()), { commit: true });
    const read = await asUser(db, LEADER_A1, (q) =>
      q("select colors, tone_words, is_applied from club_identity where club_id = $1", [CLUB_A]),
    );
    expect(read.rows).toEqual([
      {
        colors: { palette: [{ hex: "#509BF5", role: "primary", name: null }] },
        tone_words: ["Stolt"],
        is_applied: true,
      },
    ]);
  });

  it("refuses leaders and other clubs' admins", async () => {
    await expect(asUser(db, LEADER_A1, (q) => q(UPSERT, identity()))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, adminB, (q) => q(UPSERT, identity()))).rejects.toThrow(/row-level security/);
    const seen = await asUser(db, adminB, (q) => q("select * from club_identity where club_id = $1", [CLUB_A]));
    expect(seen.rowCount).toBe(0);
  });

  it("keeps colours, fonts and logos as JSON objects", async () => {
    await expect(asUser(db, ADMIN_A, (q) => q(UPSERT, identity(["#509BF5"])))).rejects.toThrow(
      /club_identity_colors_object/,
    );
  });
});
