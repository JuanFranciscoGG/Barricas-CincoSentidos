// Run with: npm test   (pure functions only — no database needed)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agingDays, buildBarrelToday } from "./barrel-today";
import { todayFileName, TODAY_H, TODAY_SCALE, TODAY_W } from "../components/wine/barrelToday";

const barrel = { number: "CS-024", photoUrl: null as string | null };
const project = { name: "El Malbec Demo", variety: "Malbec", vintage: 2025 as number | null, startDate: new Date(2026, 1, 1) as Date | null };
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("aging days", () => {
  it("counts whole days from the recorded start date (same formula as the portal)", () => {
    assert.equal(agingDays(day(2026, 2, 1), day(2026, 10, 11)), 252);
    assert.equal(agingDays(day(2026, 2, 1), day(2026, 2, 1)), 0);
    assert.equal(agingDays(day(2026, 2, 1), new Date(2026, 1, 1, 23, 59)), 0);
  });

  it("is null when no start date was recorded (nothing is invented), never negative", () => {
    assert.equal(agingDays(null), null);
    assert.equal(agingDays("not a date"), null);
    assert.equal(agingDays(day(2030, 1, 1), day(2026, 1, 1)), 0);
  });

  it("accepts the ISO string the server sends", () => {
    assert.equal(agingDays(day(2026, 2, 1).toISOString(), day(2026, 2, 11)), 10);
  });
});

describe("barrel today data", () => {
  it("carries the right barrel and wine identity", () => {
    const d = buildBarrelToday({ barrel, project, latestMoment: null, latestNote: null });
    assert.equal(d.barrelNumber, "CS-024");
    assert.equal(d.wineName, "El Malbec Demo");
    assert.equal(d.variety, "Malbec");
    assert.equal(d.vintage, 2025);
    assert.equal(d.startDate, project.startDate!.toISOString());
  });

  it("shows the latest task when no note is newer; the note when it is newer", () => {
    const task = { date: day(2026, 8, 10), title: "Hoy probamos tu vino", note: "Vainilla y especias." };
    const olderNote = { date: day(2026, 7, 1), title: "Nota vieja", note: null };
    const newerNote = { date: new Date(2026, 9, 5, 9, 0), title: "Hoy oxigenamos tu barrica", note: "Detalle." };
    assert.equal(buildBarrelToday({ barrel, project, latestMoment: task, latestNote: null }).latest?.kind, "task");
    const a = buildBarrelToday({ barrel, project, latestMoment: task, latestNote: olderNote });
    assert.equal(a.latest?.kind, "task");
    assert.equal(a.latest?.title, "Hoy probamos tu vino");
    const b = buildBarrelToday({ barrel, project, latestMoment: task, latestNote: newerNote });
    assert.equal(b.latest?.kind, "note");
    assert.equal(b.latest?.title, "Hoy oxigenamos tu barrica");
    assert.equal(b.latest?.note, "Detalle.");
    assert.equal(buildBarrelToday({ barrel, project, latestMoment: null, latestNote: newerNote }).latest?.kind, "note");
  });

  it("handles missing information gracefully", () => {
    const d = buildBarrelToday({ barrel, project: { ...project, vintage: null, startDate: null }, latestMoment: null, latestNote: null });
    assert.equal(d.vintage, null);
    assert.equal(d.startDate, null);
    assert.equal(d.latest, null);
  });

  it("uses the barrel's own cover photo, or the default when there is none (or an unsafe value)", () => {
    assert.equal(buildBarrelToday({ barrel, project, latestMoment: null, latestNote: null }).coverImage, "/brand/cellar-barrel.jpg");
    assert.equal(buildBarrelToday({ barrel: { ...barrel, photoUrl: "/uploads/cover-abc.jpg" }, project, latestMoment: null, latestNote: null }).coverImage, "/uploads/cover-abc.jpg");
    assert.equal(buildBarrelToday({ barrel: { ...barrel, photoUrl: "https://evil.example/x.jpg" }, project, latestMoment: null, latestNote: null }).coverImage, "/brand/cellar-barrel.jpg");
  });

  it("exposes nothing private (only public page data)", () => {
    const d = buildBarrelToday({ barrel, project, latestMoment: null, latestNote: null });
    assert.deepEqual(Object.keys(d).sort(), ["barrelNumber", "coverImage", "latest", "startDate", "variety", "vintage", "wineName"]);
  });
});

describe("export format", () => {
  it("is a portrait 4:5 image exported at 2x, with a descriptive filename", () => {
    assert.equal(TODAY_W / TODAY_H, 4 / 5);
    assert.equal(TODAY_W * TODAY_SCALE, 2160);
    assert.equal(TODAY_H * TODAY_SCALE, 2700);
    assert.equal(todayFileName("CS-024"), "mi-barrica-hoy-cs-024.png");
    assert.equal(todayFileName("Barrica Ñandú #3"), "mi-barrica-hoy-barrica-nandu-3.png");
    assert.equal(todayFileName("###"), "mi-barrica-hoy-barrica.png");
  });
});
