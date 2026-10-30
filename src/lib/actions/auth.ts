"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { isStaff, type Role } from "@/lib/enums";

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu email y contraseña." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos." };
  }

  if (!isStaff(user.role)) {
    return { error: "Esta cuenta no tiene acceso al panel interno." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as Role;
  session.name = user.name;
  await session.save();

  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
