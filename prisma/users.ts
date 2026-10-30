// Manage staff logins from your own terminal. Passwords are typed hidden, are never written to a file,
// the shell history or the repo, and only a bcrypt hash is stored in the database (User table).
//   npm run db:users list                 show staff logins
//   npm run db:users add                  create a login, or change the password/name/role of one
//   npm run db:users disable <login>      block a login (its row stays: history refers to it)
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { isStaff, STAFF_ROLES } from "../src/lib/enums";
import { createPrompter } from "../src/lib/prompt";

const MIN_PASSWORD = 10;

function requireTerminal() {
  if (!process.stdin.isTTY) throw new Error("Run this in your own terminal (PowerShell), not from a script or a chat tool.");
}

async function list() {
  const users = await prisma.user.findMany({ where: { role: { in: STAFF_ROLES } }, orderBy: { createdAt: "asc" } });
  if (users.length === 0) console.log("No staff logins yet. Create one with: npm run db:users add");
  for (const u of users) console.log(`${u.email.padEnd(36)} ${u.name.padEnd(24)} ${u.role}`);
}

async function add() {
  requireTerminal();
  const { ask, askHidden, close } = createPrompter(process.stdin, process.stdout);
  try {
    await addWith(ask, askHidden);
  } finally {
    close();
  }
}

async function addWith(ask: (q: string) => Promise<string>, askHidden: (q: string) => Promise<string>) {
  const email = (await ask("Usuario o email: ")).toLowerCase();
  if (!email) throw new Error("Usuario vacío.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !isStaff(existing.role)) throw new Error("Ese usuario pertenece a un cliente, elegí otro.");
  const name = (await ask(`Nombre completo${existing ? ` [${existing.name}]` : ""}: `)) || existing?.name || "";
  if (!name) throw new Error("Nombre vacío.");
  const role = ((await ask(`Rol (${STAFF_ROLES.join(" / ")}) [${existing?.role ?? "owner_admin"}]: `)) || existing?.role || "owner_admin").toLowerCase();
  if (!isStaff(role)) throw new Error(`Rol inválido: ${role}`);
  const password = await askHidden(`Contraseña (mínimo ${MIN_PASSWORD} caracteres; se muestran asteriscos, podés pegarla): `);
  if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  if (password !== (await askHidden("Repetí la contraseña: "))) throw new Error("Las contraseñas no coinciden.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { email, name, role, passwordHash },
  });
  console.log(`${existing ? "Actualizado" : "Creado"}: ${email} (${role})`);
}

async function disable(email: string | undefined) {
  if (!email) throw new Error("Uso: npm run db:users disable <usuario>");
  const login = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: login } });
  if (!user || !isStaff(user.role)) throw new Error("No existe ese usuario del personal.");
  const admins = await prisma.user.count({ where: { role: "owner_admin" } });
  if (user.role === "owner_admin" && admins <= 1) throw new Error("Es el único administrador: creá otro antes de deshabilitarlo.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10) } });
  console.log(`Deshabilitado: ${login}`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === "list") return list();
  if (command === "add") return add();
  if (command === "disable") return disable(arg);
  console.log("Uso: npm run db:users <list | add | disable <usuario>>");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
