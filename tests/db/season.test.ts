import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// Säsong: season evaluations, the shared match log and plan, against the demo
// seed (club A) and a second club (B). Club isolation for every table is
// covered in rls.test.ts.

const TEAM_A = "00000000-0000-4000-a000-000000000002";
const SEASON_A = "00000000-0000-4000-a000-000000000003";
const ADMIN_A = "00000000-0000-4000-b000-000000000001";
const LEADER_A1 = "00000000-0000-4000-b000-000000000002";
const LEADER_A2 = "00000000-0000-4000-b000-000000000003";

let db: Client;
let drop: () => Promise<void>;
const B = {} as { admin: string; club: string; team: string; season: string; player: string; area: string };
let areasA: string[];
let playerA: string;

type Rating = { area_id: string; score: number | null; training?: string | null; comment?: string | null };

function saveEvaluation(userId: string, seasonId: string, submit: boolean, ratings: Rating[], commit = false) {
  return asUser(
    db,
    userId,
    (q) =>
      q("select * from save_season_evaluation($1, $2, $3, $4, $5, $6, $7, $8)", [
        seasonId,
        submit,
        JSON.stringify(ratings),
        ["Bra press"],
        ["Fasta"],
        7,
        3,
        "Att truppen håller ihop",
      ]),
    { commit },
  );
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
  B.admin = await createUser(db, "b-admin@example.test", "B Admin");
  const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
  B.club = await one("insert into clubs (name, slug, created_by) values ('Klubb B', 'klubb-b', $1) returning id", [B.admin]);
  B.team = await one("insert into teams (club_id, name) values ($1, 'Herr A') returning id", [B.club]);
  B.season = await one("insert into seasons (team_id, label) values ($1, '2026') returning id", [B.team]);
  B.player = await one("insert into players (team_id, full_name) values ($1, 'Spelare B') returning id", [B.team]);
  B.area = await one("select id from evaluation_areas where team_id = $1 limit 1", [B.team]);
  areasA = (
    await db.query<{ id: string }>("select id from evaluation_areas where team_id = $1 order by sort_order", [TEAM_A])
  ).rows.map((r) => r.id);
  playerA = await one("select id from players where team_id = $1 limit 1", [TEAM_A]);
});

afterAll(async () => {
  await drop?.();
});

describe("evaluation areas", () => {
  it("every team gets the 21 default areas in 7 groups", async () => {
    const { rows } = await db.query<{ n: number; groups: number }>(
      "select count(*)::int as n, count(distinct group_name)::int as groups from evaluation_areas where team_id = $1",
      [B.team],
    );
    expect(rows[0]).toEqual({ n: 21, groups: 7 });
    expect(areasA).toHaveLength(21);
  });

  it("leaders can read but not change them; admins can", async () => {
    await expect(
      asUser(db, LEADER_A1, (q) => q("update evaluation_areas set name = 'X' where id = $1 returning id", [areasA[0]])),
    ).resolves.toMatchObject({ rowCount: 0 });
    await expect(
      asUser(db, ADMIN_A, (q) => q("update evaluation_areas set name = 'X' where id = $1 returning id", [areasA[0]])),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});

describe("season evaluations", () => {
  it("a leader saves a draft that only they can see", async () => {
    await saveEvaluation(LEADER_A1, SEASON_A, false, [{ area_id: areasA[0], score: 4, training: "too_little" }], true);
    const own = await asUser(db, LEADER_A1, (q) => q("select status from season_evaluations where season_id = $1", [SEASON_A]));
    expect(own.rows).toEqual([{ status: "draft" }]);
    for (const other of [ADMIN_A, LEADER_A2]) {
      const seen = await asUser(db, other, (q) =>
        q("select count(*)::int as n from season_evaluation_ratings r join season_evaluations e on e.id = r.evaluation_id"),
      );
      expect(seen.rows[0].n).toBe(0);
    }
  });

  it("a submitted evaluation is visible to every member and changes only when submitted again", async () => {
    await saveEvaluation(LEADER_A1, SEASON_A, true, [{ area_id: areasA[0], score: 5, training: "too_little" }], true);
    const seen = await asUser(db, LEADER_A2, (q) =>
      q(
        "select e.strengths, r.score from season_evaluations e join season_evaluation_ratings r on r.evaluation_id = e.id where e.leader_id = $1",
        [LEADER_A1],
      ),
    );
    expect(seen.rows).toEqual([{ strengths: ["Bra press"], score: 5 }]);
    await expect(saveEvaluation(LEADER_A1, SEASON_A, false, [])).rejects.toThrow(/submitted again/);
  });

  it("a leader cannot write another leader's ratings", async () => {
    const { rows } = await db.query<{ id: string }>("select id from season_evaluations where leader_id = $1", [LEADER_A1]);
    const result = await asUser(db, LEADER_A2, (q) =>
      q("update season_evaluation_ratings set score = 10 where evaluation_id = $1 returning 1", [rows[0].id]),
    );
    expect(result.rowCount).toBe(0);
    await expect(
      asUser(db, LEADER_A2, (q) =>
        q("insert into season_evaluation_ratings (evaluation_id, area_id, score) values ($1, $2, 9)", [rows[0].id, areasA[1]]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("ratings must use the season's own team's areas", async () => {
    await expect(saveEvaluation(LEADER_A2, SEASON_A, false, [{ area_id: B.area, score: 5 }])).resolves.toBeDefined();
    // Areas of another team are ignored by the function (not visible), and refused directly.
    const { rows } = await db.query<{ id: string }>("select id from season_evaluations where leader_id = $1", [LEADER_A1]);
    await expect(
      db.query("insert into season_evaluation_ratings (evaluation_id, area_id, score) values ($1, $2, 5)", [rows[0].id, B.area]),
    ).rejects.toThrow(/does not belong/);
  });

  it("a leader of another club cannot evaluate club A's season", async () => {
    await expect(saveEvaluation(B.admin, SEASON_A, false, [])).rejects.toThrow(/row-level security/);
  });
});

describe("shared season data", () => {
  it("every member can log matches and write the plan", async () => {
    await asUser(db, LEADER_A2, async (q) => {
      await q("insert into season_matches (season_id, round, opponent, venue, goals_for, goals_against) values ($1, 1, 'Testlag', 'home', 2, 0)", [SEASON_A]);
      await q("insert into season_plans (season_id, goal, strategy) values ($1, 'Topp tre', 'Hög press')", [SEASON_A]);
      await q("insert into plan_priorities (season_id, area, goal) values ($1, 'Fasta', 'Max 4 insläppta')", [SEASON_A]);
      await q("insert into squad_plan_positions (season_id, position_code, wanted_count) values ($1, 'A', 3)", [SEASON_A]);
      await q("insert into squad_plan_players (season_id, player_id, status, position_code) values ($1, $2, 'key', 'A')", [SEASON_A, playerA]);
      await q("insert into recruitment_targets (season_id, full_name, position_code, priority) values ($1, 'Extern', 'A', 1)", [SEASON_A]);
      await q("insert into season_reviews (season_id, final_position) values ($1, 3)", [SEASON_A]);
    });
  });

  it("a club's squad plan cannot include another team's players", async () => {
    await expect(
      db.query("insert into squad_plan_players (season_id, player_id, status) values ($1, $2, 'stays')", [SEASON_A, B.player]),
    ).rejects.toThrow(/different teams/);
  });

  it("rows cannot be moved to another club's season", async () => {
    const id = (await db.query<{ id: string }>("insert into recruitment_targets (season_id, full_name) values ($1, 'X') returning id", [SEASON_A]))
      .rows[0].id;
    await expect(
      db.query("update recruitment_targets set season_id = $1 where id = $2", [B.season, id]),
    ).rejects.toThrow(/Season cannot change/);
  });

  it("a match needs both scores or neither", async () => {
    await expect(
      db.query("insert into season_matches (season_id, opponent, goals_for) values ($1, 'X', 1)", [SEASON_A]),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("create_season", () => {
  const create = (userId: string, label: string) =>
    asUser(db, userId, (q) => q("select create_season($1, $2, $3) as id", [TEAM_A, label, ["Försäsong", "Säsong"]]), {
      commit: true,
    });

  it("admins create an inactive season with phases", async () => {
    const { rows } = await create(ADMIN_A, "2027");
    const season = await db.query("select label, is_active from seasons where id = $1", [rows[0].id]);
    expect(season.rows).toEqual([{ label: "2027", is_active: false }]);
    const phases = await db.query("select name from season_phases where season_id = $1 order by sort_order", [rows[0].id]);
    expect(phases.rows.map((r) => r.name)).toEqual(["Försäsong", "Säsong"]);
  });

  it("refuses a label the team already has", async () => {
    await expect(create(ADMIN_A, " 2027 ")).rejects.toThrow(/already exists/);
  });

  it("leaders cannot create seasons", async () => {
    await expect(create(LEADER_A1, "2028")).rejects.toThrow(/row-level security/);
  });
});
