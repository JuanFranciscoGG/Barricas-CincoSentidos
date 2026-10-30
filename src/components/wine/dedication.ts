// Client-side canvas renderer for the digital dedication card. Ported from the
// approved design prototype (same layout, type and colors). It draws only what
// the owner typed plus the wine's public facts; nothing is sent anywhere.

export interface DedicationData {
  recipient: string;
  message: string;
  ownerName: string;
  wine: string;
  vintage: string;
  origin: string;
  barrel: string;
  oak: string;
  createdAt: string;
}

export function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

export function wrapLines(x: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let line = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    const tryL = line ? `${line} ${w}` : w;
    if (x.measureText(tryL).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}

export async function drawDedication(g: DedicationData): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load("500 20px Archivo"), document.fonts.load("400 20px Archivo")]);
  } catch {}
  const W = 1080;
  const H = 1350;
  const M = 96;
  const INK = "#2B2725";
  const WINE = "#7A2430";
  const MUTED = "#6F665B";
  const BG = "#F3EBE0";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const ls = (v: string) => {
    if ("letterSpacing" in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v;
  };
  x.fillStyle = BG;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = INK;
  x.lineWidth = 2;
  x.strokeRect(44, 44, W - 88, H - 88);
  x.textBaseline = "alphabetic";
  const logo = await loadImg("/brand/hand-mark.png");
  if (logo) {
    const s = Math.min(46 / logo.width, 46 / logo.height);
    x.drawImage(logo, M, M + 2, logo.width * s, logo.height * s);
  }
  x.fillStyle = INK;
  x.font = "32px Georgia, serif";
  ls("0px");
  x.fillText("Cinco Sentidos", M + (logo ? 62 : 0), M + 36);
  x.font = "500 17px Archivo, sans-serif";
  ls("4px");
  x.textAlign = "right";
  x.fillStyle = MUTED;
  x.fillText(`BARRICA ${g.barrel}`, W - M, M + 33);
  x.textAlign = "left";
  x.fillStyle = INK;
  x.fillRect(M, M + 76, W - 2 * M, 2);
  let y = M + 196;
  x.fillStyle = WINE;
  x.font = "500 20px Archivo, sans-serif";
  ls("6px");
  x.fillText("UNA BOTELLA PARA VOS", M, y);
  ls("0px");
  x.fillStyle = INK;
  let size = 148;
  x.font = `${size}px Georgia, serif`;
  while (x.measureText(g.recipient).width > W - 2 * M && size > 84) {
    size -= 4;
    x.font = `${size}px Georgia, serif`;
  }
  const nameLines = wrapLines(x, g.recipient, W - 2 * M).slice(0, 2);
  y += 28;
  nameLines.forEach((l) => {
    y += size * 0.96;
    x.fillText(l, M, y);
  });
  y += 78;
  x.font = "38px Georgia, serif";
  wrapLines(x, `${g.ownerName} te dedicó una botella de su vino, criado en Cinco Sentidos.`, W - 2 * M - 80).forEach((l, i) => {
    if (i) y += 52;
    x.fillText(l, M, y);
  });
  const blockTop = H - M - 300;
  if (g.message) {
    y += 64;
    x.fillStyle = WINE;
    x.fillRect(M, y, 64, 3);
    y += 30;
    x.fillStyle = INK;
    x.font = "italic 32px Georgia, serif";
    const maxLines = Math.max(1, Math.floor((blockTop - 70 - y) / 46));
    let ml = wrapLines(x, `“${g.message}”`, W - 2 * M - 80);
    if (ml.length > maxLines) {
      ml = ml.slice(0, maxLines);
      ml[maxLines - 1] = ml[maxLines - 1].replace(/[\s,.;:]*\S*$/, "") + "…”";
    }
    ml.forEach((l) => {
      y += 46;
      x.fillText(l, M, y);
    });
    y += 44;
    x.fillStyle = MUTED;
    x.font = "500 16px Archivo, sans-serif";
    ls("4px");
    x.fillText(`— ${g.ownerName.split(" ")[0].toUpperCase()}`, M, y);
    ls("0px");
  }
  const colW = (W - 2 * M) / 2;
  x.fillStyle = INK;
  x.fillRect(M, blockTop, W - 2 * M, 2);
  x.fillStyle = "rgba(43,39,37,.22)";
  x.fillRect(M, blockTop + 112, W - 2 * M, 1);
  x.fillRect(M + colW - 1, blockTop + 2, 1, 222);
  const cells: [string, string][] = [
    ["VINO", g.wine],
    ["AÑADA", g.vintage],
    ["ORIGEN", g.origin],
    ["BARRICA", g.oak ? `${g.barrel} · ${g.oak}` : g.barrel],
  ];
  cells.forEach(([k, v], i) => {
    const cx = M + (i % 2) * colW + (i % 2 ? 28 : 0);
    const cy = blockTop + (i < 2 ? 0 : 112);
    x.fillStyle = MUTED;
    x.font = "500 15px Archivo, sans-serif";
    ls("3px");
    x.fillText(k, cx, cy + 40);
    x.fillStyle = INK;
    x.font = "29px Georgia, serif";
    ls("0px");
    x.fillText(v, cx, cy + 82);
  });
  const fy = H - M + 4;
  x.fillStyle = MUTED;
  x.font = "italic 23px Georgia, serif";
  x.fillText("Hay vinos que se disfrutan más cuando se comparten.", M, fy);
  x.font = "500 15px Archivo, sans-serif";
  ls("3px");
  x.fillText(
    `DEDICADA EL ${new Date(g.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "").toUpperCase()}`,
    M,
    fy - 40
  );
  ls("0px");
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
}

export function dedicationFileName(recipient: string) {
  const slug =
    recipient
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "botella";
  return `dedicatoria-cinco-sentidos-${slug}.png`;
}
