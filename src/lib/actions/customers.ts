"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";

export async function createCustomer(formData: FormData) {
  const session = await requireStaffSession();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "") || null;
  const country = String(formData.get("country") || "") || null;

  if (!name || !email) throw new Error("Nombre y email son obligatorios.");

  const customer = await prisma.customer.create({
    data: { name, email, phone, country, createdById: session.userId },
  });

  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/customers/${customer.id}`);
}

export async function updateCustomer(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim() || null;
  const country = String(formData.get("country") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!id) throw new Error("Cliente inválido.");
  if (!name || !email) throw new Error("Nombre y email son obligatorios.");

  const taken = await prisma.customer.findFirst({
    where: { email, NOT: { id } },
    select: { id: true },
  });
  if (taken) throw new Error("Ya existe otro cliente con ese email.");

  await prisma.customer.update({
    where: { id },
    data: { name, email, phone, country, notes },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  redirect(`/dashboard/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Cliente inválido.");

  const projectIds = (
    await prisma.wineProject.findMany({ where: { customerId: id }, select: { id: true } })
  ).map((p) => p.id);
  const byProject = { projectId: { in: projectIds } };

  // No hay borrado en cascada en el esquema: se elimina todo en orden de dependencias.
  await prisma.$transaction([
    prisma.labControl.deleteMany({ where: { operation: byProject } }),
    prisma.mediaItem.deleteMany({ where: byProject }),
    prisma.operation.deleteMany({ where: byProject }),
    prisma.barrel.deleteMany({ where: byProject }),
    prisma.projectStage.deleteMany({ where: byProject }),
    prisma.bottlingRecord.deleteMany({ where: byProject }),
    prisma.notification.deleteMany({ where: byProject }),
    prisma.customerMessage.deleteMany({ where: byProject }),
    prisma.customerStory.deleteMany({ where: byProject }),
    prisma.wineProject.deleteMany({ where: { customerId: id } }),
    prisma.user.deleteMany({ where: { customerId: id } }),
    prisma.customer.delete({ where: { id } }),
  ]);

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}
