// Run with: npm test   (node's built-in runner + tsx, each test file in its own temporary schema on the Supabase database)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "@/lib/test-db";

process.env.SESSION_SECRET = "x".repeat(40);

type Db = typeof import("@/lib/prisma");
type Access = typeof import("./upload-access");
let prisma: Db["prisma"];
let access: Access;

async function project(n: number) {
  const c = await prisma.customer.create({ data: { name: `C${n}`, email: `c${n}@t.local` } });
  return prisma.wineProject.create({
    data: { customerId: c.id, name: `P${n}`, variety: "Malbec", barrels: { create: { number: `U-${n}` } } },
    include: { barrels: true },
  });
}

let dropTestSchema: () => Promise<void>;
before(async () => {
  dropTestSchema = await createTestDatabase();
  access = await import("./upload-access");
  prisma = (await import("@/lib/prisma")).prisma;
});
after(async () => {
  await prisma.$disconnect();
  await dropTestSchema();
});

describe("private upload authorization", () => {
  it("only the barrels of the owning project qualify, never another project's", async () => {
    const a = await project(1);
    const b = await project(2);
    await prisma.mediaItem.create({ data: { projectId: a.id, url: "/uploads/aaa.jpg", type: "photo", customerVisible: true } });
    assert.deepEqual(await access.barrelIdsAllowedForUpload("aaa.jpg"), [a.barrels[0].id]);
    assert.ok(!(await access.barrelIdsAllowedForUpload("aaa.jpg")).includes(b.barrels[0].id));
  });

  it("staff-only media and unreferenced files are not available to any barrel", async () => {
    const a = await project(3);
    await prisma.mediaItem.create({ data: { projectId: a.id, url: "/uploads/hidden.jpg", type: "photo", customerVisible: false } });
    assert.deepEqual(await access.barrelIdsAllowedForUpload("hidden.jpg"), []);
    assert.deepEqual(await access.barrelIdsAllowedForUpload("orphan.jpg"), []);
  });

  it("only cover- files are treated as public", () => {
    assert.equal(access.isCoverName("cover-123.jpg"), true);
    assert.equal(access.isCoverName("123.jpg"), false);
  });
});
