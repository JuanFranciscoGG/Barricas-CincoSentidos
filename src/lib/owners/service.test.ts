// Run with: npm test   (node's built-in runner + tsx, each test file in its own temporary schema on the Supabase database)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "@/lib/test-db";

process.env.SESSION_SECRET = "x".repeat(40);

type Service = typeof import("./service");
type Db = typeof import("@/lib/prisma");
let svc: Service;
let prisma: Db["prisma"];
const staff = { type: "staff" as const, id: "staff-1", name: "Admin" };

let seq = 0;
const key = () => `idem-${String(++seq).padStart(6, "0")}-abcdefghij`;

async function makeBarrel(bottles: number | null = 100) {
  seq++;
  const customer = await prisma.customer.create({ data: { name: `Cliente ${seq}`, email: `c${seq}@test.local` } });
  const project = await prisma.wineProject.create({
    data: { customerId: customer.id, name: `Proyecto ${seq}`, variety: "Malbec", barrels: { create: { number: `T-${seq}` } } },
    include: { barrels: true },
  });
  if (bottles !== null) await prisma.bottlingRecord.create({ data: { projectId: project.id, bottlingDate: new Date(), bottleCount: bottles } });
  return { project, barrel: project.barrels[0] };
}

const owner = (name: string) => svc.createOwner({ name }, staff);

/** Barrel with the given owners assigned (name -> allocation) and a PIN set. */
async function setup(allocs: Record<string, number>, bottles = 100, pin = "123456") {
  const { project, barrel } = await makeBarrel(bottles);
  const owners: Record<string, { id: string; assignmentId: string }> = {};
  for (const [name, alloc] of Object.entries(allocs)) {
    const o = await owner(name);
    const a = await svc.assignOwner(o.id, barrel.id, { allocation: alloc }, staff);
    owners[name] = { id: o.id, assignmentId: a.id };
  }
  const { token } = await svc.issueBarrelToken(barrel.id, "activation", staff);
  await svc.redeemToken(token, pin, pin);
  const version = (await prisma.barrel.findUniqueOrThrow({ where: { id: barrel.id } })).sessionVersion;
  return { project, barrel, owners, version, auth: { barrelId: barrel.id, sessionVersion: version } };
}

let dropTestSchema: () => Promise<void>;
before(async () => {
  dropTestSchema = await createTestDatabase();
  svc = await import("./service");
  prisma = (await import("@/lib/prisma")).prisma;
});

after(async () => {
  await prisma.$disconnect();
  await dropTestSchema();
});

describe("many-to-many ownership", () => {
  it("one owner can hold several barrels and one barrel several owners", async () => {
    const a = await makeBarrel();
    const b = await makeBarrel();
    const laura = await owner("Laura");
    const martin = await owner("Martín");
    await svc.assignOwner(laura.id, a.barrel.id, {}, staff);
    await svc.assignOwner(laura.id, b.barrel.id, {}, staff);
    await svc.assignOwner(martin.id, a.barrel.id, {}, staff);
    assert.equal(await prisma.barrelOwnership.count({ where: { barrelId: a.barrel.id, endedAt: null } }), 2);
    assert.equal(await prisma.barrelOwnership.count({ where: { ownerId: laura.id, endedAt: null } }), 2);
  });

  it("rejects a duplicate active assignment but allows re-assigning after revocation (history kept)", async () => {
    const { barrel } = await makeBarrel();
    const o = await owner("Laura");
    const first = await svc.assignOwner(o.id, barrel.id, {}, staff);
    await assert.rejects(() => svc.assignOwner(o.id, barrel.id, {}, staff), { code: "conflict" });
    await svc.revokeAssignment(first.id, staff);
    await svc.assignOwner(o.id, barrel.id, {}, staff);
    assert.equal(await prisma.barrelOwnership.count({ where: { barrelId: barrel.id, ownerId: o.id } }), 2);
  });

  it("removing an owner from one barrel keeps their other barrels", async () => {
    const a = await makeBarrel();
    const b = await makeBarrel();
    const laura = await owner("Laura");
    const onA = await svc.assignOwner(laura.id, a.barrel.id, {}, staff);
    await svc.assignOwner(laura.id, b.barrel.id, {}, staff);
    await svc.revokeAssignment(onA.id, staff);
    const active = await prisma.barrelOwnership.findMany({ where: { ownerId: laura.id, endedAt: null } });
    assert.deepEqual(active.map((x) => x.barrelId), [b.barrel.id]);
  });
});

describe("shared barrel PIN", () => {
  it("every owner of the barrel uses the same PIN; the PIN is stored only as a hash", async () => {
    const s = await setup({ Laura: 10, Martín: 10, Sofía: 10 }, 100, "482913");
    assert.equal((await svc.verifyBarrelPin(s.barrel.id, "482913")).ok, true);
    const stored = await prisma.barrel.findUniqueOrThrow({ where: { id: s.barrel.id } });
    assert.match(stored.pinHash ?? "", /^\$2[aby]\$/);
    assert.ok(!JSON.stringify(stored).includes("482913"));
  });

  it("different barrels have independent PINs and sessions do not cross over", async () => {
    const a = await setup({ Laura: 5 }, 100, "111111");
    const b = await setup({ Laura: 5 }, 100, "222222");
    assert.equal((await svc.verifyBarrelPin(a.barrel.id, "222222")).ok, false);
    assert.equal((await svc.verifyBarrelPin(b.barrel.id, "222222")).ok, true);
    // Sessions are per barrel: resetting B cuts B's sessions and leaves A's untouched.
    // (The session cookie stores one entry per barrel id, so A's entry is never consulted for B.)
    assert.ok(await svc.authorizeBarrel(a.barrel.id, a.version, "canGift"));
    assert.ok(await svc.authorizeBarrel(b.barrel.id, b.version, "canGift"));
    await svc.issueBarrelToken(b.barrel.id, "reset", staff);
    assert.equal(await svc.authorizeBarrel(b.barrel.id, b.version, "canGift"), null);
    assert.ok(await svc.authorizeBarrel(a.barrel.id, a.version, "canGift"));
  });

  it("rejects wrong PINs generically, and locks out after repeated failures", async () => {
    const s = await setup({ Laura: 5 }, 100, "482913");
    const bad = await svc.verifyBarrelPin(s.barrel.id, "000001");
    assert.equal(bad.ok, false);
    for (let i = 1; i < svc.FREE_PIN_ATTEMPTS; i++) await svc.verifyBarrelPin(s.barrel.id, "999999");
    const locked = await svc.verifyBarrelPin(s.barrel.id, "482913");
    assert.equal(locked.ok === false && locked.locked, true);
    assert.equal((await svc.verifyBarrelPin(s.barrel.id, "482913", new Date(Date.now() + 2 * 60 * 1000))).ok, true);
  });

  it("escalates lock duration", () => {
    assert.equal(svc.lockSecondsFor(4), 0);
    assert.equal(svc.lockSecondsFor(5), 60);
    assert.equal(svc.lockSecondsFor(6), 120);
    assert.equal(svc.lockSecondsFor(40), 3600);
  });

  it("reset invalidates the old PIN and every session for that barrel", async () => {
    const s = await setup({ Laura: 5, Martín: 5 }, 100, "482913");
    assert.ok(await svc.authorizeBarrel(s.barrel.id, s.version, "canGift"));
    await svc.issueBarrelToken(s.barrel.id, "reset", staff);
    assert.equal((await svc.verifyBarrelPin(s.barrel.id, "482913")).ok, false);
    assert.equal(await svc.authorizeBarrel(s.barrel.id, s.version, "canGift"), null);
  });

  it("tokens: valid sets the PIN once; expired, replaced, unknown and bad formats are rejected", async () => {
    const { barrel } = await makeBarrel();
    const o = await owner("Laura");
    await svc.assignOwner(o.id, barrel.id, {}, staff);
    const first = await svc.issueBarrelToken(barrel.id, "activation", staff);
    const second = await svc.issueBarrelToken(barrel.id, "activation", staff);
    await assert.rejects(() => svc.redeemToken(first.token, "111222", "111222"), { code: "invalid" });
    await assert.rejects(() => svc.redeemToken("not-a-real-token-value-123456", "111222", "111222"), { code: "invalid" });
    await assert.rejects(() => svc.redeemToken(second.token, "111222", "111222", new Date(Date.now() + svc.TOKEN_TTL_MS + 1000)), { code: "invalid" });
    await assert.rejects(() => svc.redeemToken(second.token, "12345", "12345"), { code: "validation" });
    await assert.rejects(() => svc.redeemToken(second.token, "123456", "654321"), { code: "validation" });
    await svc.redeemToken(second.token, "111222", "111222");
    await assert.rejects(() => svc.redeemToken(second.token, "111222", "111222"), { code: "invalid" });
  });

  it("only one of two concurrent redemptions wins", async () => {
    const { barrel } = await makeBarrel();
    const o = await owner("Laura");
    await svc.assignOwner(o.id, barrel.id, {}, staff);
    const { token } = await svc.issueBarrelToken(barrel.id, "activation", staff);
    const r = await Promise.allSettled([svc.redeemToken(token, "135790", "135790"), svc.redeemToken(token, "135790", "135790")]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  });

  it("revoked barrel access blocks everything and can be restored", async () => {
    const s = await setup({ Laura: 5 }, 100, "482913");
    await svc.setAccessRevoked(s.barrel.id, true, staff);
    assert.equal(await svc.authorizeBarrel(s.barrel.id, s.version), null);
    assert.equal((await svc.verifyBarrelPin(s.barrel.id, "482913")).ok, false);
    await svc.setAccessRevoked(s.barrel.id, false, staff);
    const again = await svc.verifyBarrelPin(s.barrel.id, "482913");
    assert.equal(again.ok, true);
  });
});

describe("owner attribution and allocations", () => {
  it("only the selected owner's allocation decreases", async () => {
    const s = await setup({ Laura: 50, Martín: 40, Sofía: 30 }, 120);
    const res = await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "Ana", message: "Salud", idempotencyKey: key() });
    assert.equal(res.created, true);
    assert.equal(res.gift.ownerId, s.owners.Laura.id);
    assert.equal(res.gift.assignmentId, s.owners.Laura.assignmentId);
    const by = Object.fromEntries(res.inventory.owners.map((o) => [o.name, o]));
    assert.equal(by.Laura.remaining, 49);
    assert.equal(by["Martín"].remaining, 40);
    assert.equal(by["Sofía"].remaining, 30);
    assert.equal(res.inventory.giftedTotal, 1);
    assert.equal(res.inventory.allocated, 120);
    assert.equal(res.inventory.unallocated, 0);
  });

  it("requires a valid selection: unknown, other-barrel and removed owners are refused", async () => {
    const s = await setup({ Laura: 5, Martín: 5 }, 100);
    const outsider = await owner("Ajeno");
    await assert.rejects(() => svc.createGift(s.auth, { ownerId: "", recipientName: "Ana", idempotencyKey: key() }), { code: "validation" });
    await assert.rejects(() => svc.createGift(s.auth, { ownerId: outsider.id, recipientName: "Ana", idempotencyKey: key() }), { code: "forbidden" });
    await svc.revokeAssignment(s.owners.Martín.assignmentId, staff);
    const version = (await prisma.barrel.findUniqueOrThrow({ where: { id: s.barrel.id } })).sessionVersion;
    await assert.rejects(
      () => svc.createGift({ barrelId: s.barrel.id, sessionVersion: version }, { ownerId: s.owners.Martín.id, recipientName: "Ana", idempotencyKey: key() }),
      { code: "forbidden" }
    );
  });

  it("cannot exceed the selected owner's allocation even if the barrel has stock", async () => {
    const s = await setup({ Laura: 2, Martín: 50 }, 100);
    await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "A", idempotencyKey: key() });
    await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "B", idempotencyKey: key() });
    await assert.rejects(() => svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "C", idempotencyKey: key() }), { code: "sold_out" });
    // Martín is untouched and can still gift.
    await svc.createGift(s.auth, { ownerId: s.owners.Martín.id, recipientName: "D", idempotencyKey: key() });
  });

  it("is idempotent: a repeated request deducts only once", async () => {
    const s = await setup({ Laura: 5 }, 100);
    const k = key();
    const first = await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "Ana", idempotencyKey: k });
    const again = await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "Ana", idempotencyKey: k });
    assert.equal(again.created, false);
    assert.equal(again.gift.id, first.gift.id);
    assert.equal(again.inventory.owners[0].remaining, 4);
  });

  it("never oversells an allocation under concurrent requests", async () => {
    const s = await setup({ Laura: 3, Martín: 3 }, 100);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: `Amigo ${i}`, idempotencyKey: key() }))
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    const inv = await svc.getInventory(s.barrel.id);
    assert.equal(inv.owners.find((o) => o.name === "Laura")!.remaining, 0);
    assert.equal(inv.owners.find((o) => o.name === "Martín")!.remaining, 3);
  });

  it("is also capped by the barrel's total bottled stock", async () => {
    const s = await setup({ Laura: 2 }, 2);
    await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "A", idempotencyKey: key() });
    await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "B", idempotencyKey: key() });
    await assert.rejects(() => svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "C", idempotencyKey: key() }), { code: "sold_out" });
    const none = await makeBarrel(null); // nothing bottled yet => no allocation possible
    const o = await owner("Sin stock");
    const a = await svc.assignOwner(o.id, none.barrel.id, {}, staff);
    await assert.rejects(() => svc.setAllocation(a.id, 1, staff), { code: "conflict" });
  });

  it("enforces permissions and input validation", async () => {
    const s = await setup({ Laura: 5 }, 100);
    await svc.updateAssignmentPermissions(s.owners.Laura.assignmentId, { canEditStory: true, canGift: false }, staff);
    const v = (await prisma.barrel.findUniqueOrThrow({ where: { id: s.barrel.id } })).sessionVersion;
    assert.notEqual(v, s.version); // permission changes drop existing sessions
    const auth = { barrelId: s.barrel.id, sessionVersion: v };
    await assert.rejects(() => svc.createGift(auth, { ownerId: s.owners.Laura.id, recipientName: "Ana", idempotencyKey: key() }), { code: "forbidden" });
    await svc.updateAssignmentPermissions(s.owners.Laura.assignmentId, { canEditStory: true, canGift: true }, staff);
    const v2 = (await prisma.barrel.findUniqueOrThrow({ where: { id: s.barrel.id } })).sessionVersion;
    const a2 = { barrelId: s.barrel.id, sessionVersion: v2 };
    await assert.rejects(() => svc.createGift(a2, { ownerId: s.owners.Laura.id, recipientName: "  ", idempotencyKey: key() }), { code: "validation" });
    await assert.rejects(() => svc.createGift(a2, { ownerId: s.owners.Laura.id, recipientName: "Ana", message: "x".repeat(241), idempotencyKey: key() }), { code: "validation" });
  });

  it("a disabled owner cannot be selected", async () => {
    const s = await setup({ Laura: 5, Martín: 5 }, 100);
    await svc.setOwnerStatus(s.owners.Laura.id, "disabled", staff);
    assert.deepEqual((await svc.listGivers(s.barrel.id)).map((g) => g.name), ["Martín"]);
    await assert.rejects(() => svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "Ana", idempotencyKey: key() }), { code: "forbidden" });
  });
});

describe("allocation changes keep inventory consistent", () => {
  it("cannot allocate more than the bottled stock across all owners", async () => {
    const s = await setup({ Laura: 60, Martín: 40 }, 100);
    await assert.rejects(() => svc.setAllocation(s.owners.Martín.assignmentId, 41, staff), { code: "conflict" });
    await svc.setAllocation(s.owners.Martín.assignmentId, 40, staff);
    const inv = await svc.getInventory(s.barrel.id);
    assert.equal(inv.unallocated, 0);
  });

  it("cannot reduce an allocation below what the owner already dedicated, and history is preserved", async () => {
    const s = await setup({ Laura: 10, Martín: 10 }, 100);
    for (let i = 0; i < 3; i++) await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: `A${i}`, idempotencyKey: key() });
    await assert.rejects(() => svc.setAllocation(s.owners.Laura.assignmentId, 2, staff), { code: "conflict" });
    await svc.setAllocation(s.owners.Laura.assignmentId, 3, staff);
    // Free the surplus and hand it to Martín.
    await svc.setAllocation(s.owners.Martín.assignmentId, 17, staff);
    assert.equal((await prisma.gift.findMany({ where: { ownerId: s.owners.Laura.id } })).length, 3);
  });

  it("gifts from a removed owner stay counted and their remaining allocation returns to the pool", async () => {
    const s = await setup({ Laura: 10, Martín: 10 }, 20);
    await svc.createGift(s.auth, { ownerId: s.owners.Laura.id, recipientName: "A", idempotencyKey: key() });
    await svc.revokeAssignment(s.owners.Laura.assignmentId, staff);
    const inv = await svc.getInventory(s.barrel.id);
    assert.equal(inv.giftedTotal, 1);
    assert.equal(inv.unallocated, 9); // 20 - Martín's 10 - 1 already dedicated
    await assert.rejects(() => svc.setAllocation(s.owners.Martín.assignmentId, 20, staff), { code: "conflict" });
    await svc.setAllocation(s.owners.Martín.assignmentId, 19, staff);
  });

  it("records allocation changes in the audit log", async () => {
    const s = await setup({ Laura: 10 }, 100);
    await svc.setAllocation(s.owners.Laura.assignmentId, 25, staff);
    const rows = await prisma.auditLog.findMany({ where: { action: "allocation.changed", targetId: s.barrel.id } });
    assert.ok(rows.length >= 2);
    assert.ok(rows.some((r) => JSON.parse(r.details ?? "{}").to === 25));
  });
});

describe("story editing", () => {
  it("lets anyone with the barrel session edit (when an active owner has story rights) and blocks other barrels", async () => {
    const a = await setup({ Laura: 5 });
    const b = await setup({ Diego: 5 });
    await svc.saveStory(a.auth, { text: "Mi historia", visible: true });
    const story = await prisma.customerStory.findUniqueOrThrow({ where: { projectId: a.project.id } });
    assert.equal(story.text, "Mi historia");
    assert.equal(await prisma.storyRevision.count({ where: { projectId: a.project.id } }), 1);
    // Barrel A's session version applied to barrel B is rejected.
    await assert.rejects(() => svc.saveStory({ barrelId: b.barrel.id, sessionVersion: a.version + 99 }, { text: "Intruso", visible: true }), { code: "forbidden" });
    assert.equal(await prisma.customerStory.count({ where: { projectId: b.project.id } }), 0);
  });

  it("stops working once the last owner with story rights is removed", async () => {
    const s = await setup({ Laura: 5 });
    await svc.revokeAssignment(s.owners.Laura.assignmentId, staff);
    const v = (await prisma.barrel.findUniqueOrThrow({ where: { id: s.barrel.id } })).sessionVersion;
    await assert.rejects(() => svc.saveStory({ barrelId: s.barrel.id, sessionVersion: v }, { text: "x", visible: true }), { code: "forbidden" });
  });
});

describe("audit log", () => {
  it("records security-relevant actions without secrets", async () => {
    const { barrel } = await makeBarrel();
    const o = await owner("Laura");
    await svc.assignOwner(o.id, barrel.id, {}, staff);
    const { token } = await svc.issueBarrelToken(barrel.id, "activation", staff);
    await svc.redeemToken(token, "314159", "314159");
    const rows = await prisma.auditLog.findMany({ where: { targetId: barrel.id } });
    const actions = rows.map((r) => r.action);
    assert.ok(actions.includes("assignment.created"));
    assert.ok(actions.includes("barrel.pin_activation_issued"));
    assert.ok(actions.includes("barrel.pin_activated"));
    const blob = JSON.stringify(rows);
    assert.ok(!blob.includes("314159"));
    assert.ok(!blob.includes(token));
  });
});
