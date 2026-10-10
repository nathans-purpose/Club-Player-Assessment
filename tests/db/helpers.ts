import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(import.meta.dirname, "../..");

// Server to create throwaway test databases on. Defaults to a local Postgres;
// point it at `supabase start`'s database (port 54322) if you prefer.
export const serverUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

function withDatabase(url: string, database: string) {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

/**
 * Creates a fresh database with the Supabase shim, all migrations and,
 * optionally, the demo seed. Returns a superuser client connected to it.
 */
export async function createTestDatabase({ seed = false } = {}) {
  const name = `rls_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const db = new Client({ connectionString: withDatabase(serverUrl, name) });
  await db.connect();
  await db.query(readFileSync(path.join(root, "tests/db/supabase-shim.sql"), "utf8"));

  const migrationsDir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  if (seed) {
    await db.query(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  }

  const drop = async () => {
    await db.end();
    const c = new Client({ connectionString: serverUrl });
    await c.connect();
    await c.query(`drop database if exists ${name} with (force)`);
    await c.end();
  };

  return { db, drop };
}

export async function createUser(db: Client, email: string, fullName = email) {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), $1, jsonb_build_object('full_name', $2::text))
     returning id`,
    [email, fullName],
  );
  return rows[0].id;
}

/**
 * Runs `fn` as a signed-in user (role `authenticated`, JWT sub = userId), or as
 * `anon` when userId is null. Always rolls back unless `commit` is set, so
 * tests stay independent.
 */
export async function asUser<T>(
  db: Client,
  userId: string | null,
  fn: (q: Client["query"]) => Promise<T>,
  { commit = false } = {},
): Promise<T> {
  await db.query("begin");
  try {
    if (userId) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
    } else {
      await db.query("set local role anon");
    }
    const result = await fn(db.query.bind(db) as Client["query"]);
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
