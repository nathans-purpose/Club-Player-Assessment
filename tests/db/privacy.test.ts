import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// Privacy (step 8): admins delete a player or the whole club (hard delete),
// confirm the guardian information, and edit texts; leaders and other clubs
// cannot. Runs against the demo seed (club A) and a second club (B).

const CLUB_A = "00000000-0000-4000-a000-000000000001";
const TEAM_A = "00000000-0000-4000-a000-000000000002";
const ADMIN_A = "00000000-0000-4000-b000-000000000001";
const LEADER_A1 = "00000000-0000-4000-b000-000000000002";

let db: Client;
let drop: () => Promise<void>;
const B = {} as { admin: string; club: string; team: string };

async function count(sql: string, params: unknown[] = []) {
  return (await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`, params)).rows[0].n;
}

/** A club A player that has submitted assessments. */
async function assessedPlayer() {
  return (
    await db.query<{ id: string }>(
      `select p.id from players p join assessments a on a.player_id = p.id
       where p.team_id = $1 and a.status = 'submitted' limit 1`,
      [TEAM_A],
    )
  ).rows[0].id;
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
  B.admin = await createUser(db, "b-admin@example.test", "B Admin");
  const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
  B.club = await one("insert into clubs (name, slug, created_by) values ('Klubb B', 'klubb-b', $1) returning id", [
    B.admin,
  ]);
  B.team = await one("insert into teams (club_id, name, has_minors) values ($1, 'P15', true) returning id", [B.club]);
});

afterAll(async () => {
  await drop?.();
});

describe("deleting a player", () => {
  it("is refused for leaders and for admins of another club", async () => {
    const player = await assessedPlayer();
    for (const user of [LEADER_A1, B.admin]) {
      const { rowCount } = await asUser(db, user, (q) => q("delete from players where id = $1", [player]));
      expect(rowCount).toBe(0);
    }
  });

  it("removes the player and all assessments of them for the club's admin", async () => {
    const player = await assessedPlayer();
    expect(await count("select 1 from assessments where player_id = $1", [player])).toBeGreaterThan(0);
    const { rowCount } = await asUser(db, ADMIN_A, (q) => q("delete from players where id = $1", [player]), {
      commit: true,
    });
    expect(rowCount).toBe(1);
    expect(await count("select 1 from players where id = $1", [player])).toBe(0);
    expect(await count("select 1 from assessments where player_id = $1", [player])).toBe(0);
  });
});

describe("guardian information", () => {
  it("is confirmed by the club's admin only", async () => {
    const confirm = (user: string, team: string) =>
      asUser(db, user, (q) => q("update teams set guardian_info_confirmed_at = now() where id = $1", [team]));
    expect((await confirm(LEADER_A1, TEAM_A)).rowCount).toBe(0);
    expect((await confirm(ADMIN_A, B.team)).rowCount).toBe(0);
    expect((await confirm(B.admin, B.team)).rowCount).toBe(1);
  });
});

describe("text overrides", () => {
  it("are written by admins and read by every member, but not by other clubs", async () => {
    const write = (user: string) =>
      asUser(db, user, (q) =>
        q(
          `insert into ui_text_overrides (club_id, key, value) values ($1, 'players.title', 'Spelarna')
           on conflict (club_id, key) do update set value = excluded.value`,
          [CLUB_A],
        ),
      );
    await expect(write(LEADER_A1)).rejects.toThrow(/row-level security/);
    await expect(write(B.admin)).rejects.toThrow(/row-level security/);
    await asUser(
      db,
      ADMIN_A,
      (q) =>
        q("insert into ui_text_overrides (club_id, key, value) values ($1, 'players.title', 'Spelarna')", [CLUB_A]),
      {
        commit: true,
      },
    );
    const read = (user: string) =>
      asUser(db, user, async (q) => (await q("select value from ui_text_overrides where club_id = $1", [CLUB_A])).rows);
    expect(await read(LEADER_A1)).toEqual([{ value: "Spelarna" }]);
    expect(await read(B.admin)).toEqual([]);
  });
});

describe("deleting the club", () => {
  it("is refused for leaders and for admins of another club", async () => {
    for (const user of [LEADER_A1, B.admin]) {
      const { rowCount } = await asUser(db, user, (q) => q("delete from clubs where id = $1", [CLUB_A]));
      expect(rowCount).toBe(0);
    }
    expect(await count("select 1 from clubs where id = $1", [CLUB_A])).toBe(1);
  });

  it("removes everything the club owns for its admin and leaves other clubs alone", async () => {
    const { rowCount } = await asUser(db, ADMIN_A, (q) => q("delete from clubs where id = $1", [CLUB_A]), {
      commit: true,
    });
    expect(rowCount).toBe(1);
    for (const sql of [
      "select 1 from club_members where club_id = $1",
      "select 1 from teams where club_id = $1",
      "select 1 from ui_text_overrides where club_id = $1",
      "select 1 from invites where club_id = $1",
    ]) {
      expect(await count(sql, [CLUB_A])).toBe(0);
    }
    for (const table of ["players", "assessments", "assessment_scores", "categories", "seasons", "position_targets"]) {
      expect(await count(`select 1 from ${table}`)).toBe(0);
    }
    expect(await count("select 1 from clubs where id = $1", [B.club])).toBe(1);
    expect(await count("select 1 from teams where club_id = $1", [B.club])).toBe(1);
  });
});
