import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// save_assessment against the demo seed (club A) and a second club (B) that
// club A's leaders must never be able to write to.

const SEASON_A = "00000000-0000-4000-a000-000000000003";
const ADMIN_A = "00000000-0000-4000-b000-000000000001";
const LEADER_A1 = "00000000-0000-4000-b000-000000000002";
const LEADER_A2 = "00000000-0000-4000-b000-000000000003";

let db: Client;
let drop: () => Promise<void>;
let outsider: string;
let playerA: string;
let categoriesA: { id: string; name: string }[];
let subcategoriesA: { id: string; category_id: string }[];
let phaseA: string;
const B = {} as { leader: string; season: string; player: string; category: string };

const saveSql = "select * from save_assessment($1, $2, $3, $4, $5, $6, $7)";

type Answers = { comment?: string; scores?: unknown[]; positions?: unknown[]; attendance?: unknown[] };

function saveParams(season: string, player: string, submit: boolean, answers: Answers = {}) {
  return [
    season,
    player,
    submit,
    answers.comment ?? "",
    JSON.stringify(answers.scores ?? []),
    JSON.stringify(answers.positions ?? []),
    JSON.stringify(answers.attendance ?? []),
  ];
}

/** A complete set of answers for club A's categories, all with `score`. */
function fullScores(score: number): { category_id: string; subcategory_id: string | null; score: number }[] {
  return categoriesA.flatMap((c) => {
    const subs = subcategoriesA.filter((s) => s.category_id === c.id);
    return subs.length
      ? subs.map((s) => ({ category_id: c.id, subcategory_id: s.id as string | null, score }))
      : [{ category_id: c.id, subcategory_id: null, score }];
  });
}

async function save(userId: string, season: string, player: string, submit: boolean, answers: Answers = {}) {
  return asUser(
    db,
    userId,
    async (q) => (await q<{ assessment_id: string; status: string }>(saveSql, saveParams(season, player, submit, answers))).rows[0],
    { commit: true },
  );
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
  outsider = await createUser(db, "outsider@example.test", "Utomstående");

  // A player leader A1 has not assessed in the seed.
  playerA = (
    await db.query<{ id: string }>(
      `select p.id from players p
       where p.team_id = '00000000-0000-4000-a000-000000000002'
         and not exists (select 1 from assessments a where a.player_id = p.id and a.leader_id = $1)
       order by p.full_name limit 1`,
      [LEADER_A1],
    )
  ).rows[0].id;
  categoriesA = (
    await db.query(
      "select id, name from categories where team_id = '00000000-0000-4000-a000-000000000002' order by sort_order",
    )
  ).rows;
  subcategoriesA = (
    await db.query(
      `select s.id, s.category_id from subcategories s join categories c on c.id = s.category_id
       where c.team_id = '00000000-0000-4000-a000-000000000002' order by s.sort_order`,
    )
  ).rows;
  phaseA = (await db.query(`select id from season_phases where season_id = $1 order by sort_order limit 1`, [SEASON_A]))
    .rows[0].id;

  // Club B, created by its own admin.
  B.leader = await createUser(db, "b-leader@example.test", "B Ledare");
  const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
  const clubB = await one("insert into clubs (name, slug, created_by) values ('Klubb B', 'klubb-b', $1) returning id", [
    B.leader,
  ]);
  const teamB = await one("insert into teams (club_id, name) values ($1, 'Herr A') returning id", [clubB]);
  B.season = await one("insert into seasons (team_id, label) values ($1, '2026') returning id", [teamB]);
  B.player = await one("insert into players (team_id, full_name) values ($1, 'B Spelare') returning id", [teamB]);
  B.category = await one("insert into categories (team_id, name) values ($1, 'Teknik') returning id", [teamB]);
});

afterAll(async () => {
  await drop?.();
});

async function answersOf(assessmentId: string) {
  const scores = await db.query("select category_id, subcategory_id, score from assessment_scores where assessment_id = $1", [
    assessmentId,
  ]);
  const positions = await db.query(
    "select position_code, level from assessment_positions where assessment_id = $1 order by position_code",
    [assessmentId],
  );
  const attendance = await db.query("select phase_id, value from assessment_attendance where assessment_id = $1", [
    assessmentId,
  ]);
  return { scores: scores.rows, positions: positions.rows, attendance: attendance.rows };
}

describe("save_assessment", () => {
  it("creates a draft that only its author can read", async () => {
    const saved = await save(LEADER_A1, SEASON_A, playerA, false, {
      comment: "  Bra fart  ",
      scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 7 }],
      positions: [{ position_code: "CM", level: 3 }],
      attendance: [{ phase_id: phaseA, value: 80 }],
    });
    expect(saved.status).toBe("draft");

    const row = (await db.query("select comment, submitted_at from assessments where id = $1", [saved.assessment_id]))
      .rows[0];
    expect(row).toEqual({ comment: "Bra fart", submitted_at: null });
    expect(await answersOf(saved.assessment_id)).toEqual({
      scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 7 }],
      positions: [{ position_code: "CM", level: 3 }],
      attendance: [{ phase_id: phaseA, value: 80 }],
    });

    const seenByOther = await asUser(db, LEADER_A2, async (q) => ({
      assessments: (await q("select id from assessments where id = $1", [saved.assessment_id])).rowCount,
      scores: (await q("select 1 from assessment_scores where assessment_id = $1", [saved.assessment_id])).rowCount,
    }));
    expect(seenByOther).toEqual({ assessments: 0, scores: 0 });
  });

  it("replaces the answers on the next save instead of adding to them", async () => {
    const saved = await save(LEADER_A1, SEASON_A, playerA, false, {
      scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 4 }],
      positions: [{ position_code: "OM", level: 2 }],
    });
    expect(await answersOf(saved.assessment_id)).toEqual({
      scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 4 }],
      positions: [{ position_code: "OM", level: 2 }],
      attendance: [],
    });
    const { rows } = await db.query("select count(*)::int as n from assessments where player_id = $1 and leader_id = $2", [
      playerA,
      LEADER_A1,
    ]);
    expect(rows[0].n).toBe(1);
  });

  it("submits, which makes the assessment visible to the club", async () => {
    const saved = await save(LEADER_A1, SEASON_A, playerA, true, {
      scores: fullScores(6),
      positions: [{ position_code: "CM", level: 3 }],
    });
    expect(saved.status).toBe("submitted");

    const seenByOther = await asUser(db, LEADER_A2, async (q) => ({
      assessment: (await q("select status, submitted_at is not null as stamped from assessments where id = $1", [
        saved.assessment_id,
      ])).rows[0],
      scores: (await q("select 1 from assessment_scores where assessment_id = $1", [saved.assessment_id])).rowCount,
    }));
    expect(seenByOther.assessment).toEqual({ status: "submitted", stamped: true });
    expect(seenByOther.scores).toBe(fullScores(6).length);
  });

  it("does not autosave over a submitted assessment", async () => {
    await expect(save(LEADER_A1, SEASON_A, playerA, false, { scores: fullScores(1) })).rejects.toThrow(
      /submitted again/,
    );
  });

  it("updates a submitted assessment when it is submitted again, keeping one row", async () => {
    const saved = await save(LEADER_A1, SEASON_A, playerA, true, {
      scores: fullScores(9),
      positions: [{ position_code: "A", level: 2 }],
    });
    expect(saved.status).toBe("submitted");
    const answers = await answersOf(saved.assessment_id);
    expect(new Set(answers.scores.map((s) => s.score))).toEqual(new Set([9]));
    expect(answers.positions).toEqual([{ position_code: "A", level: 2 }]);
    const { rows } = await db.query("select count(*)::int as n from assessments where player_id = $1 and leader_id = $2", [
      playerA,
      LEADER_A1,
    ]);
    expect(rows[0].n).toBe(1);
  });

  it("keeps scores on a deactivated category and ignores new ones for it", async () => {
    const inactive = categoriesA[5];
    await db.query("update categories set is_active = false where id = $1", [inactive.id]);
    try {
      const saved = await save(LEADER_A1, SEASON_A, playerA, true, {
        scores: fullScores(3),
        positions: [{ position_code: "A", level: 2 }],
      });
      const answers = await answersOf(saved.assessment_id);
      expect(answers.scores.filter((s) => s.category_id === inactive.id)).toEqual([
        { category_id: inactive.id, subcategory_id: null, score: 9 },
      ]);
      expect(answers.scores.filter((s) => s.category_id !== inactive.id).every((s) => s.score === 3)).toBe(true);
    } finally {
      await db.query("update categories set is_active = true where id = $1", [inactive.id]);
    }
  });

  it("rejects invalid answers", async () => {
    await expect(
      save(LEADER_A1, SEASON_A, playerA, true, { positions: [{ position_code: "XX", level: 3 }] }),
    ).rejects.toThrow();
    await expect(
      save(LEADER_A1, SEASON_A, playerA, true, {
        scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 11 }],
      }),
    ).rejects.toThrow();
  });

  it("never stores a score on another club's category", async () => {
    const saved = await save(LEADER_A1, SEASON_A, playerA, true, {
      scores: [...fullScores(5), { category_id: B.category, subcategory_id: null, score: 5 }],
    });
    const answers = await answersOf(saved.assessment_id);
    expect(answers.scores.some((s) => s.category_id === B.category)).toBe(false);
  });

  it("does not let a leader assess another club's player", async () => {
    await expect(save(LEADER_A1, B.season, B.player, false)).rejects.toThrow();
    await expect(save(LEADER_A1, SEASON_A, B.player, false)).rejects.toThrow();
    const { rows } = await db.query("select count(*)::int as n from assessments where player_id = $1", [B.player]);
    expect(rows[0].n).toBe(0);
  });

  it("does not let a non-member assess", async () => {
    await expect(save(outsider, SEASON_A, playerA, false)).rejects.toThrow();
  });

  it("does not let a removed leader change their assessment", async () => {
    await db.query("delete from club_members where user_id = $1", [LEADER_A1]);
    try {
      await expect(save(LEADER_A1, SEASON_A, playerA, true, { scores: fullScores(1) })).rejects.toThrow();
    } finally {
      await db.query(
        "insert into club_members (club_id, user_id, role, invited_by) values ('00000000-0000-4000-a000-000000000001', $1, 'leader', $2)",
        [LEADER_A1, ADMIN_A],
      );
    }
  });

  it("is not callable without signing in", async () => {
    await expect(asUser(db, null, (q) => q(saveSql, saveParams(SEASON_A, playerA, false)))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("set_assessment_skipped", () => {
  const skipSql = "select * from set_assessment_skipped($1, $2, $3)";
  let player: string;

  async function skip(userId: string | null, skipped: boolean, playerId = player) {
    return asUser(
      db,
      userId,
      async (q) => (await q<{ assessment_id: string; status: string }>(skipSql, [SEASON_A, playerId, skipped])).rows[0],
      { commit: true },
    );
  }

  beforeAll(async () => {
    player = (
      await db.query<{ id: string }>(
        `select p.id from players p
         where p.team_id = '00000000-0000-4000-a000-000000000002' and p.id <> $2
           and not exists (select 1 from assessments a where a.player_id = p.id and a.leader_id = $1)
         order by p.full_name limit 1`,
        [LEADER_A1, playerA],
      )
    ).rows[0].id;
  });

  it("skips a player the leader hasn't started, hidden from the club", async () => {
    const skipped = await skip(LEADER_A1, true);
    expect(skipped.status).toBe("skipped");
    const seenByOther = await asUser(
      db,
      LEADER_A2,
      async (q) => (await q("select id from assessments where id = $1", [skipped.assessment_id])).rowCount,
    );
    expect(seenByOther).toBe(0);
  });

  it("takes no draft saves while skipped", async () => {
    await expect(save(LEADER_A1, SEASON_A, player, false, { comment: "x" })).rejects.toThrow(/skip is undone/);
  });

  it("brings back the draft, with its answers, when the skip is undone", async () => {
    expect((await skip(LEADER_A1, false)).status).toBe("draft");
    const saved = await save(LEADER_A1, SEASON_A, player, false, {
      scores: [{ category_id: categoriesA[1].id, subcategory_id: null, score: 5 }],
    });
    expect((await skip(LEADER_A1, true)).status).toBe("skipped");
    expect((await skip(LEADER_A1, false)).status).toBe("draft");
    expect((await answersOf(saved.assessment_id)).scores).toEqual([
      { category_id: categoriesA[1].id, subcategory_id: null, score: 5 },
    ]);
  });

  it("lets a skipped player be submitted, which replaces the skip", async () => {
    await skip(LEADER_A1, true);
    const saved = await save(LEADER_A1, SEASON_A, player, true, {
      scores: fullScores(6),
      positions: [{ position_code: "CM", level: 3 }],
    });
    expect(saved.status).toBe("submitted");
    const { rows } = await db.query("select submitted_at is not null as stamped from assessments where id = $1", [
      saved.assessment_id,
    ]);
    expect(rows[0]).toEqual({ stamped: true });
  });

  it("does not skip a submitted assessment", async () => {
    await expect(skip(LEADER_A1, true)).rejects.toThrow(/cannot be skipped/);
  });

  it("does not let a leader skip another club's player, or anyone skip without signing in", async () => {
    await expect(skip(LEADER_A1, true, B.player)).rejects.toThrow();
    await expect(skip(outsider, true, playerA)).rejects.toThrow();
    await expect(asUser(db, null, (q) => q(skipSql, [SEASON_A, player, true]))).rejects.toThrow(/permission denied/);
  });
});
