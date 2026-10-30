// Run with: npm test   (node's built-in runner + tsx, each test file in its own temporary schema on the Supabase database)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "@/lib/test-db";

process.env.SESSION_SECRET = "x".repeat(40);

type Notes = typeof import("./barrel-notes");
type Db = typeof import("@/lib/prisma");
let notes: Notes;
let prisma: Db["prisma"];

let seq = 0;
async function barrel() {
  seq++;
  const c = await prisma.customer.create({ data: { name: `C${seq}`, email: `c${seq}@t.local` } });
  const p = await prisma.wineProject.create({
    data: { customerId: c.id, name: `P${seq}`, variety: "Malbec", barrels: { create: { number: `N-${seq}` } } },
    include: { barrels: true },
  });
  return { project: p, barrel: p.barrels[0] };
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

let dropTestSchema: () => Promise<void>;
before(async () => {
  dropTestSchema = await createTestDatabase();
  notes = await import("./barrel-notes");
  prisma = (await import("@/lib/prisma")).prisma;
});
after(async () => {
  await prisma.$disconnect();
  await dropTestSchema();
});

describe("which item 'Lo último' shows", () => {
  const task = { date: day(2026, 8, 10), title: "Hoy probamos tu vino", note: "x" };

  it("without notes the task is returned unchanged", () => {
    assert.equal(notes.pickLatest(task, null), task);
    assert.equal(notes.pickLatest(null, null), null);
  });

  it("a task newer than every note wins", () => {
    const older = { date: day(2026, 8, 1), title: "Nota vieja", note: null };
    assert.equal(notes.pickLatest(task, older), task);
  });

  it("a note newer than every task wins", () => {
    const newer = { date: new Date(2026, 8, 5, 9, 30), title: "Hoy oxigenamos tu barrica", note: "detalle" };
    assert.equal(notes.pickLatest(task, newer), newer);
  });

  it("a note with no task is shown; a note published the same day as a task (with a time) wins", () => {
    const n = { date: day(2026, 8, 10), title: "Misma fecha", note: null };
    assert.equal(notes.pickLatest(null, n), n);
    const sameDay = { date: new Date(2026, 7, 10, 15, 0), title: "Más tarde", note: null };
    assert.equal(notes.pickLatest(task, sameDay), sameDay);
  });
});

describe("notes CRUD", () => {
  it("creates a note for a barrel (timestamp defaults to now) without creating tasks or stages", async () => {
    const { project, barrel: b } = await barrel();
    const before = { ops: await prisma.operation.count(), stages: await prisma.projectStage.count() };
    const { note, publicToken } = await notes.createNote(b.id, { title: "  Hoy oxigenamos tu barrica ", body: "Detalle." });
    assert.equal(publicToken, project.publicToken);
    assert.equal(note.title, "Hoy oxigenamos tu barrica");
    assert.equal(note.body, "Detalle.");
    assert.ok(Math.abs(note.publishedAt.getTime() - Date.now()) < 10_000);
    assert.deepEqual({ ops: await prisma.operation.count(), stages: await prisma.projectStage.count() }, before);
  });

  it("description is optional", async () => {
    const { barrel: b } = await barrel();
    const { note } = await notes.createNote(b.id, { title: "Solo título", body: "" });
    assert.equal(note.body, null);
  });

  it("validates title, description and date", async () => {
    const { barrel: b } = await barrel();
    await assert.rejects(() => notes.createNote(b.id, { title: "   " }), notes.NoteError);
    await assert.rejects(() => notes.createNote(b.id, { title: "x".repeat(121) }), notes.NoteError);
    await assert.rejects(() => notes.createNote(b.id, { title: "ok", body: "x".repeat(1001) }), notes.NoteError);
    await assert.rejects(() => notes.createNote(b.id, { title: "ok", publishedAt: "ayer" }), notes.NoteError);
    await assert.rejects(() => notes.createNote("nope", { title: "ok" }), notes.NoteError);
    assert.equal(await prisma.barrelNote.count({ where: { barrelId: b.id } }), 0);
  });

  it("edits in place (same barrel, no duplicate) and deleting removes it", async () => {
    const { barrel: b } = await barrel();
    const { note } = await notes.createNote(b.id, { title: "Original" });
    await notes.updateNote(note.id, { title: "Corregida", body: "Nueva descripción", publishedAt: "2026-09-01T10:15" });
    const after = await prisma.barrelNote.findUniqueOrThrow({ where: { id: note.id } });
    assert.equal(after.title, "Corregida");
    assert.equal(after.body, "Nueva descripción");
    assert.equal(after.barrelId, b.id);
    assert.equal(after.publishedAt.getFullYear(), 2026);
    assert.equal(after.publishedAt.getMonth(), 8);
    assert.equal(after.publishedAt.getHours(), 10);
    assert.equal(await prisma.barrelNote.count({ where: { barrelId: b.id } }), 1);
    await assert.rejects(() => notes.updateNote(note.id, { title: "" }), notes.NoteError);
    await notes.deleteNote(note.id);
    assert.equal(await prisma.barrelNote.count({ where: { barrelId: b.id } }), 0);
    await assert.rejects(() => notes.deleteNote(note.id), notes.NoteError);
  });
});

describe("the displayed item follows create / edit / delete, per barrel", () => {
  it("returns the newest note of that barrel only and falls back after deletion", async () => {
    const a = await barrel();
    const other = await barrel();
    const task = { date: day(2026, 8, 10), title: "Tarea destacada", note: null };

    assert.equal(await notes.getLatestNote(a.barrel.id), null);
    assert.equal(notes.pickLatest(task, await notes.getLatestNote(a.barrel.id)), task); // no notes: unchanged

    const n1 = await notes.createNote(a.barrel.id, { title: "Vieja", publishedAt: "2026-07-01T09:00" });
    const n2 = await notes.createNote(a.barrel.id, { title: "Nueva", publishedAt: "2026-09-20T09:00" });
    await notes.createNote(other.barrel.id, { title: "De otra barrica", publishedAt: "2027-01-01T09:00" });

    // Newer than the task: the newest note of THIS barrel (not the other barrel's note).
    let latest = notes.pickLatest(task, await notes.getLatestNote(a.barrel.id));
    assert.equal(latest?.title, "Nueva");

    // Edit the newest note to be older than the task: the task wins again.
    await notes.updateNote(n2.note.id, { title: "Nueva", publishedAt: "2026-08-01T09:00" });
    latest = notes.pickLatest(task, await notes.getLatestNote(a.barrel.id));
    assert.equal(latest, task);

    // Edit the title of the other note: it shows once it is the newest and newer than the task.
    await notes.updateNote(n1.note.id, { title: "Vieja editada", publishedAt: "2026-10-01T09:00" });
    latest = notes.pickLatest(task, await notes.getLatestNote(a.barrel.id));
    assert.equal(latest?.title, "Vieja editada");

    // Delete it: back to the (now older) remaining note, then to the task.
    await notes.deleteNote(n1.note.id);
    assert.equal(notes.pickLatest(task, await notes.getLatestNote(a.barrel.id)), task);
    await notes.deleteNote(n2.note.id);
    assert.equal(notes.pickLatest(task, await notes.getLatestNote(a.barrel.id)), task);

    // The other barrel's note was never affected.
    assert.equal((await notes.getLatestNote(other.barrel.id))?.title, "De otra barrica");
  });
});
