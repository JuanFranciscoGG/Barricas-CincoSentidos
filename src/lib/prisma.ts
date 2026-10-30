import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { SUPABASE_CA } from "@/lib/supabase-ca";

// PostgreSQL on Supabase through the pooled connection string (DATABASE_URL).
// DATABASE_SCHEMA is only set by the test suite, so each test file works in its own
// throwaway schema (see src/lib/test-db.ts).
function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — see .env.example.");
  const url = new URL(raw);
  url.searchParams.delete("pgbouncer"); // a Prisma-engine flag the `pg` driver does not know
  url.searchParams.delete("schema");
  const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);

  const pool = new Pool({
    connectionString: url.toString(),
    // Verified TLS: trust Supabase's own CA (or a CA you supply for another provider).
    ssl: local ? undefined : { ca: process.env.DATABASE_SSL_CA ?? SUPABASE_CA },
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  const schema = process.env.DATABASE_SCHEMA;
  // Tests only: hand-written SQL (`$executeRaw`) uses unqualified table names, so point those at the
  // test schema too. Requires a session-mode connection (see test-db.ts).
  if (schema) pool.on("connect", (client) => void client.query(`SET search_path TO "${schema}"`));
  return new PrismaClient({ adapter: new PrismaPg(pool, schema ? { schema } : undefined) });
}

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function getClient(): Client {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

// Created on first use, so importing this module (for example during `next build` or in a unit test
// that never touches the database) does not need DATABASE_URL.
export const prisma = new Proxy({} as Client, {
  get: (_target, prop) => Reflect.get(getClient(), prop),
});
