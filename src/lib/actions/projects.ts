"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { barrelPath, primaryBarrelId } from "@/lib/admin-routes";
import { requireStaffSession } from "@/lib/auth-guard";

export async function createProject(formData: FormData) {
  const session = await requireStaffSession();

  const customerId = String(formData.get("customerId"));
  const name = String(formData.get("name") || "").trim();
  const variety = String(formData.get("variety") || "").trim();
  const vintageRaw = String(formData.get("vintage") || "");
  const origin = String(formData.get("origin") || "") || null;
  const barrelNumber = String(formData.get("barrelNumber") || "").trim();

  if (!customerId || !name || !variety || !barrelNumber) {
    throw new Error("Cliente, nombre, variedad y número de barrica son obligatorios.");
  }

  const project = await prisma.wineProject.create({
    data: {
      customerId,
      name,
      variety,
      vintage: vintageRaw ? Number(vintageRaw) : null,
      origin,
      status: "planning",
      startDate: new Date(),
      createdById: session.userId,
      barrels: {
        create: { number: barrelNumber, status: "filled" },
      },
      stages: {
        create: [
          { name: "Llenado", sortOrder: 0, startedAt: new Date() },
          { name: "Crianza", sortOrder: 1 },
          { name: "Embotellado", sortOrder: 2 },
        ],
      },
    },
  });

  revalidatePath("/dashboard/barrels", "layout");
  const barrelId = await primaryBarrelId(project.id);
  redirect(barrelId ? barrelPath(barrelId) : "/dashboard/barrels");
}
