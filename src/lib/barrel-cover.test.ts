// Run with: npm test   (node's built-in runner + tsx, each test file in its own temporary schema on the Supabase database)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { diskStore } from "@/lib/storage";
import { createTestDatabase } from "@/lib/test-db";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "barricas-cover-"));
const uploads = path.join(dir, "uploads");
const store = diskStore(uploads);
process.env.SESSION_SECRET = "x".repeat(40);

type Cover = typeof import("./barrel-cover");
type Db = typeof import("@/lib/prisma");
let cover: Cover;
let prisma: Db["prisma"];
const staff = { type: "staff" as const, id: "s1", name: "Admin" };

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

let seq = 0;
async function barrel() {
  seq++;
  const c = await prisma.customer.create({ data: { name: `C${seq}`, email: `c${seq}@t.local` } });
  const p = await prisma.wineProject.create({
    data: { customerId: c.id, name: `P${seq}`, variety: "Malbec", barrels: { create: { number: `K-${seq}` } } },
    include: { barrels: true },
  });
  return p.barrels[0];
}
const photo = async (id: string) => (await prisma.barrel.findUniqueOrThrow({ where: { id } })).photoUrl;

let dropTestSchema: () => Promise<void>;
before(async () => {
  dropTestSchema = await createTestDatabase();
  cover = await import("./barrel-cover");
  prisma = (await import("@/lib/prisma")).prisma;
});
after(async () => {
  await prisma.$disconnect();
  await dropTestSchema();
  rmSync(dir, { recursive: true, force: true });
});

describe("cover photo validation", () => {
  it("accepts JPG, PNG and WebP by their real bytes", () => {
    assert.equal(cover.sniffImage(JPEG)?.ext, "jpg");
    assert.equal(cover.sniffImage(PNG)?.ext, "png");
    assert.equal(cover.sniffImage(WEBP)?.ext, "webp");
  });

  it("rejects non-images even if they claim to be one, empty files and oversized files", async () => {
    const b = await barrel();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await assert.rejects(() => cover.setBarrelCover(b.id, html, staff, store), cover.CoverError);
    await assert.rejects(() => cover.setBarrelCover(b.id, new Uint8Array(0), staff, store), cover.CoverError);
    const big = new Uint8Array(cover.MAX_COVER_BYTES + 1);
    big.set(JPEG);
    await assert.rejects(() => cover.setBarrelCover(b.id, big, staff, store), cover.CoverError);
    assert.equal(await photo(b.id), null);
  });
});

describe("per-barrel cover", () => {
  it("a barrel without a custom photo uses the default; a custom one is used when set", async () => {
    const b = await barrel();
    assert.equal(cover.resolveCover(b.photoUrl), cover.DEFAULT_COVER);
    const url = await cover.setBarrelCover(b.id, JPEG, staff, store);
    assert.match(url, /^\/uploads\/cover-[0-9a-f-]+\.jpg$/);
    assert.equal(cover.resolveCover(await photo(b.id)), url);
    assert.ok(existsSync(path.join(uploads, path.basename(url))));
  });

  it("changing one barrel's photo never touches another barrel", async () => {
    const a = await barrel();
    const b = await barrel();
    const urlA = await cover.setBarrelCover(a.id, JPEG, staff, store);
    assert.equal(await photo(b.id), null);
    const urlB = await cover.setBarrelCover(b.id, PNG, staff, store);
    assert.notEqual(urlA, urlB);
    assert.equal(await photo(a.id), urlA);
    // Replacing A removes A's old file only, B keeps its own.
    const urlA2 = await cover.setBarrelCover(a.id, WEBP, staff, store);
    assert.equal(await photo(b.id), urlB);
    assert.ok(!existsSync(path.join(uploads, path.basename(urlA))));
    assert.ok(existsSync(path.join(uploads, path.basename(urlA2))));
    assert.ok(existsSync(path.join(uploads, path.basename(urlB))));
  });

  it("removing the photo restores the default and deletes the file", async () => {
    const b = await barrel();
    const url = await cover.setBarrelCover(b.id, JPEG, staff, store);
    await cover.removeBarrelCover(b.id, staff, store);
    assert.equal(await photo(b.id), null);
    assert.equal(cover.resolveCover(await photo(b.id)), cover.DEFAULT_COVER);
    assert.ok(!existsSync(path.join(uploads, path.basename(url))));
    await cover.removeBarrelCover(b.id, staff, store); // idempotent
  });

  it("a failed upload keeps the previously saved image", async () => {
    const b = await barrel();
    const url = await cover.setBarrelCover(b.id, JPEG, staff, store);
    const blocked = path.join(dir, "not-a-dir");
    writeFileSync(blocked, "x"); // a FILE where the uploads folder should be => writing fails
    await assert.rejects(() => cover.setBarrelCover(b.id, PNG, staff, diskStore(blocked)), cover.CoverError);
    assert.equal(await photo(b.id), url);
    assert.ok(existsSync(path.join(uploads, path.basename(url))));
  });

  it("ignores stored values that are not local uploads (never renders arbitrary URLs)", () => {
    assert.equal(cover.resolveCover("https://evil.example/x.jpg"), cover.DEFAULT_COVER);
    assert.equal(cover.resolveCover(""), cover.DEFAULT_COVER);
  });
});
