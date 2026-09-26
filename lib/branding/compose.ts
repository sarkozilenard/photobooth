import { BoothSettings, FrameStyle, LayoutStyle } from "@/lib/types";

export async function loadRoomLogo(code: string, hasLogo?: boolean) {
  if (!hasLogo) return null;
  try {
    const res = await fetch(`/api/branding/${code}/logo`);
    if (!res.ok) return null;
    return createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

async function blobToImage(blob: Blob) {
  return createImageBitmap(blob);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("A montázs nem készült el"))),
      "image/jpeg",
      quality,
    );
  });
}

type Cell = { x: number; y: number; w: number; h: number };

function framePad(style: FrameStyle) {
  if (style === "none") return { side: 0, gap: 6, gold: 0 };
  if (style === "gold") return { side: 22, gap: 10, gold: 10 };
  if (style === "minimal") return { side: 16, gap: 8, gold: 0 };
  return { side: 36, gap: 16, gold: 0 };
}

function bottomPad(style: FrameStyle, caption: string, logo?: ImageBitmap | null) {
  const branded = Boolean(caption || logo);
  if (style === "booth" || style === "classic") return branded ? 76 : 44;
  if (style === "none") return 0;
  return branded ? 64 : 18;
}

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: FrameStyle,
) {
  if (style === "booth" || style === "classic") {
    ctx.fillStyle = "#f4efe8";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (style === "gold") {
    ctx.fillStyle = "#c4a35a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#0c0c0c";
    ctx.fillRect(10, 10, width - 20, height - 20);
    return;
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
}

function drawShot(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  cell: Cell,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cell.x, cell.y, cell.w, cell.h);
  ctx.clip();
  const scale = Math.max(cell.w / image.width, cell.h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(
    image,
    cell.x + (cell.w - dw) / 2,
    cell.y + (cell.h - dh) / 2,
    dw,
    dh,
  );
  ctx.restore();
}

function buildCells(
  count: number,
  layout: LayoutStyle,
  innerW: number,
  gap: number,
  ratio: number,
): { cells: Cell[]; blockH: number } {
  const grid = layout === "grid" && count > 1;
  if (!grid) {
    const h = Math.max(1, Math.round(innerW * ratio));
    const cells = Array.from({ length: count }, (_, i) => ({
      x: 0,
      y: i * (h + gap),
      w: innerW,
      h,
    }));
    return { cells, blockH: count * h + gap * Math.max(count - 1, 0) };
  }

  const cellW = Math.round((innerW - gap) / 2);
  const cellH = Math.max(1, Math.round(cellW * ratio));
  const cells: Cell[] = [];

  if (count === 2) {
    cells.push({ x: 0, y: 0, w: cellW, h: cellH });
    cells.push({ x: cellW + gap, y: 0, w: cellW, h: cellH });
    return { cells, blockH: cellH };
  }

  if (count === 3) {
    cells.push({ x: 0, y: 0, w: cellW, h: cellH });
    cells.push({ x: cellW + gap, y: 0, w: cellW, h: cellH });
    cells.push({
      x: Math.round((innerW - cellW) / 2),
      y: cellH + gap,
      w: cellW,
      h: cellH,
    });
    return { cells, blockH: cellH * 2 + gap };
  }

  const rows = Math.ceil(count / 2);
  for (let i = 0; i < count; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    cells.push({
      x: col * (cellW + gap),
      y: row * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  }
  return { cells, blockH: rows * cellH + (rows - 1) * gap };
}

export async function composeSession(
  shots: Blob[],
  settings: BoothSettings,
  logo?: ImageBitmap | null,
) {
  if (shots.length === 0) throw new Error("Nincs fotó a montázshoz");
  const images = await Promise.all(shots.map(blobToImage));
  const style = settings.frameStyle;
  const layout: LayoutStyle = settings.layoutStyle ?? "strip";
  const caption = settings.eventCaption.trim();
  const pad = framePad(style);
  const footer = bottomPad(style, caption, logo);
  const innerW = 900;
  const origin = pad.gold + pad.side;
  const ratio = images[0].height / Math.max(images[0].width, 1);
  const { cells, blockH } = buildCells(images.length, layout, innerW, pad.gap, ratio);

  const width = innerW + origin * 2;
  const height = origin + footer + blockH;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");
  paintBackdrop(ctx, width, height, style);

  for (let i = 0; i < images.length; i += 1) {
    drawShot(ctx, images[i], {
      x: origin + cells[i].x,
      y: origin + cells[i].y,
      w: cells[i].w,
      h: cells[i].h,
    });
  }
  images.forEach((image) => image.close());

  if (logo) {
    const maxH = 28;
    const maxW = 220;
    const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, (width - w) / 2, height - footer + (footer - h) / 2, w, h);
    logo.close();
  } else if (caption && footer > 0) {
    ctx.fillStyle = style === "booth" || style === "classic" ? "#3f3a34" : "#f3e6c4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "500 22px 'Playfair Display', serif";
    ctx.fillText(caption, width / 2, height - footer / 2, innerW);
  }

  return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.88));
}
