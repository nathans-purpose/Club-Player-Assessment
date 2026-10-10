import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

// Settings (step 6): save_categories, save_position_targets and the club's
// display options, against the demo seed (club A) and a second club (B).

const CLUB_A = "00000000-0000-4000-a000-000000000001";
const TEAM_A = "00000000-0000-4000-a000-000000000002";
const ADMIN_A = "00000000-0000-4000-b000-000000000001";
const LEADER_A1 = "00000000-0000-4000-b000-000000000002";

let db: Client;
let drop: () => Promise<void>;
const B = {} as { admin: string; club: string; team: string; category: string };

type CategoryInput = { id: string | null; name: string; question?: string; subcategories?: { id: string | null; name: string }[] };

async function categoriesOf(teamId: string) {
  return (
    await db.query<{ id: string; name: string; question: string | null; sort_order: number; is_active: boolean }>(
      "select id, name, question, sort_order, is_active from categories where team_id = $1 order by is_active desc, sort_order, name",
      [teamId],
    )
  ).rows;
}

async function subcategoriesOf(categoryId: string) {
  return (
    await db.query<{ id: string; name: string; sort_order: number; is_active: boolean }>(
      "select id, name, sort_order, is_active from subcategories where category_id = $1 order by is_active desc, sort_order",
      [categoryId],
    )
  ).rows;
}

function saveCategories(userId: string, teamId: string, categories: CategoryInput[], commit = false) {
  return asUser(db, userId, (q) => q("select save_categories($1, $2)", [teamId, JSON.stringify(categories)]), {
    commit,
  });
}

function saveTargets(userId: string, teamId: string, targets: { position_code: string; target_count: number }[]) {
  return asUser(db, userId, (q) => q("select save_position_targets($1, $2)", [teamId, JSON.stringify(targets)]), {
    commit: true,
  });
}

/** Club A's current active categories as save_categories input. */
async function currentInput(): Promise<CategoryInput[]> {
  const active = (await categoriesOf(TEAM_A)).filter((c) => c.is_active);
  const input: CategoryInput[] = [];
  for (const c of active) {
    const subcategories = (await subcategoriesOf(c.id)).filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
    input.push({ id: c.id, name: c.name, question: c.question ?? "", subcategories });
  }
  return input;
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase({ seed: true }));
  B.admin = await createUser(db, "b-admin@example.test", "B Admin");
  const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
  B.club = await one("insert into clubs (name, slug, created_by) values ('Klubb B', 'klubb-b', $1) returning id", [B.admin]);
  B.team = await one("insert into teams (club_id, name) values ($1, 'Herr A') returning id", [B.club]);
  B.category = await one("insert into categories (team_id, name) values ($1, 'Teknik') returning id", [B.team]);
});

afterAll(async () => {
  await drop?.();
});

describe("save_categories", () => {
  it("renames, reorders, adds and deepens categories in one go", async () => {
    const input = await currentInput();
    const [first, second, ...rest] = input;
    await saveCategories(
      ADMIN_A,
      TEAM_A,
      [
        { ...second, name: `${second.name} (ny)`, question: "  Ny fråga  " },
        first,
        ...rest,
        { id: null, name: "Ledarskap", question: "", subcategories: [{ id: null, name: "Röst" }, { id: null, name: "Föredöme" }] },
      ],
      true,
    );

    const after = (await categoriesOf(TEAM_A)).filter((c) => c.is_active);
    expect(after.map((c) => c.name)).toEqual([
      `${second.name} (ny)`,
      first.name,
      ...rest.map((c) => c.name),
      "Ledarskap",
    ]);
    expect(after.map((c) => c.sort_order)).toEqual(after.map((_, i) => i + 1));
    expect(after[0]).toMatchObject({ id: second.id, question: "Ny fråga" });
    expect((await subcategoriesOf(after.at(-1)!.id)).map((s) => s.name)).toEqual(["Röst", "Föredöme"]);
  });

  it("deactivates left-out categories and subcategories but keeps their scores", async () => {
    const input = await currentInput();
    const deepened = input.find((c) => c.subcategories!.length > 0)!;
    const dropped = input.find((c) => c.subcategories!.length === 0 && c.name !== "Ledarskap")!;
    const droppedSub = deepened.subcategories![0];
    const scoresBefore = (
      await db.query("select count(*)::int as n from assessment_scores where category_id = $1 or subcategory_id = $2", [
        dropped.id,
        droppedSub.id,
      ])
    ).rows[0].n;
    expect(scoresBefore).toBeGreaterThan(0);

    await saveCategories(
      ADMIN_A,
      TEAM_A,
      input
        .filter((c) => c.id !== dropped.id)
        .map((c) => (c.id === deepened.id ? { ...c, subcategories: c.subcategories!.slice(1) } : c)),
      true,
    );

    const all = await categoriesOf(TEAM_A);
    expect(all.find((c) => c.id === dropped.id)!.is_active).toBe(false);
    expect((await subcategoriesOf(deepened.id!)).find((s) => s.id === droppedSub.id)!.is_active).toBe(false);
    const scoresAfter = (
      await db.query("select count(*)::int as n from assessment_scores where category_id = $1 or subcategory_id = $2", [
        dropped.id,
        droppedSub.id,
      ])
    ).rows[0].n;
    expect(scoresAfter).toBe(scoresBefore);

    // Restoring brings the same category back, with its history.
    await saveCategories(ADMIN_A, TEAM_A, [...(await currentInput()), { ...dropped, subcategories: [] }], true);
    expect((await categoriesOf(TEAM_A)).find((c) => c.id === dropped.id)!.is_active).toBe(true);
  });

  it("turns Fördjupa off by leaving out every subcategory", async () => {
    const input = await currentInput();
    const deepened = input.find((c) => c.subcategories!.length > 0)!;
    await saveCategories(
      ADMIN_A,
      TEAM_A,
      input.map((c) => (c.id === deepened.id ? { ...c, subcategories: [] } : c)),
      true,
    );
    expect((await subcategoriesOf(deepened.id!)).every((s) => !s.is_active)).toBe(true);
  });

  it("is for admins only", async () => {
    const input = await currentInput();
    await expect(saveCategories(LEADER_A1, TEAM_A, input)).rejects.toThrow(/admins/);
    await expect(saveCategories(B.admin, TEAM_A, input)).rejects.toThrow(/admins/);
    await expect(
      asUser(db, null, (q) => q("select save_categories($1, $2)", [TEAM_A, JSON.stringify(input)])),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot touch another team's categories or subcategories", async () => {
    // Club B's admin passes club A's category id for their own team.
    const [aCategory] = await currentInput();
    await expect(saveCategories(B.admin, B.team, [{ ...aCategory, subcategories: [] }])).rejects.toThrow(
      /does not belong/,
    );
    // And club A's admin cannot move a subcategory to another category.
    const sub = (
      await db.query<{ id: string; category_id: string }>(
        "select s.id, s.category_id from subcategories s join categories c on c.id = s.category_id where c.team_id = $1 limit 1",
        [TEAM_A],
      )
    ).rows[0];
    const input = await currentInput();
    const other = input.find((c) => c.id !== sub.category_id)!;
    await expect(
      saveCategories(
        ADMIN_A,
        TEAM_A,
        input.map((c) => (c.id === other.id ? { ...c, subcategories: [{ id: sub.id, name: "Flyttad" }] } : c)),
      ),
    ).rejects.toThrow(/does not belong/);
    expect((await categoriesOf(B.team)).map((c) => c.id)).toEqual([B.category]);
  });

  it("rolls back everything when one row is invalid", async () => {
    const before = await categoriesOf(TEAM_A);
    const input = await currentInput();
    await expect(
      saveCategories(ADMIN_A, TEAM_A, [{ ...input[0], name: "Byte" }, { id: null, name: "  " }], true),
    ).rejects.toThrow();
    expect(await categoriesOf(TEAM_A)).toEqual(before);
  });
});

describe("save_position_targets", () => {
  it("replaces the team's positions and counts", async () => {
    await saveTargets(ADMIN_A, TEAM_A, [
      { position_code: "MV", target_count: 1 },
      { position_code: "DM", target_count: 2 },
      { position_code: "A", target_count: 0 },
    ]);
    const rows = (
      await db.query("select position_code, target_count from position_targets where team_id = $1 order by position_code", [
        TEAM_A,
      ])
    ).rows;
    expect(rows).toEqual([
      { position_code: "A", target_count: 0 },
      { position_code: "DM", target_count: 2 },
      { position_code: "MV", target_count: 1 },
    ]);
  });

  it("is for admins of the team's club only, and rejects unknown positions", async () => {
    const targets = [{ position_code: "MV", target_count: 1 }];
    await expect(saveTargets(LEADER_A1, TEAM_A, targets)).rejects.toThrow(/admins/);
    await expect(saveTargets(B.admin, TEAM_A, targets)).rejects.toThrow(/admins/);
    await expect(saveTargets(ADMIN_A, TEAM_A, [{ position_code: "XX", target_count: 1 }])).rejects.toThrow();
    expect(
      (await db.query("select count(*)::int as n from position_targets where team_id = $1", [TEAM_A])).rows[0].n,
    ).toBe(3);
  });
});

describe("display options", () => {
  it("default to off and are readable by members", async () => {
    const row = await asUser(db, LEADER_A1, async (q) =>
      (await q("select anonymous_leader_view, screen_friendly from clubs where id = $1", [CLUB_A])).rows[0],
    );
    expect(row).toEqual({ anonymous_leader_view: false, screen_friendly: false });
  });

  it("can be changed by the club's admins only", async () => {
    const update = (userId: string) =>
      asUser(
        db,
        userId,
        async (q) =>
          (await q("update clubs set anonymous_leader_view = true, screen_friendly = true where id = $1", [CLUB_A]))
            .rowCount,
      );
    expect(await update(ADMIN_A)).toBe(1);
    expect(await update(LEADER_A1)).toBe(0);
    expect(await update(B.admin)).toBe(0);
  });
});
