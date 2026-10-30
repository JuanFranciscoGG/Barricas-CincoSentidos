// Run with: npm test   (node's built-in runner + tsx, each test file in its own temporary schema on the Supabase database)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "@/lib/test-db";

process.env.SESSION_SECRET = "x".repeat(40);

type Edit = typeof import("./project-edit");
type Db = typeof import("@/lib/prisma");
let edit: Edit;
let prisma: Db["prisma"];

const base = {
  name: "El Malbec de Juan",
  variety: "Malbec",
  vintage: "2025",
  vineyard: "",
  origin: "Agrelo",
  volumeLiters: "225",
  alcohol: "13.5",
  startDate: "2026-02-01",
  estimatedAgingMonths: "12",
  status: "aging",
  originKnowledgeKey: "",
  varietyKnowledgeKey: "",
  notes: "",
};

async function fixture() {
  const c = await prisma.customer.create({ data: { name: "Cliente", email: `c${Math.random()}@t.local` } });
  const type = await prisma.operationType.create({ data: { name: `Tipo ${Math.random()}` } });
  const other = await prisma.operationType.create({ data: { name: `Otro ${Math.random()}` } });
  const p = await prisma.wineProject.create({
    data: {
      customerId: c.id,
      name: "Proyecto",
      variety: "Malbec",
      alcohol: 13,
      status: "aging",
      barrels: { create: { number: `E-${Math.random().toString(36).slice(2, 8)}` } },
      stages: { create: [{ name: "Llenado", sortOrder: 0, startedAt: new Date(2026, 1, 1) }, { name: "Crianza", sortOrder: 1 }] },
      story: { create: { text: "Mi historia", visible: true } },
    },
    include: { barrels: true, stages: { orderBy: { sortOrder: "asc" } } },
  });
  await prisma.bottlingRecord.create({ data: { projectId: p.id, bottlingDate: new Date(), bottleCount: 50 } });
  const op = await prisma.operation.create({
    data: { projectId: p.id, operationTypeId: type.id, date: new Date(2026, 2, 20), notes: "original", completed: true, customerVisible: false },
  });
  const owner = await prisma.owner.create({ data: { name: "Dueño" } });
  await prisma.barrelOwnership.create({ data: { ownerId: owner.id, barrelId: p.barrels[0].id, allocation: 10 } });
  return { p, op, type, other };
}

let dropTestSchema: () => Promise<void>;
before(async () => {
  dropTestSchema = await createTestDatabase();
  edit = await import("./project-edit");
  prisma = (await import("@/lib/prisma")).prisma;
});
after(async () => {
  await prisma.$disconnect();
  await dropTestSchema();
});

describe("edit project", () => {
  it("updates the name in place and persists it (no duplicate)", async () => {
    const { p } = await fixture();
    const before = await prisma.wineProject.count();
    await edit.updateProject(p.id, { ...base, name: "  Nombre corregido  " });
    const after = await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(after.name, "Nombre corregido");
    assert.equal(await prisma.wineProject.count(), before);
  });

  it("updates alcohol (accepting a decimal comma) and the other wine fields", async () => {
    const { p } = await fixture();
    await edit.updateProject(p.id, { ...base, alcohol: "14,5", vintage: "2024", volumeLiters: "300", estimatedAgingMonths: "18", origin: "Luján de Cuyo", vineyard: "Finca Sur", status: "bottled" });
    const a = await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(a.alcohol, 14.5);
    assert.equal(a.vintage, 2024);
    assert.equal(a.volumeLiters, 300);
    assert.equal(a.estimatedAgingMonths, 18);
    assert.equal(a.origin, "Luján de Cuyo");
    assert.equal(a.vineyard, "Finca Sur");
    assert.equal(a.status, "bottled");
  });

  it("empty optional fields clear them; required ones are enforced", async () => {
    const { p } = await fixture();
    await edit.updateProject(p.id, { ...base, alcohol: "", vintage: "", estimatedAgingMonths: "" });
    const a = await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(a.alcohol, null);
    assert.equal(a.vintage, null);
    await assert.rejects(() => edit.updateProject(p.id, { ...base, name: "   " }), edit.EditError);
    await assert.rejects(() => edit.updateProject(p.id, { ...base, variety: "" }), edit.EditError);
  });

  it("rejects invalid data and writes nothing", async () => {
    const { p } = await fixture();
    const snapshot = await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } });
    for (const bad of [
      { alcohol: "abc" },
      { alcohol: "40" },
      { alcohol: "-1" },
      { vintage: "1800" },
      { vintage: "2025.5" },
      { status: "hacked" },
      { startDate: "31/12/2026" },
      { startDate: "2026-02-31x" },
      { name: "x".repeat(121) },
      { estimatedAgingMonths: "0" },
    ]) {
      await assert.rejects(() => edit.updateProject(p.id, { ...base, name: "No debería guardarse", ...bad }), edit.EditError, JSON.stringify(bad));
    }
    const after = await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } });
    assert.deepEqual(after, snapshot);
  });

  it("reports field-level errors", async () => {
    const { p } = await fixture();
    try {
      await edit.updateProject(p.id, { ...base, alcohol: "99" });
      assert.fail("should have thrown");
    } catch (e) {
      assert.ok(e instanceof edit.EditError);
      assert.ok("alcohol" in e.fieldErrors);
    }
    await assert.rejects(() => edit.updateProject("does-not-exist", base), edit.EditError);
  });

  it("leaves relationships and unrelated data untouched", async () => {
    const { p } = await fixture();
    const barrelsBefore = await prisma.barrel.findMany({ where: { projectId: p.id } });
    const ownershipBefore = await prisma.barrelOwnership.findMany({ where: { barrel: { projectId: p.id } } });
    const tokenBefore = p.publicToken;
    await edit.updateProject(p.id, { ...base, name: "Otro nombre", alcohol: "12" });
    assert.deepEqual(await prisma.barrel.findMany({ where: { projectId: p.id } }), barrelsBefore);
    assert.deepEqual(await prisma.barrelOwnership.findMany({ where: { barrel: { projectId: p.id } } }), ownershipBefore);
    assert.equal((await prisma.wineProject.findUniqueOrThrow({ where: { id: p.id } })).publicToken, tokenBefore);
    assert.equal((await prisma.customerStory.findUniqueOrThrow({ where: { projectId: p.id } })).text, "Mi historia");
    assert.equal((await prisma.bottlingRecord.findFirstOrThrow({ where: { projectId: p.id } })).bottleCount, 50);
    assert.equal(await prisma.projectStage.count({ where: { projectId: p.id } }), 2);
    assert.equal(await prisma.operation.count({ where: { projectId: p.id } }), 1);
  });
});

describe("edit stages", () => {
  it("updates an existing stage in place", async () => {
    const { p } = await fixture();
    const stage = p.stages[1];
    await edit.updateStage(p.id, stage.id, { name: "Crianza en roble", startedAt: "2026-03-01", completedAt: "" });
    const s = await prisma.projectStage.findUniqueOrThrow({ where: { id: stage.id } });
    assert.equal(s.name, "Crianza en roble");
    assert.ok(s.startedAt);
    assert.equal(s.completedAt, null);
    assert.equal(await prisma.projectStage.count({ where: { projectId: p.id } }), 2);
    // The other stage is unchanged.
    assert.equal((await prisma.projectStage.findUniqueOrThrow({ where: { id: p.stages[0].id } })).name, "Llenado");
  });

  it("validates dates and ownership of the stage", async () => {
    const a = await fixture();
    const b = await fixture();
    await assert.rejects(() => edit.updateStage(a.p.id, a.p.stages[0].id, { name: "x", startedAt: "2026-05-01", completedAt: "2026-04-01" }), edit.EditError);
    await assert.rejects(() => edit.updateStage(a.p.id, a.p.stages[0].id, { name: "x", startedAt: "", completedAt: "2026-04-01" }), edit.EditError);
    await assert.rejects(() => edit.updateStage(a.p.id, a.p.stages[0].id, { name: "", startedAt: "", completedAt: "" }), edit.EditError);
    // A stage of another project cannot be edited through this project's id.
    await assert.rejects(() => edit.updateStage(a.p.id, b.p.stages[0].id, { name: "Intruso", startedAt: "", completedAt: "" }), edit.EditError);
    assert.equal((await prisma.projectStage.findUniqueOrThrow({ where: { id: b.p.stages[0].id } })).name, "Llenado");
  });
});

describe("edit history entries", () => {
  it("modifies an existing entry without creating a new one", async () => {
    const { p, op, other } = await fixture();
    await edit.updateOperation(p.id, op.id, {
      operationTypeId: other.id,
      date: "2026-04-10",
      notes: "corregido",
      customerHeadline: "Titulo",
      customerNote: "Nota",
      customerVisible: false,
      featured: true,
    });
    const o = await prisma.operation.findUniqueOrThrow({ where: { id: op.id } });
    assert.equal(o.operationTypeId, other.id);
    assert.equal(o.notes, "corregido");
    assert.equal(o.featured, true);
    assert.equal(o.customerVisible, true); // featured implies visible, as when first logged
    assert.equal(o.customerHeadline, "Titulo");
    assert.equal(o.date.getFullYear(), 2026);
    assert.equal(o.date.getMonth(), 3);
    assert.equal(o.date.getDate(), 10);
    assert.equal(await prisma.operation.count({ where: { projectId: p.id } }), 1);
  });

  it("recomputes done/task from the date, and validates input and ownership", async () => {
    const a = await fixture();
    const b = await fixture();
    const fields = { operationTypeId: a.type.id, date: "2999-01-01", notes: "", customerHeadline: "", customerNote: "", customerVisible: false, featured: false };
    await edit.updateOperation(a.p.id, a.op.id, fields);
    assert.equal((await prisma.operation.findUniqueOrThrow({ where: { id: a.op.id } })).completed, false);
    await edit.updateOperation(a.p.id, a.op.id, { ...fields, date: "2026-01-01" });
    assert.equal((await prisma.operation.findUniqueOrThrow({ where: { id: a.op.id } })).completed, true);

    await assert.rejects(() => edit.updateOperation(a.p.id, a.op.id, { ...fields, date: "ayer" }), edit.EditError);
    await assert.rejects(() => edit.updateOperation(a.p.id, a.op.id, { ...fields, operationTypeId: "nope" }), edit.EditError);
    await assert.rejects(() => edit.updateOperation(a.p.id, a.op.id, { ...fields, notes: "x".repeat(2001) }), edit.EditError);
    await assert.rejects(() => edit.updateOperation(a.p.id, b.op.id, { ...fields, notes: "Intruso" }), edit.EditError);
    assert.equal((await prisma.operation.findUniqueOrThrow({ where: { id: b.op.id } })).notes, "original");
  });
});
