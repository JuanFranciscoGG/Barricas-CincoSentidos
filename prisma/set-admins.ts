// Sets the administrator login and disables every other staff login.
//   ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run db:admins
// ADMIN_EMAIL (default "prueba") is the login name, an email or a plain username. ADMIN_PASSWORD is
// required. Run it against the target database (DATABASE_URL), including production. The password
// comes from the environment only — it is never stored in the repo, and only a bcrypt hash is written
// to the database. Safe to re-run (also how a password is changed or recovered).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const email = (process.env.ADMIN_EMAIL ?? "prueba").trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Usuario de prueba";

async function main() {
  const password = process.env.ADMIN_PASSWORD; // an env var is always a string, so "0152" keeps its leading zero
  if (typeof password !== "string" || password.length === 0) throw new Error("ADMIN_PASSWORD is not set.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, role: "owner_admin", passwordHash, customerId: null },
    create: { email, name, role: "owner_admin", passwordHash },
  });
  console.log(`admin ready: ${email}`);

  // Other staff logins keep their rows (operations and knowledge entries reference them) but get an
  // unusable password, so nobody can sign in with them. Customers are not touched.
  const obsolete = await prisma.user.findMany({
    where: { role: { in: ["owner_admin", "enologo", "comercial"] }, email: { not: email } },
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
