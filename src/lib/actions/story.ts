"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/**
 * The customer tells their story out loud; a staff member transcribes it
 * here. Customers never write to this themselves — see AGENTS.md / the
 * discovery doc on why the barrel story is staff-authored.
 */
export async function updateStory(formData: FormData) {
  const staff = await requireStaffSession();
  const projectId = String(formData.get("projectId"));

  const project = await prisma.wineProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Proyecto no encontrado.");

  const text = String(formData.get("text") || "").trim();
  const visible = formData.get("visible") === "on";

  await prisma.$transaction([
    prisma.customerStory.upsert({
      where: { projectId: project.id },
      update: { text, visible },
      create: { projectId: project.id, text, visible },
    }),
    // History of significant changes, shared with owner edits.
    prisma.storyRevision.create({
      data: { projectId: project.id, text, visible, actorType: "staff", actorId: staff.userId, actorName: staff.name },
    }),
  ]);

  revalidatePath("/dashboard/barrels", "layout");
  revalidatePath(`/wine/${project.publicToken}`);
}
