"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { barrelPath, primaryBarrelId } from "@/lib/admin-routes";
import { requireStaffSession } from "@/lib/auth-guard";
import { parseLocalDate } from "@/lib/dates";
import { saveUploadedFile } from "@/lib/upload";

export async function createBottlingRecord(formData: FormData) {
  await requireStaffSession();

  const projectId = String(formData.get("projectId"));
  const bottlingDateStr = String(formData.get("bottlingDate") || "");
  const litersObtained = Number(formData.get("litersObtained") || "") || null;
  const bottleCount = Number(formData.get("bottleCount") || "") || null;
  const bottleFormat = String(formData.get("bottleFormat") || "750ml").trim() || "750ml";
  const labelStatus = String(formData.get("labelStatus") || "undecided");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!projectId || !bottlingDateStr) {
    throw new Error("Faltan datos para registrar el embotellado.");
  }

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    photoUrl = await saveUploadedFile(photo);
  }

  await prisma.bottlingRecord.create({
    data: {
      projectId,
      bottlingDate: parseLocalDate(bottlingDateStr),
      litersObtained,
      bottleCount,
      bottleFormat,
      labelStatus,
      photoUrl,
      notes,
    },
  });

  const project = await prisma.wineProject.update({
    where: { id: projectId },
    data: { status: "bottled" },
  });

  revalidatePath("/dashboard/barrels", "layout");
  revalidatePath(`/wine/${project.publicToken}`);
  const barrelId = await primaryBarrelId(projectId);
  redirect(barrelId ? `${barrelPath(barrelId)}?logged=1` : "/dashboard/barrels");
}
