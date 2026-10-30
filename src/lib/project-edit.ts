import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUSES } from "@/lib/enums";
import { parseLocalDate, todayLocalMidnight } from "@/lib/dates";

/**
 * Server-side editing of an EXISTING project, its stages and its history
 * entries. Every function updates the existing row in place (never creates a
 * duplicate) and only touches the fields it is given — barrels, owners,
 * inventory, photos, story and the public token are never modified here.
 * Framework-free so it can be tested directly.
 */

export class EditError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

const blank = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const optionalText = (max: number, label: string) =>
  z.preprocess(blank, z.string().max(max, `${label}: máximo ${max} caracteres.`).optional()).transform((v) => (v ? v : null));

/** Accepts "14,5" as well as "14.5"; empty means "not set". */
const optionalNumber = (label: string, min: number, max: number, integer = false) =>
  z
    .preprocess((v) => {
      const s = typeof v === "string" ? v.trim().replace(",", ".") : v;
      return s === "" || s === undefined || s === null ? undefined : Number(s);
    }, z.number({ error: `${label}: ingresá un número válido.` }).min(min, `${label}: mínimo ${min}.`).max(max, `${label}: máximo ${max}.`).optional())
    .refine((n) => n === undefined || !integer || Number.isInteger(n), { message: `${label}: tiene que ser un número entero.` })
    .transform((n) => (n === undefined ? null : n));

const optionalDate = (label: string) =>
  z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : blank(v)), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: fecha inválida.`).optional())
    .refine((s) => !s || !Number.isNaN(parseLocalDate(s).getTime()), { message: `${label}: fecha inválida.` })
    .transform((s) => (s ? parseLocalDate(s) : null));

const projectSchema = z.object({
  name: z.preprocess(blank, z.string().min(1, "El nombre es obligatorio.").max(120, "Nombre: máximo 120 caracteres.")),
  variety: z.preprocess(blank, z.string().min(1, "La variedad es obligatoria.").max(80, "Variedad: máximo 80 caracteres.")),
  vintage: optionalNumber("Añada", 1900, 2100, true),
  vineyard: optionalText(120, "Viñedo"),
  origin: optionalText(200, "Origen"),
  volumeLiters: optionalNumber("Volumen", 0, 1_000_000),
  alcohol: optionalNumber("Alcohol", 0, 25),
  startDate: optionalDate("Fecha de llenado"),
  estimatedAgingMonths: optionalNumber("Crianza estimada", 1, 120, true),
  status: z.enum(PROJECT_STATUSES, { error: "Estado inválido." }),
  originKnowledgeKey: optionalText(120, "Origen (conocimiento)"),
  varietyKnowledgeKey: optionalText(120, "Variedad (conocimiento)"),
  notes: optionalText(2000, "Notas"),
});

const stageSchema = z.object({
  name: z.preprocess(blank, z.string().min(1, "El nombre de la etapa es obligatorio.").max(80, "Nombre: máximo 80 caracteres.")),
  startedAt: optionalDate("Inicio"),
  completedAt: optionalDate("Fin"),
});

const operationSchema = z.object({
  operationTypeId: z.preprocess(blank, z.string().min(1, "Elegí un tipo de operación.")),
  date: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")),
  notes: optionalText(2000, "Notas"),
  customerHeadline: optionalText(120, "Título para el cliente"),
  customerNote: optionalText(1000, "Nota para el cliente"),
  customerVisible: z.boolean(),
  featured: z.boolean(),
});

function fail<T>(parsed: z.ZodSafeParseResult<T>): asserts parsed is z.ZodSafeParseSuccess<T> {
  if (parsed.success) return;
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new EditError(Object.values(fieldErrors)[0] ?? "Revisá los datos.", fieldErrors);
}

export type RawForm = Record<string, FormDataEntryValue | boolean | null | undefined>;

export async function updateProject(projectId: string, raw: RawForm) {
  const existing = await prisma.wineProject.findUnique({ where: { id: projectId } });
  if (!existing) throw new EditError("Proyecto no encontrado.");
  const parsed = projectSchema.safeParse(raw);
  fail(parsed);
  const d = parsed.data;
  await prisma.wineProject.update({
    where: { id: projectId },
    data: {
      name: d.name,
      variety: d.variety,
      vintage: d.vintage,
      vineyard: d.vineyard,
      origin: d.origin,
      volumeLiters: d.volumeLiters,
      alcohol: d.alcohol,
      startDate: d.startDate,
      estimatedAgingMonths: d.estimatedAgingMonths,
      status: d.status,
      originKnowledgeKey: d.originKnowledgeKey,
      varietyKnowledgeKey: d.varietyKnowledgeKey,
      notes: d.notes,
    },
  });
  return existing.publicToken;
}

export async function updateStage(projectId: string, stageId: string, raw: RawForm) {
  const stage = await prisma.projectStage.findUnique({ where: { id: stageId } });
  // The stage must belong to the project in the URL — an id from another project is refused.
  if (!stage || stage.projectId !== projectId) throw new EditError("Etapa no encontrada.");
  const parsed = stageSchema.safeParse(raw);
  fail(parsed);
  const { name, startedAt, completedAt } = parsed.data;
  if (completedAt && !startedAt) throw new EditError("Una etapa completa necesita fecha de inicio.", { startedAt: "Falta la fecha de inicio." });
  if (completedAt && startedAt && completedAt < startedAt) throw new EditError("El fin no puede ser anterior al inicio.", { completedAt: "Anterior al inicio." });
  await prisma.projectStage.update({ where: { id: stageId }, data: { name, startedAt, completedAt } });
}

export async function updateOperation(projectId: string, operationId: string, raw: RawForm) {
  const op = await prisma.operation.findUnique({ where: { id: operationId } });
  if (!op || op.projectId !== projectId) throw new EditError("Entrada del historial no encontrada.");
  const parsed = operationSchema.safeParse(raw);
  fail(parsed);
  const d = parsed.data;
  const type = await prisma.operationType.findUnique({ where: { id: d.operationTypeId } });
  if (!type) throw new EditError("Tipo de operación inválido.", { operationTypeId: "Tipo inválido." });
  const date = parseLocalDate(d.date);
  if (Number.isNaN(date.getTime())) throw new EditError("Fecha inválida.", { date: "Fecha inválida." });

  await prisma.operation.update({
    where: { id: operationId },
    data: {
      operationTypeId: d.operationTypeId,
      date,
      notes: d.notes,
      // Same rules as when an entry is first logged: a past/today date is done, a future one is a task.
      completed: date <= todayLocalMidnight(),
      featured: d.featured,
      customerVisible: d.featured || d.customerVisible,
      customerHeadline: d.customerHeadline,
      customerNote: d.customerNote,
    },
  });
}
