import type { BarrelTodayData } from "@/lib/barrel-today";
import { agingDays } from "@/lib/aging";
import { loadImg, wrapLines } from "@/components/wine/dedication";

/**
 * Client-side canvas renderer for the shareable "Mi barrica hoy" card. Same
 * visual system and export approach as the gift dedication (paper card, ink
 * frame, Georgia + Archivo, wine accent, data grid at the foot). Portrait 4:5
 * (1080x1350 logical px) rendered at 2x for crisp text on phones. Missing data
 * is omitted, never invented.
 */
export const TODAY_W = 1080;
export const TODAY_H = 1350;
export const TODAY_SCALE = 2;

const INK = "#2B2725";
const WINE = "#7A2430";
const MUTED = "#6F665B";
const BG = "#F3EBE0";

export function todayFileName(barrelNumber: string) {
  const slug = barrelNumber.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "barrica";
  return `mi-barrica-hoy-${slug}.png`;
}

const fmtLong = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

export async function drawBarrelToday(data: BarrelTodayData, now: Date = new Date()): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load("500 20px Archivo"), document.fonts.load("400 20px Archivo")]);
  } catch {}
  const W = TODAY_W;
  const H = TODAY_H;
  const M = 96;
  const c = document.createElement("canvas");
  c.width = W * TODAY_SCALE;
  c.height = H * TODAY_SCALE;
  const x = c.getContext("2d");
  if (!x) throw new Error("canvas");
  x.scale(TODAY_SCALE, TODAY_SCALE);
  const ls = (v: string) => {
    if ("letterSpacing" in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v;
  };

  // --- Paper + ink frame (same as the dedication card) ---
  x.fillStyle = BG;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = INK;
  x.lineWidth = 2;
  x.strokeRect(44, 44, W - 88, H - 88);
  x.textBaseline = "alphabetic";

  // --- Header: brand left, barrel right, ink rule ---
  const logo = await loadImg("/brand/hand-mark.png");
  if (logo) {
    const s = Math.min(46 / logo.width, 46 / logo.height);
    x.drawImage(logo, M, M + 2, logo.width * s, logo.height * s);
  }
  x.fillStyle = INK;
  x.font = "32px Georgia, serif";
  ls("0px");
  x.textAlign = "left";
  x.fillText("Cinco Sentidos", M + (logo ? 62 : 0), M + 36);
  x.font = "500 17px Archivo, sans-serif";
  ls("4px");
  x.textAlign = "right";
  x.fillStyle = MUTED;
  x.fillText(`BARRICA ${data.barrelNumber}`, W - M, M + 33);
  x.textAlign = "left";
  x.fillStyle = INK;
  x.fillRect(M, M + 76, W - 2 * M, 2);

  // --- Eyebrow ---
  let y = M + 196;
  x.fillStyle = WINE;
  x.font = "500 20px Archivo, sans-serif";
  ls("6px");
  x.fillText("MI BARRICA HOY", M, y);
  ls("0px");

  // --- Hero: days in barrel (or, without a recorded start date, the wine itself) ---
  const days = agingDays(data.startDate, now);
  const title = `${data.variety}${data.vintage ? ` ${data.vintage}` : ""}`;
  x.fillStyle = INK;
  if (days !== null) {
    x.font = "250px Georgia, serif";
    ls("-8px");
    const base = y + 28 + 205;
    x.fillText(String(days), M, base);
    const numW = x.measureText(String(days)).width;
    ls("0px");
    x.font = "40px Georgia, serif";
    x.fillStyle = MUTED;
    x.fillText(days === 1 ? "día" : "días", M + numW + 28, base - 52);
    x.fillText("en crianza", M + numW + 28, base);
    y = base;
  } else {
    let size = 148;
    x.font = `${size}px Georgia, serif`;
    while (x.measureText(title).width > W - 2 * M && size > 84) {
      size -= 4;
      x.font = `${size}px Georgia, serif`;
    }
    y += 28;
    wrapLines(x, title, W - 2 * M)
      .slice(0, 2)
      .forEach((l) => {
        y += size * 0.96;
        x.fillText(l, M, y);
      });
  }

  // --- Supporting sentence ---
  const wineLine = data.wineName && data.wineName.trim().toLowerCase() !== title.trim().toLowerCase() ? `${title} · ${data.wineName}` : title;
  // Without a recorded start date we say nothing about how long it has been aging.
  const sentence =
    days !== null
      ? data.startDate
        ? `${wineLine}, en barrica desde el ${fmtLong(new Date(data.startDate))}.`
        : `${wineLine}.`
      : wineLine !== title
        ? `${data.wineName}.`
        : "";
  if (sentence) {
    y += days !== null ? 118 : 70; // old-style numerals descend below the baseline
    x.fillStyle = INK;
    x.font = "38px Georgia, serif";
    wrapLines(x, sentence, W - 2 * M - 80)
      .slice(0, 3)
      .forEach((l, i) => {
        if (i) y += 52;
        x.fillText(l, M, y);
      });
  }

  // --- Data grid at the foot (only cells that have real data) ---
  const cells: [string, string][] = [["VINO", data.wineName || data.variety]];
  if (data.vintage) cells.push(["AÑADA", String(data.vintage)]);
  if (data.startDate) cells.push(["LLENADO", fmtShort(new Date(data.startDate))]);
  cells.push(["BARRICA", data.barrelNumber]);
  const rows = Math.ceil(cells.length / 2);
  const colW = (W - 2 * M) / 2;
  const blockTop = H - M - 300 + (2 - rows) * 112;

  // --- Latest update as the quote block (wine bar + italic, like the dedication message) ---
  if (data.latest) {
    y += 64;
    x.fillStyle = WINE;
    x.fillRect(M, y, 64, 3);
    y += 30;
    x.fillStyle = INK;
    x.font = "italic 34px Georgia, serif";
    const maxLines = Math.max(1, Math.min(3, Math.floor((blockTop - 130 - y) / 46)));
    let tl = wrapLines(x, `“${data.latest.title}”`, W - 2 * M - 80);
    if (tl.length > maxLines) {
      tl = tl.slice(0, maxLines);
      tl[maxLines - 1] = tl[maxLines - 1].replace(/[\s,.;:]*\S*$/, "") + "…”";
    }
    tl.forEach((l) => {
      y += 46;
      x.fillText(l, M, y);
    });
    if (data.latest.note) {
      const room = Math.floor((blockTop - 96 - y) / 40);
      if (room >= 1) {
        x.fillStyle = MUTED;
        x.font = "27px Georgia, serif";
        let nl = wrapLines(x, data.latest.note, W - 2 * M - 80);
        const cap = Math.min(2, room);
        if (nl.length > cap) {
          nl = nl.slice(0, cap);
          nl[cap - 1] = nl[cap - 1].replace(/[\s,.;:]*\S*$/, "") + "…";
        }
        nl.forEach((l) => {
          y += 40;
          x.fillText(l, M, y);
        });
      }
    }
    y += 44;
    x.fillStyle = MUTED;
    x.font = "500 16px Archivo, sans-serif";
    ls("4px");
    x.fillText(`— ÚLTIMA NOVEDAD · ${fmtLong(new Date(data.latest.date)).toUpperCase()}`, M, y);
    ls("0px");
  }

  // Grid on top of the reserved block.
  x.fillStyle = INK;
  x.fillRect(M, blockTop, W - 2 * M, 2);
  x.fillStyle = "rgba(43,39,37,.22)";
  for (let r = 1; r < rows; r++) x.fillRect(M, blockTop + 112 * r, W - 2 * M, 1);
  if (cells.length > 1) x.fillRect(M + colW - 1, blockTop + 2, 1, 112 * rows - 2);
  cells.forEach(([k, v], i) => {
    const cx = M + (i % 2) * colW + (i % 2 ? 28 : 0);
    const cy = blockTop + Math.floor(i / 2) * 112;
    x.fillStyle = MUTED;
    x.font = "500 15px Archivo, sans-serif";
    ls("3px");
    x.fillText(k, cx, cy + 40);
    x.fillStyle = INK;
    x.font = "29px Georgia, serif";
    ls("0px");
    let text = v;
    while (x.measureText(text).width > colW - 56 && text.length > 4) text = text.slice(0, -2);
    if (text !== v) text = text.trimEnd() + "…";
    x.fillText(text, cx, cy + 82);
  });

  // --- Footer: supporting phrase + generation date (same placement as the dedication) ---
  const fy = H - M + 4;
  x.fillStyle = MUTED;
  x.font = "italic 23px Georgia, serif";
  x.textAlign = "left";
  x.fillText("Así evoluciona tu vino.", M, fy);
  x.font = "500 15px Archivo, sans-serif";
  ls("3px");
  x.fillText(`GENERADA EL ${fmtShort(now).toUpperCase()}`, M, fy - 40);
  ls("0px");

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
}
