import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// Two clubs with identical shapes, so every table has rows in both.
// "A" is the club under test; "B" is the second test club that A's users must
// never see or touch.

type Club = {
  clubId: string;
  teamId: string;
  seasonId: string;
  phaseId: string;
  playerIds: string[];
  categoryId: string;
  subcategoryId: string;
  draftAssessmentId: string;
  submittedAssessmentId: string;
};

let db: Client;
let drop: () => Promise<void>;

const users = {} as Record<
  "aAdmin" | "aLeader" | "aLeader2" | "bAdmin" | "bLeader" | "outsider",
  string
>;
let A: Club;
let B: Club;

async function createClub(adminId: string, leaderIds: string[], name: string): Promise<Club> {
  // Created through RLS as the admin, so the creator-becomes-admin trigger runs.
  const clubId = await asUser(
    db,
    adminId,
    async (q) => {
      const { rows } = await q<{ id: string }>(
        "insert into clubs (name, slug, created_by) values ($1, $2, $3) returning id",
        [name, name.toLowerCase().replace(/\s+/g, "-"), adminId],
      );
      return rows[0].id;
    },
    { commit: true },
  );

  const one = async (sql: string, params: unknown[]) =>
    (await db.query<{ id: string }>(sql, params)).rows[0].id;

  for (const leaderId of leaderIds) {
    await db.query(
      "insert into club_members (club_id, user_id, role, invited_by) values ($1, $2, 'leader', $3)",
      [clubId, leaderId, adminId],
    );
  }
  const teamId = await one(
    "insert into teams (club_id, name, game_format) values ($1, 'Herr A', 11) returning id",
    [clubId],
  );
  const seasonId = await one(
    "insert into seasons (team_id, label, match_count) values ($1, '2026', 22) returning id",
    [teamId],
  );
  const phaseId = await one(
    "insert into season_phases (season_id, name, sort_order) values ($1, 'Försäsong', 1) returning id",
    [seasonId],
  );
  const playerIds = [
    await one(
      "insert into players (team_id, shirt_number, full_name, squad_group) values ($1, '1', 'Testspelare Ett', 'MV') returning id",
      [teamId],
    ),
    await one(
      "insert into players (team_id, shirt_number, full_name, squad_group) values ($1, '9', 'Testspelare Två', 'AN') returning id",
      [teamId],
    ),
  ];
  await db.query(
    "insert into player_season_stats (player_id, season_id, matches, goals) values ($1, $2, 10, 3)",
    [playerIds[1], seasonId],
  );
  const categoryId = await one(
    "insert into categories (team_id, name, question, sort_order) values ($1, 'Teknik', 'Hur bra är tekniken?', 1) returning id",
    [teamId],
  );
  const subcategoryId = await one(
    "insert into subcategories (category_id, name, sort_order) values ($1, 'Passningar', 1) returning id",
    [categoryId],
  );
  await db.query("insert into position_targets (team_id, position_code, target_count) values ($1, 'MV', 1)", [
    teamId,
  ]);
  await db.query("insert into club_identity (club_id, tone_words) values ($1, '{modig}')", [clubId]);
  await db.query("insert into ui_text_overrides (club_id, key, value) values ($1, 'nav.overview', 'Start')", [
    clubId,
  ]);
  await db.query("insert into invites (club_id, email, role) values ($1, 'ny@example.test', 'leader')", [clubId]);

  // One draft by the first leader and one submitted by the admin, with children.
  const draftAssessmentId = await one(
    "insert into assessments (season_id, player_id, leader_id, status, comment) values ($1, $2, $3, 'draft', 'utkast') returning id",
    [seasonId, playerIds[0], leaderIds[0]],
  );
  const submittedAssessmentId = await one(
    "insert into assessments (season_id, player_id, leader_id, status, comment) values ($1, $2, $3, 'submitted', 'klar') returning id",
    [seasonId, playerIds[0], adminId],
  );
  for (const assessmentId of [draftAssessmentId, submittedAssessmentId]) {
    await db.query(
      "insert into assessment_scores (assessment_id, category_id, subcategory_id, score) values ($1, $2, $3, 7)",
      [assessmentId, categoryId, subcategoryId],
    );
    await db.query(
      "insert into assessment_positions (assessment_id, position_code, level) values ($1, 'MV', 3)",
      [assessmentId],
    );
    await db.query(
      "insert into assessment_attendance (assessment_id, phase_id, value) values ($1, $2, 80)",
      [assessmentId, phaseId],
    );
  }

  return {
    clubId,
    teamId,
    seasonId,
    phaseId,
    playerIds,
    categoryId,
    subcategoryId,
    draftAssessmentId,
    submittedAssessmentId,
  };
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  users.aAdmin = await createUser(db, "a-admin@example.test", "Admin A");
  users.aLeader = await createUser(db, "a-leader@example.test", "Ledare A");
  users.aLeader2 = await createUser(db, "a-leader2@example.test", "Ledare A2");
  users.bAdmin = await createUser(db, "b-admin@example.test", "Admin B");
  users.bLeader = await createUser(db, "b-leader@example.test", "Ledare B");
  users.outsider = await createUser(db, "outsider@example.test", "Utomstående");
  A = await createClub(users.aAdmin, [users.aLeader, users.aLeader2], "Klubb A");
  B = await createClub(users.bAdmin, [users.bLeader], "Klubb B");
});

afterAll(async () => {
  await drop?.();
});

// For each table: how to count the rows that belong to a given club.
// Child tables of assessments are matched on the club's assessment ids.
const clubRowCounters: Record<string, (c: Club) => [string, unknown[]]> = {
  clubs: (c) => ["select count(*) from clubs where id = $1", [c.clubId]],
  club_members: (c) => ["select count(*) from club_members where club_id = $1", [c.clubId]],
  invites: (c) => ["select count(*) from invites where club_id = $1", [c.clubId]],
  teams: (c) => ["select count(*) from teams where club_id = $1", [c.clubId]],
  seasons: (c) => ["select count(*) from seasons where team_id = $1", [c.teamId]],
  season_phases: (c) => ["select count(*) from season_phases where season_id = $1", [c.seasonId]],
  players: (c) => ["select count(*) from players where team_id = $1", [c.teamId]],
  player_season_stats: (c) => ["select count(*) from player_season_stats where season_id = $1", [c.seasonId]],
  categories: (c) => ["select count(*) from categories where team_id = $1", [c.teamId]],
  subcategories: (c) => ["select count(*) from subcategories where category_id = $1", [c.categoryId]],
  position_targets: (c) => ["select count(*) from position_targets where team_id = $1", [c.teamId]],
  club_identity: (c) => ["select count(*) from club_identity where club_id = $1", [c.clubId]],
  ui_text_overrides: (c) => ["select count(*) from ui_text_overrides where club_id = $1", [c.clubId]],
  assessments: (c) => ["select count(*) from assessments where season_id = $1", [c.seasonId]],
  assessment_scores: (c) => [
    "select count(*) from assessment_scores where assessment_id = any($1)",
    [[c.draftAssessmentId, c.submittedAssessmentId]],
  ],
  assessment_positions: (c) => [
    "select count(*) from assessment_positions where assessment_id = any($1)",
    [[c.draftAssessmentId, c.submittedAssessmentId]],
  ],
  assessment_attendance: (c) => [
    "select count(*) from assessment_attendance where assessment_id = any($1)",
    [[c.draftAssessmentId, c.submittedAssessmentId]],
  ],
};

async function countAs(userId: string | null, table: string, club: Club) {
  const [sql, params] = clubRowCounters[table](club);
  if (userId === "superuser") {
    return Number((await db.query(sql, params)).rows[0].count);
  }
  return asUser(db, userId, async (q) => Number((await q(sql, params)).rows[0].count));
}

describe("club isolation", () => {
  const tables = Object.keys(clubRowCounters);

  it("covers every table in the public schema", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename <> 'profiles'",
    );
    expect(rows.map((r) => r.tablename).sort()).toEqual([...tables].sort());
  });

  it("has RLS enabled on every public table", async () => {
    const { rows } = await db.query(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it.each(tables)("%s: club B's rows exist but are invisible to club A's users", async (table) => {
    expect(await countAs("superuser", table, B)).toBeGreaterThan(0);
    for (const userId of [users.aAdmin, users.aLeader, users.outsider]) {
      expect(await countAs(userId, table, B)).toBe(0);
    }
  });

  it.each(tables)("%s: club A's rows are invisible to club B's users", async (table) => {
    expect(await countAs("superuser", table, A)).toBeGreaterThan(0);
    for (const userId of [users.bAdmin, users.bLeader]) {
      expect(await countAs(userId, table, A)).toBe(0);
    }
  });

  it("members see their own club's squad", async () => {
    expect(await countAs(users.aLeader, "players", A)).toBe(2);
    expect(await countAs(users.bLeader, "players", B)).toBe(2);
  });

  it("anonymous visitors cannot read anything", async () => {
    for (const table of tables) {
      await expect(asUser(db, null, (q) => q(`select * from ${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("profiles are visible only to people who share a club", async () => {
    const visible = await asUser(db, users.aLeader, async (q) =>
      (await q<{ id: string }>("select id from profiles")).rows.map((r) => r.id).sort(),
    );
    expect(visible).toEqual([users.aAdmin, users.aLeader, users.aLeader2].sort());
  });
});

describe("cross-club writes", () => {
  it("an admin of A cannot add players to B's team", async () => {
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("insert into players (team_id, full_name) values ($1, 'Inkräktare')", [B.teamId]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("an admin of A cannot change or delete B's data", async () => {
    const result = await asUser(db, users.aAdmin, async (q) => ({
      club: (await q("update clubs set name = 'Kapad' where id = $1", [B.clubId])).rowCount,
      players: (await q("delete from players where team_id = $1", [B.teamId])).rowCount,
      assessments: (await q("delete from assessments where season_id = $1", [B.seasonId])).rowCount,
    }));
    expect(result).toEqual({ club: 0, players: 0, assessments: 0 });
  });

  it("an admin of A cannot add themselves to B", async () => {
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("insert into club_members (club_id, user_id, role) values ($1, $2, 'admin')", [B.clubId, users.aAdmin]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a leader of A cannot assess B's players", async () => {
    await expect(
      asUser(db, users.aLeader, (q) =>
        q("insert into assessments (season_id, player_id, leader_id) values ($1, $2, $3)", [
          B.seasonId,
          B.playerIds[1],
          users.aLeader,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a leader of A cannot score an assessment with B's categories", async () => {
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("insert into assessment_scores (assessment_id, category_id, score) values ($1, $2, 5)", [
          A.submittedAssessmentId,
          B.categoryId,
        ]),
      ),
    ).rejects.toThrow(/Category does not belong/);
  });
});

describe("admin and leader roles", () => {
  it("leaders cannot manage the squad, settings or invites", async () => {
    const q = (sql: string, params: unknown[]) => asUser(db, users.aLeader, (run) => run(sql, params));
    await expect(q("insert into players (team_id, full_name) values ($1, 'Ny')", [A.teamId])).rejects.toThrow(
      /row-level security/,
    );
    await expect(
      q("insert into invites (club_id, role) values ($1, 'admin')", [A.clubId]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      q("insert into club_members (club_id, user_id, role) values ($1, $2, 'leader')", [A.clubId, users.outsider]),
    ).rejects.toThrow(/row-level security/);

    const changed = await asUser(db, users.aLeader, async (run) => ({
      club: (await run("update clubs set name = 'X' where id = $1", [A.clubId])).rowCount,
      category: (await run("update categories set name = 'X' where id = $1", [A.categoryId])).rowCount,
      identity: (await run("update club_identity set is_applied = true where club_id = $1", [A.clubId])).rowCount,
      role: (
        await run("update club_members set role = 'admin' where club_id = $1 and user_id = $2", [
          A.clubId,
          users.aLeader,
        ])
      ).rowCount,
      invites: (await run("select * from invites where club_id = $1", [A.clubId])).rowCount,
    }));
    expect(changed).toEqual({ club: 0, category: 0, identity: 0, role: 0, invites: 0 });
  });

  it("admins can manage the squad, settings and invites", async () => {
    const result = await asUser(db, users.aAdmin, async (q) => ({
      player: (await q("insert into players (team_id, full_name) values ($1, 'Ny Spelare')", [A.teamId])).rowCount,
      category: (await q("update categories set is_active = false where id = $1", [A.categoryId])).rowCount,
      invite: (await q("insert into invites (club_id, role) values ($1, 'leader')", [A.clubId])).rowCount,
      promote: (
        await q("update club_members set role = 'admin' where club_id = $1 and user_id = $2", [
          A.clubId,
          users.aLeader2,
        ])
      ).rowCount,
    }));
    expect(result).toEqual({ player: 1, category: 1, invite: 1, promote: 1 });
  });

  it("the last admin cannot be removed or demoted", async () => {
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("update club_members set role = 'leader' where club_id = $1 and user_id = $2", [A.clubId, users.aAdmin]),
      ),
    ).rejects.toThrow(/at least one admin/);
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("delete from club_members where club_id = $1 and user_id = $2", [A.clubId, users.aAdmin]),
      ),
    ).rejects.toThrow(/at least one admin/);
  });

  it("a leader can leave a club", async () => {
    const removed = await asUser(db, users.aLeader2, async (q) => {
      const { rowCount } = await q("delete from club_members where club_id = $1 and user_id = $2", [
        A.clubId,
        users.aLeader2,
      ]);
      const visible = (await q("select * from players where team_id = $1", [A.teamId])).rowCount;
      return { rowCount, visible };
    });
    expect(removed).toEqual({ rowCount: 1, visible: 0 });
  });
});

describe("club creation", () => {
  it("any signed-in user can create a club and becomes its admin", async () => {
    const role = await asUser(db, users.outsider, async (q) => {
      const { rows } = await q<{ id: string }>(
        "insert into clubs (name, slug, created_by) values ('Ny Klubb', 'ny-klubb', $1) returning id",
        [users.outsider],
      );
      return (
        await q<{ role: string }>("select role from club_members where club_id = $1 and user_id = $2", [
          rows[0].id,
          users.outsider,
        ])
      ).rows[0]?.role;
    });
    expect(role).toBe("admin");
  });

  it("created_by cannot be spoofed", async () => {
    await expect(
      asUser(db, users.outsider, (q) =>
        q("insert into clubs (name, slug, created_by) values ('Fejk', 'fejk', $1)", [users.aAdmin]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("an admin can delete their whole club", async () => {
    const deleted = await asUser(db, users.bAdmin, async (q) => {
      const { rowCount } = await q("delete from clubs where id = $1", [B.clubId]);
      return rowCount;
    });
    expect(deleted).toBe(1);
  });

  it("anonymous visitors cannot create clubs", async () => {
    await expect(
      asUser(db, null, (q) => q("insert into clubs (name, slug) values ('Anon', 'anon')")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("assessments", () => {
  const readAssessment = (userId: string, id: string) =>
    asUser(db, userId, async (q) => ({
      assessment: (await q("select * from assessments where id = $1", [id])).rowCount,
      scores: (await q("select * from assessment_scores where assessment_id = $1", [id])).rowCount,
      positions: (await q("select * from assessment_positions where assessment_id = $1", [id])).rowCount,
      attendance: (await q("select * from assessment_attendance where assessment_id = $1", [id])).rowCount,
    }));
  const none = { assessment: 0, scores: 0, positions: 0, attendance: 0 };
  const all = { assessment: 1, scores: 1, positions: 1, attendance: 1 };

  it("a draft is visible only to its author, not even to admins", async () => {
    expect(await readAssessment(users.aLeader, A.draftAssessmentId)).toEqual(all);
    expect(await readAssessment(users.aAdmin, A.draftAssessmentId)).toEqual(none);
    expect(await readAssessment(users.aLeader2, A.draftAssessmentId)).toEqual(none);
  });

  it("a submitted assessment is visible to every member of the club", async () => {
    expect(await readAssessment(users.aLeader, A.submittedAssessmentId)).toEqual(all);
    expect(await readAssessment(users.bAdmin, A.submittedAssessmentId)).toEqual(none);
  });

  it("leaders cannot assess on someone else's behalf", async () => {
    await expect(
      asUser(db, users.aLeader, (q) =>
        q("insert into assessments (season_id, player_id, leader_id) values ($1, $2, $3)", [
          A.seasonId,
          A.playerIds[1],
          users.aAdmin,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("leaders cannot change another leader's assessment or its scores", async () => {
    const changed = await asUser(db, users.aLeader, async (q) => ({
      assessment: (await q("update assessments set comment = 'ändrad' where id = $1", [A.submittedAssessmentId]))
        .rowCount,
      scores: (await q("update assessment_scores set score = 1 where assessment_id = $1", [A.submittedAssessmentId]))
        .rowCount,
      deleted: (await q("delete from assessment_positions where assessment_id = $1", [A.submittedAssessmentId]))
        .rowCount,
    }));
    expect(changed).toEqual({ assessment: 0, scores: 0, deleted: 0 });

    await expect(
      asUser(db, users.aLeader, (q) =>
        q("insert into assessment_positions (assessment_id, position_code, level) values ($1, 'A', 1)", [
          A.submittedAssessmentId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a leader can write and submit their own assessment", async () => {
    const result = await asUser(db, users.aLeader, async (q) => {
      const { rows } = await q<{ id: string }>(
        "insert into assessments (season_id, player_id) values ($1, $2) returning id",
        [A.seasonId, A.playerIds[1]],
      );
      const id = rows[0].id;
      await q("insert into assessment_scores (assessment_id, category_id, score) values ($1, $2, 8)", [
        id,
        A.categoryId,
      ]);
      await q("insert into assessment_attendance (assessment_id, phase_id, value) values ($1, $2, 95)", [
        id,
        A.phaseId,
      ]);
      const submitted = await q<{ submitted_at: Date | null }>(
        "update assessments set status = 'submitted' where id = $1 returning submitted_at",
        [id],
      );
      return submitted.rows[0].submitted_at;
    });
    expect(result).toBeInstanceOf(Date);
  });

  it("a leader can submit only one assessment per player and season", async () => {
    await expect(
      asUser(db, users.aAdmin, (q) =>
        q("insert into assessments (season_id, player_id) values ($1, $2)", [A.seasonId, A.playerIds[0]]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("the author, player and season of an assessment cannot be changed", async () => {
    await expect(
      asUser(db, users.aLeader, (q) =>
        q("update assessments set player_id = $2 where id = $1", [A.draftAssessmentId, A.playerIds[1]]),
      ),
    ).rejects.toThrow(/cannot change/);
  });

  it("scores must be between 1 and 10", async () => {
    await expect(
      asUser(db, users.aLeader, (q) =>
        q("update assessment_scores set score = 11 where assessment_id = $1", [A.draftAssessmentId]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("admins can delete assessments in their club", async () => {
    const deleted = await asUser(db, users.aAdmin, async (q) =>
      (await q("delete from assessments where id = $1", [A.submittedAssessmentId])).rowCount,
    );
    expect(deleted).toBe(1);
  });
});

describe("invites", () => {
  async function makeInvite(fields: { email?: string; role?: string; expiresAt?: string }) {
    const { rows } = await db.query<{ token: string }>(
      `insert into invites (club_id, email, role, expires_at)
       values ($1, $2, coalesce($3, 'leader'), coalesce($4::timestamptz, now() + interval '7 days'))
       returning token`,
      [A.clubId, fields.email ?? null, fields.role ?? null, fields.expiresAt ?? null],
    );
    return rows[0].token;
  }

  const accept = (userId: string, token: string) =>
    asUser(db, userId, async (q) => {
      await q("select accept_invite($1)", [token]);
      return (
        await q<{ role: string }>("select role from club_members where club_id = $1 and user_id = $2", [
          A.clubId,
          userId,
        ])
      ).rows[0]?.role;
    });

  it("a link invite makes the user a leader", async () => {
    const token = await makeInvite({});
    expect(await accept(users.outsider, token)).toBe("leader");
  });

  it("an email invite only works for that email address", async () => {
    const token = await makeInvite({ email: "Outsider@Example.test" });
    await expect(accept(users.bLeader, token)).rejects.toThrow(/another email/);
    expect(await accept(users.outsider, token)).toBe("leader");
  });

  it("an expired invite is rejected", async () => {
    const token = await makeInvite({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(accept(users.outsider, token)).rejects.toThrow(/expired/);
  });

  it("an unknown token is rejected", async () => {
    await expect(accept(users.outsider, "nope")).rejects.toThrow(/not found/);
  });

  it("an invite never downgrades an admin", async () => {
    const token = await makeInvite({});
    expect(await accept(users.aAdmin, token)).toBe("admin");
  });

  it("anonymous visitors cannot accept invites", async () => {
    const token = await makeInvite({});
    await expect(asUser(db, null, (q) => q("select accept_invite($1)", [token]))).rejects.toThrow(
      /permission denied/,
    );
  });
});
