import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { DEFAULT_CATEGORIES, DEFAULT_FORMATIONS, DEFAULT_PHASES } from "../../lib/onboarding/defaults";
import { asUser, createTestDatabase, createUser } from "./helpers";

let db: Client;
let drop: () => Promise<void>;
const users = {} as Record<"founder" | "other" | "invitee" | "linkUser" | "stranger", string>;

const createClubSql = `select create_club($1, $2, $3, $4, $5, $6, $7, $8, $9) as id`;
const createClubParams = (name: string, slug: string, format: 11 | 9 | 7 | 5 = 11) => [
  name,
  slug,
  "Herr A",
  format,
  false,
  "2026",
  DEFAULT_PHASES,
  JSON.stringify(DEFAULT_FORMATIONS[format].targets),
  JSON.stringify(DEFAULT_CATEGORIES),
];

async function createClubAs(userId: string, name: string, slug: string, format: 11 | 9 | 7 | 5 = 11) {
  return asUser(
    db,
    userId,
    async (q) => (await q<{ id: string }>(createClubSql, createClubParams(name, slug, format))).rows[0].id,
    { commit: true },
  );
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  users.founder = await createUser(db, "founder@example.test", "Grundare");
  users.other = await createUser(db, "other@example.test", "Annan Admin");
  users.invitee = await createUser(db, "Invitee@Example.test", "Inbjuden");
  users.linkUser = await createUser(db, "link@example.test", "Länkledare");
  users.stranger = await createUser(db, "stranger@example.test", "Främling");
});

afterAll(async () => {
  await drop?.();
});

describe("create_club", () => {
  it("creates the club, team, season, phases, targets and categories with the caller as admin", async () => {
    const clubId = await createClubAs(users.founder, "Råsunda IK", "rasunda-ik", 7);

    const result = await asUser(db, users.founder, async (q) => {
      const one = async (sql: string) => (await q(sql, [clubId])).rows;
      return {
        role: (await one("select role from club_members where club_id = $1"))[0]?.role,
        team: (await one("select name, game_format, has_minors from teams where club_id = $1"))[0],
        season: (
          await one("select s.label, s.is_active from seasons s join teams t on t.id = s.team_id where t.club_id = $1")
        )[0],
        phases: (
          await one(`select ph.name from season_phases ph
                     join seasons s on s.id = ph.season_id join teams t on t.id = s.team_id
                     where t.club_id = $1 order by ph.sort_order`)
        ).map((r) => r.name),
        targets: Number(
          (
            await one(`select sum(target_count) as n from position_targets pt
                       join teams t on t.id = pt.team_id where t.club_id = $1`)
          )[0].n,
        ),
        categories: (
          await one(`select c.name from categories c join teams t on t.id = c.team_id
                     where t.club_id = $1 order by c.sort_order`)
        ).map((r) => r.name),
      };
    });

    expect(result).toEqual({
      role: "admin",
      team: { name: "Herr A", game_format: 7, has_minors: false },
      season: { label: "2026", is_active: true },
      phases: DEFAULT_PHASES,
      targets: 7,
      categories: DEFAULT_CATEGORIES.map((c) => c.name),
    });
  });

  it("picks a free slug when another club already has it", async () => {
    await createClubAs(users.other, "Råsunda IK", "rasunda-ik");
    const slugs = (await db.query("select slug from clubs where name = 'Råsunda IK' order by created_at")).rows.map(
      (r) => r.slug,
    );
    expect(slugs).toEqual(["rasunda-ik", "rasunda-ik-2"]);
  });

  it("rolls back everything when a step fails", async () => {
    const before = Number((await db.query("select count(*) from clubs")).rows[0].count);
    const params = createClubParams("Trasig Klubb", "trasig-klubb");
    params[7] = JSON.stringify([{ position_code: "XX", target_count: 1 }]);
    await expect(asUser(db, users.stranger, (q) => q(createClubSql, params), { commit: true })).rejects.toThrow(
      /check constraint/,
    );
    expect(Number((await db.query("select count(*) from clubs")).rows[0].count)).toBe(before);
  });

  it("is not available to anonymous visitors", async () => {
    await expect(asUser(db, null, (q) => q(createClubSql, createClubParams("Anon", "anon")))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("invites", () => {
  let clubId: string;
  let emailToken: string;
  let linkToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    clubId = await createClubAs(users.founder, "Inbjudarna FF", "inbjudarna-ff");
    ({ emailToken, linkToken, expiredToken } = await asUser(
      db,
      users.founder,
      async (q) => {
        const token = async (sql: string) => (await q<{ token: string }>(sql, [clubId])).rows[0].token;
        return {
          emailToken: await token(
            "insert into invites (club_id, email, role) values ($1, 'invitee@example.test', 'admin') returning token",
          ),
          linkToken: await token("insert into invites (club_id, role) values ($1, 'leader') returning token"),
          expiredToken: await token(
            "insert into invites (club_id, role, expires_at) values ($1, 'leader', now() - interval '1 day') returning token",
          ),
        };
      },
      { commit: true },
    ));
  });

  const preview = (userId: string | null, token: string) =>
    asUser(db, userId, async (q) => (await q("select * from invite_preview($1)", [token])).rows);

  it("shows the club name and role to the invitee", async () => {
    expect(await preview(users.invitee, emailToken)).toEqual([
      { club_name: "Inbjudarna FF", role: "admin", state: "ok" },
    ]);
    expect(await preview(users.linkUser, linkToken)).toEqual([
      { club_name: "Inbjudarna FF", role: "leader", state: "ok" },
    ]);
  });

  it("tells other users that an email invite is not theirs", async () => {
    expect((await preview(users.stranger, emailToken))[0].state).toBe("wrong_email");
  });

  it("reports expired invites, existing members and unknown tokens", async () => {
    expect((await preview(users.stranger, expiredToken))[0].state).toBe("expired");
    expect((await preview(users.founder, linkToken))[0].state).toBe("member");
    expect(await preview(users.stranger, "finns-inte")).toEqual([]);
  });

  it("is not available to anonymous visitors", async () => {
    await expect(preview(null, linkToken)).rejects.toThrow(/permission denied/);
  });

  it("accepting an email invite makes the invitee a member and uses it up", async () => {
    await asUser(db, users.invitee, (q) => q("select accept_invite($1)", [emailToken]), { commit: true });
    expect((await preview(users.invitee, emailToken))[0].state).toBe("member");
    const role = (
      await db.query("select role from club_members where club_id = $1 and user_id = $2", [clubId, users.invitee])
    ).rows[0]?.role;
    expect(role).toBe("admin");
  });

  it("a link invite works for several people", async () => {
    await asUser(db, users.linkUser, (q) => q("select accept_invite($1)", [linkToken]), { commit: true });
    await asUser(db, users.stranger, (q) => q("select accept_invite($1)", [linkToken]), { commit: true });
    const { rows } = await db.query("select user_id, role from club_members where club_id = $1 and user_id = any($2)", [
      clubId,
      [users.linkUser, users.stranger],
    ]);
    expect(rows.map((r) => r.role)).toEqual(["leader", "leader"]);
  });

  it("the new members see the club, but only admins see its invites", async () => {
    const seen = await asUser(db, users.linkUser, async (q) => ({
      club: (await q("select name from clubs where id = $1", [clubId])).rowCount,
      invites: (await q("select * from invites where club_id = $1", [clubId])).rowCount,
    }));
    expect(seen).toEqual({ club: 1, invites: 0 });
  });
});
