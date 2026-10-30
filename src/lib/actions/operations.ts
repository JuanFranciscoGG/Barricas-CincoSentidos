"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { barrelPath, primaryBarrelId } from "@/lib/admin-routes";
import { requireStaffSession } from "@/lib/auth-guard";
import { parseLocalDate, todayLocalMidnight } from "@/lib/dates";
import { saveUploadedFile } from "@/lib/upload";
import { isOperationCategory } from "@/lib/operation-catalog";

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function logOperation(formData: FormData) {
  const session = await requireStaffSession();

  const projectId = String(formData.get("projectId"));
  const barrelId = String(formData.get("barrelId") || "") || null;
  const stageId = String(formData.get("stageId") || "") || null;
  const operationTypeId = String(formData.get("operationTypeId"));
  const dateStr = String(formData.get("date"));
  const notes = String(formData.get("notes") || "") || null;
  const featured = formData.get("featured") === "on";
  const customerVisible = featured || formData.get("customerVisible") === "on";
  const customerHeadline = String(formData.get("customerHeadline") || "").trim() || null;
  const customerNote = String(formData.get("customerNote") || "").trim() || null;
  const wantsAnother = formData.get("redirectMode") === "again";

  if (!projectId || !operationTypeId || !dateStr) {
    throw new Error("Faltan datos para registrar la operación.");
  }

  const operationType = await prisma.operationType.findUnique({ where: { id: operationTypeId } });
  if (!operationType || !operationType.active) throw new Error("Tipo de operación inválido.");

  const date = parseLocalDate(dateStr);
  const completed = date <= todayLocalMidnight();

  const operation = await prisma.operation.create({
    data: {
      projectId,
      barrelId,
      stageId,
      operationTypeId,
      date,
      notes,
      completed,
      customerVisible,
      featured,
      customerHeadline,
      customerNote,
      createdById: session.userId,
    },
  });

  // Lab fields — only ever shown in the UI for lab-analysis operations, but
  // harmless to persist whenever the form actually carried them.
  const brix = numOrNull(formData.get("brix"));
  const ph = numOrNull(formData.get("ph"));
  const totalSo2 = numOrNull(formData.get("totalSo2"));
  const volatileAcid = numOrNull(formData.get("volatileAcid"));
  const sensoryNotes = String(formData.get("sensoryNotes") || "").trim() || null;
  if (brix !== null || ph !== null || totalSo2 !== null || volatileAcid !== null || sensoryNotes) {
    await prisma.labControl.create({
      data: { operationId: operation.id, brix, ph, totalSo2, volatileAcid, sensoryNotes },
    });
  }

  // Optional quick photo capture — one input, no separate upload screen.
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await saveUploadedFile(photo);
    await prisma.mediaItem.create({
      data: {
        projectId,
        operationId: operation.id,
        url,
        type: "photo",
        caption: customerNote,
        customerVisible,
        capturedAt: date,
        uploadedById: session.userId,
      },
    });
  }

  revalidatePath("/dashboard/barrels", "layout");
  revalidatePath("/dashboard");
  const landing = barrelId ?? (await primaryBarrelId(projectId));
  if (!landing) redirect("/dashboard/barrels");

  // Bottling is a milestone, not just another log line — send staff straight
  // into the quick bottling-record form instead of the generic project page.
  if (operationType.systemKey === "bottling") {
    redirect(barrelPath(landing, "/bottling/new"));
  }
  if (wantsAnother) {
    redirect(`${barrelPath(landing, "/log")}?saved=1`);
  }
  redirect(`${barrelPath(landing)}?logged=1`);
}

function parseTypeFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("El tipo de operación necesita un nombre.");
  const category = String(formData.get("category") || "recurring");
  return {
    name,
    description: String(formData.get("description") || "").trim() || null,
    category: isOperationCategory(category) ? category : "recurring",
    defaultCustomerVisible: formData.get("defaultCustomerVisible") === "on",
    color: String(formData.get("color") || "") || null,
  };
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await prisma.operationType.findUnique({ where: { name } });
  if (clash && clash.id !== exceptId) {
    throw new Error(`Ya existe un tipo llamado "${name}"${clash.active ? "" : " (archivado)"}.`);
  }
}

export async function createOperationType(formData: FormData) {
  await requireStaffSession();
  const data = parseTypeFields(formData);
  await assertNameFree(data.name);
  const last = await prisma.operationType.aggregate({ _max: { sortOrder: true } });
  await prisma.operationType.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  revalidateCatalog();
}

export async function updateOperationType(formData: FormData) {
  await requireStaffSession();
  const id = String(formData.get("id"));
  const data = parseTypeFields(formData);
  await assertNameFree(data.name, id);
  await prisma.operationType.update({ where: { id }, data });
  revalidateCatalog();
}

// Swap with the neighbor and renumber, so order stays dense and stable even if
// sortOrder values were duplicated (e.g. rows created before the catalog).
export async function moveOperationType(formData: FormData) {
  await requireStaffSession();
  const id = String(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const all = await prisma.operationType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const i = all.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(
    all.map((t, idx) => prisma.operationType.update({ where: { id: t.id }, data: { sortOrder: idx } })),
  );
  revalidateCatalog();
}

export async function setOperationTypeActive(formData: FormData) {
  await requireStaffSession();
  const id = String(formData.get("id"));
  await prisma.operationType.update({ where: { id }, data: { active: formData.get("active") === "true" } });
  revalidateCatalog();
}

// Hard delete only when nothing references the type; otherwise history would
// lose its label, so the type is archived instead.
export async function deleteOperationType(formData: FormData) {
  await requireStaffSession();
  const id = String(formData.get("id"));
  const used = await prisma.operation.count({ where: { operationTypeId: id } });
  if (used > 0) {
    await prisma.operationType.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.operationType.delete({ where: { id } });
  }
  revalidateCatalog();
}

function revalidateCatalog() {
  revalidatePath("/dashboard/operation-types");
  revalidatePath("/dashboard/barrels", "layout");
}

export async function createStage(formData: FormData) {
  await requireStaffSession();
  const projectId = String(formData.get("projectId"));
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !name) throw new Error("La etapa necesita un nombre.");

  const count = await prisma.projectStage.count({ where: { projectId } });
  await prisma.projectStage.create({
    data: { projectId, name, sortOrder: count, startedAt: new Date() },
  });
  revalidatePath("/dashboard/barrels", "layout");
}
