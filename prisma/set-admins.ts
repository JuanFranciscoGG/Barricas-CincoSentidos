// Sets the administrator logins and disables every other staff login.
//   ADMIN1_PASSWORD=... ADMIN2_PASSWORD=... npm run db:admins
// An admin whose password variable is not set is skipped (its existing login is left untouched).
// Run it against the target database (DATABASE_URL), including production. Passwords come
// from the environment only — they are never stored in the repo, and only a bcrypt hash is
// written to the database. Safe to re-run (also how a password is changed or recovered).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const ADMINS = [
  // legacyEmail: the existing Dirección account is renamed (same row, same id) so the history it created stays attributed.
  { email: "manuval@finca-algarve.com.ar", name: "Manuel Valdez", passwordEnv: "ADMIN1_PASSWORD", legacyEmail: "manuel@cincosentidos.com.ar" },
  { email: "juanfragiugno@cinco-sentidos.com.ar", name: "Juan Fragiugno", passwordEnv: "ADMIN2_PASSWORD", legacyEmail: null },
];

async function main() {
  let ready = 0;
  for (const admin of ADMINS) {
    const password = process.env[admin.passwordEnv]; // an env var is always a string, so "0152" keeps its leading zero
    if (typeof password !== "string" || password.length === 0) {
      console.log(`skipped (${admin.passwordEnv} not set): ${admin.email}`);
      continue;
    }
    ready++;
    const passwordHash = await bcrypt.hash(password, 10);
    const current = await prisma.user.findUnique({ where: { email: admin.email } });
    const legacy = !current && admin.legacyEmail ? await prisma.user.findUnique({ where: { email: admin.legacyEmail } }) : null;
    if (current || legacy) {
      await prisma.user.update({
        where: { id: (current ?? legacy)!.id },
        data: { email: admin.email, name: admin.name, role: "owner_admin", passwordHash, customerId: null },
      });
    } else {
      await prisma.user.create({ data: { email: admin.email, name: admin.name, role: "owner_admin", passwordHash } });
    }
    console.log(`admin ready: ${admin.email}`);
  }

  if (ready === 0) throw new Error("Set ADMIN1_PASSWORD and/or ADMIN2_PASSWORD.");

  // Obsolete staff logins keep their rows (operations and knowledge entries reference them) but get an
  // unusable password, so nobody can sign in with them. Customers are not touched.
  const keep = ADMINS.map((a) => a.email);
  const obsolete = await prisma.user.findMany({
    where: { role: { in: ["owner_admin", "enologo", "comercial"] }, email: { notIn: keep } },
    select: { id: true, email: true },
  });
  for (const u of obsolete) {
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10) } });
    console.log(`login disabled: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
