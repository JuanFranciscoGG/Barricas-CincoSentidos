"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";

// Strips combining diacritics (the accents NFD splits off) so labels like
// "Añada" or "Roble Francés" slugify to plain ASCII.
const COMBINING_MARKS = /[̀-ͯ]/g;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseChipLines(raw: string): { label: string; value: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { label: line, value: "" };
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
}

function parseSourceLines(raw: string): { label: string; url: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { label: line, url: "" };
      return { label: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
    });
}

// ---------------------------------------------------------------------------
// Categories (KnowledgeTopic)
// ---------------------------------------------------------------------------

export async function createKnowledgeCategory(formData: FormData) {
  await requireStaffSession();

  const label = String(formData.get("label") || "").trim();
  if (!label) throw new Error("La categoría necesita un nombre.");

  let key = slugify(label);
  if (!key) throw new Error("Ese nombre no genera una clave válida.");
  // Guarantee uniqueness without surfacing the internal key to the admin.
  for (let suffix = 2; await prisma.knowledgeTopic.findUnique({ where: { key } }); suffix++) {
    key = `${slugify(label)}-${suffix}`;
  }

  const count = await prisma.knowledgeTopic.count();
  await prisma.knowledgeTopic.create({ data: { key, label, sortOrder: count } });

  revalidatePath("/dashboard/knowledge");
}

export async function renameKnowledgeCategory(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!id || !label) throw new Error("Falta el nombre de la categoría.");

  const topic = await prisma.knowledgeTopic.update({ where: { id }, data: { label } });

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${topic.key}`);
}

export async function moveKnowledgeCategory(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const direction = String(formData.get("direction"));
  const topics = await prisma.knowledgeTopic.findMany({ orderBy: { sortOrder: "asc" } });
  const index = topics.findIndex((t) => t.id === id);
  if (index === -1) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= topics.length) return;

  const a = topics[index];
  const b = topics[swapWith];
  await prisma.$transaction([
    prisma.knowledgeTopic.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.knowledgeTopic.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath("/dashboard/knowledge");
}

// ---------------------------------------------------------------------------
// Entries (KnowledgeEntry)
// ---------------------------------------------------------------------------

export async function createKnowledgeEntry(formData: FormData) {
  const session = await requireStaffSession();

  const topicId = String(formData.get("topicId"));
  const key = String(formData.get("key") || "").trim().toLowerCase().replace(/\s+/g, "-");
  const title = String(formData.get("title") || "").trim();
  const locationLine = String(formData.get("locationLine") || "") || null;
  const teaser = String(formData.get("teaser") || "").trim() || null;
  const factChips = parseChipLines(String(formData.get("factChips") || ""));
  const narrative = String(formData.get("narrative") || "").trim();
  const sources = parseSourceLines(String(formData.get("sources") || ""));
  const publish = formData.get("status") === "published";

  if (!topicId || !key || !title || !narrative) {
    throw new Error("Categoría, clave, título y relato son obligatorios.");
  }

  const topic = await prisma.knowledgeTopic.findUnique({ where: { id: topicId } });
  if (!topic) throw new Error("Categoría inválida.");

  const count = await prisma.knowledgeEntry.count({ where: { topicId } });

  await prisma.knowledgeEntry.create({
    data: {
      topicId,
      key,
      title,
      locationLine,
      teaser,
      factChips: JSON.stringify(factChips),
      narrative,
      sources: JSON.stringify(sources),
      status: publish ? "published" : "draft",
      sortOrder: count,
      authoredById: session.userId,
    },
  });

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${topic.key}`);
  redirect(`/dashboard/knowledge/${topic.key}`);
}

export async function updateKnowledgeEntry(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const locationLine = String(formData.get("locationLine") || "") || null;
  const teaser = String(formData.get("teaser") || "").trim() || null;
  const factChips = parseChipLines(String(formData.get("factChips") || ""));
  const narrative = String(formData.get("narrative") || "").trim();
  const sources = parseSourceLines(String(formData.get("sources") || ""));
  const status = String(formData.get("status") || "draft");
  const topicId = String(formData.get("topicId") || "") || undefined;

  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data: {
      title,
      locationLine,
      teaser,
      factChips: JSON.stringify(factChips),
      narrative,
      sources: JSON.stringify(sources),
      status,
      ...(topicId ? { topicId } : {}),
    },
    include: { topic: true },
  });

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${entry.topic.key}`);
  redirect(`/dashboard/knowledge/${entry.topic.key}/${entry.id}`);
}

export async function moveKnowledgeEntry(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const direction = String(formData.get("direction"));
  const current = await prisma.knowledgeEntry.findUnique({ where: { id }, include: { topic: true } });
  if (!current) return;

  const siblings = await prisma.knowledgeEntry.findMany({
    where: { topicId: current.topicId },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((e) => e.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return;

  const a = siblings[index];
  const b = siblings[swapWith];
  await prisma.$transaction([
    prisma.knowledgeEntry.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.knowledgeEntry.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath(`/dashboard/knowledge/${current.topic.key}`);
}

export async function setKnowledgeEntryStatus(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const status = String(formData.get("status") || "draft");
  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data: { status },
    include: { topic: true },
  });

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${entry.topic.key}`);
}

export async function deleteKnowledgeEntry(formData: FormData) {
  await requireStaffSession();

  const id = String(formData.get("id"));
  const entry = await prisma.knowledgeEntry.findUnique({ where: { id }, include: { topic: true } });
  if (!entry) return;

  await prisma.$transaction([
    prisma.knowledgePairing.deleteMany({ where: { OR: [{ entryAId: id }, { entryBId: id }] } }),
    prisma.knowledgeEntry.delete({ where: { id } }),
  ]);

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${entry.topic.key}`);
  redirect(`/dashboard/knowledge/${entry.topic.key}`);
}
