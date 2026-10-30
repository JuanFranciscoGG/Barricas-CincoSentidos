// Test helper: gives each test file its own throwaway PostgreSQL schema inside the database named by
// DIRECT_URL (Supabase), applies the real migration SQL to it, and drops it afterwards. Never touches
// the `public` schema, so it is safe to run against the same project as the app.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SUPABASE_CA } from "./supabase-ca";

function admin(url: string) {
  const u = new URL(url);
  u.searchParams.delete("schema");
  u.searchParams.delete("pgbouncer");
  return new Client({ connectionString: u.toString(), ssl: { ca: process.env.DATABASE_SSL_CA ?? SUPABASE_CA } });
}

/** Creates the schema, migrates it, points the app's Prisma client at it, and returns the cleanup. */
export async function createTestDatabase(): Promise<() => Promise<void>> {
  const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!direct) throw new Error("Tests need DIRECT_URL (or DATABASE_URL) in .env — see .env.example.");
  const schema = `test_${randomBytes(6).toString("hex")}`;

  const client = admin(direct);
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    // Applied directly (not through `prisma migrate deploy`, which takes a database-wide lock and
    // would make parallel test files wait on each other).
    const root = path.join(process.cwd(), "prisma", "migrations");
    for (const dir of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      await client.query(readFileSync(path.join(root, dir, "migration.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }
  // Session-mode connection: each client keeps its own backend, so the per-connection search_path is safe.
  process.env.DATABASE_URL = direct;
  process.env.DATABASE_POOL_MAX = "2";
  process.env.DATABASE_SCHEMA = schema;

  return async () => {
    const c = admin(direct);
    await c.connect();
    try {
      await c.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await c.end();
    }
  };
}
