import { BoothSettings, FrameStyle, LayoutStyle } from "@/lib/types";
import { canUseGrid } from "@/lib/booth/guest-presets";
import { readLocalLogo } from "@/lib/branding/local-logo";

async function bitmapFromBlob(blob: Blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const image = document.createElement("img");
      image.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("logo"));
        image.src = url;
      });
      return createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function loadRoomLogo(
  code: string,
  hasLogo?: boolean,
  publicPath?: string,
) {
  try {
    const local = await readLocalLogo(code);
    if (local) return bitmapFromBlob(local);
  } catch {
    /* API fallback */
  }
  const fromPublic = publicPath?.startsWith("/") ? publicPath : "";
  if (fromPublic) {
    try {
      const res = await fetch(fromPublic, { cache: "force-cache" });
      if (res.ok) return bitmapFromBlob(await res.blob());
    } catch {
      /* API fallback */
    }
  }
  if (!hasLogo) return null;
  try {
    const res = await fetch(`/api/branding/${code}/logo`);
    if (!res.ok) return null;
    return bitmapFromBlob(await res.blob());
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
  if (style === "minimal") return { side: 28, gap: 10, border: 0 };
  return { side: 42, gap: 14, border: 16 };
}

function bottomPad(style: FrameStyle, caption: string, logo?: ImageBitmap | null) {
  const branded = Boolean(caption || logo);
  if (style === "minimal") return branded ? 100 : 28;
  return branded ? 128 : 56;
}

const BLUE = "#1a4c96";
const PAPER = "#f7f8fa";

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: FrameStyle,
) {
  ctx.fillStyle = style === "minimal" ? "#111111" : PAPER;
  ctx.fillRect(0, 0, width, height);
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  footer: number,
  inset: number,
  logo: ImageBitmap | null | undefined,
  caption: string,
  mark: string,
  light: boolean,
) {
  if (footer <= 0) return;
  const midY = height - footer / 2;
  const color = light ? BLUE : "#f4f4f4";
  ctx.fillStyle = color;

  let logoRight = inset;
  if (logo) {
    const maxH = Math.min(92, footer - 24);
    const maxW = width * 0.34;
    const scale = Math.min(maxH / logo.height, maxW / logo.width);
    const w = Math.max(1, logo.width * scale);
    const h = Math.max(1, logo.height * scale);
    ctx.drawImage(logo, inset, midY - h / 2, w, h);
    logoRight = inset + w + 20;
    logo.close();
  }

  const rightReserve = mark ? width * 0.22 : inset;
  if (caption) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 34px Inter, system-ui, sans-serif";
    const maxCaption = Math.max(120, width - logoRight - rightReserve - 16);
    ctx.fillText(caption, width / 2, midY, maxCaption);
  }

  if (mark) {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.fillText(mark.toUpperCase(), width - inset, midY, width * 0.28);
  }
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
  const grid = layout === "grid" && canUseGrid(count);
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

  const cols = count === 6 && ratio < 1 ? 3 : 2;
  const cellW = Math.round((innerW - gap * (cols - 1)) / cols);
  const cellH = Math.max(1, Math.round(cellW * ratio));
  const cells: Cell[] = [];
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
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
  const layout: LayoutStyle =
    settings.layoutStyle === "grid" && canUseGrid(images.length)
      ? "grid"
      : "strip";
  const caption = settings.eventCaption.trim();
  const pad = framePad(style);
  const footer = bottomPad(style, caption, logo);
  const innerW = 900;
  const origin = pad.side;
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

  const light = style !== "minimal";
  if (light && pad.border > 0) {
    ctx.fillStyle = BLUE;
    ctx.fillRect(
      origin - pad.border,
      origin - pad.border,
      innerW + pad.border * 2,
      blockH + pad.border * 2,
    );
    ctx.fillStyle = PAPER;
    ctx.fillRect(origin - 4, origin - 4, innerW + 8, blockH + 8);
  }

  for (let i = 0; i < images.length; i += 1) {
    drawShot(ctx, images[i], {
      x: origin + cells[i].x,
      y: origin + cells[i].y,
      w: cells[i].w,
      h: cells[i].h,
    });
  }
  images.forEach((image) => image.close());

  const mark = settings.name.trim() && settings.name.trim() !== "PHOTO BOOTH" ? settings.name.trim() : "";
  drawFooter(ctx, width, height, footer, origin, logo, caption, mark, light);

  return canvasBlob(canvas, Math.min(settings.jpegQuality, 0.88));
}
