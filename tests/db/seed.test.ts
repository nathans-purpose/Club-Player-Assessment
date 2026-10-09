import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase } from "./helpers";

const demoAdmin = "00000000-0000-4000-b000-000000000001";
const demoLeader = "00000000-0000-4000-b000-000000000002";

let db: Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
});

afterAll(async () => {
  await drop?.();
});

describe("demo seed", () => {
  it("creates a club with 17 players and 4 leaders, one of them admin", async () => {
    const { rows } = await db.query(`
      select
        (select count(*) from players)::int as players,
        (select count(*) from club_members)::int as members,
        (select count(*) from club_members where role = 'admin')::int as admins,
        (select count(*) from profiles)::int as profiles
    `);
    expect(rows[0]).toEqual({ players: 17, members: 4, admins: 1, profiles: 4 });
  });

  it("has submitted and draft assessments, and a player with few assessments", async () => {
    const { rows } = await db.query<{ status: string; count: number }>(
      "select status, count(*)::int as count from assessments group by status order by status",
    );
    expect(rows.find((r) => r.status === "submitted")!.count).toBeGreaterThan(40);
    expect(rows.find((r) => r.status === "draft")!.count).toBeGreaterThan(0);

    const few = await db.query(`
      select p.full_name from players p
      left join assessments a on a.player_id = p.id and a.status = 'submitted'
      group by p.id having count(a.id) < 3
    `);
    expect(few.rowCount).toBeGreaterThan(0);
  });

  it("is readable by its own leaders through RLS", async () => {
    const counts = await asUser(db, demoLeader, async (q) => ({
      players: (await q("select * from players")).rowCount,
      // other leaders' drafts stay hidden
      drafts: (await q("select * from assessments where status = 'draft' and leader_id <> $1", [demoLeader]))
        .rowCount,
    }));
    expect(counts).toEqual({ players: 17, drafts: 0 });

    const isAdmin = await asUser(db, demoAdmin, async (q) =>
      (await q<{ ok: boolean }>("select is_club_admin('00000000-0000-4000-a000-000000000001') as ok")).rows[0].ok,
    );
    expect(isAdmin).toBe(true);
  });
});
